"""Async LLM scoring engine.

- Claude Sonnet 4.6 with tool-use for structured output.
- Prompt caching at two breakpoints: system rubric (universal) and search
  criteria (per-batch). Per-agency content is the only uncached input.
- `asyncio.gather` with a semaphore for parallel scoring.
- Deterministic Austin/TX boost applied AFTER the LLM result.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from anthropic import APIError, AsyncAnthropic
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.models import Agency
from app.models.schemas import BoostBreakdown, ScoreOut, SearchCriteria, SubScores

log = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "score_agency.md"

SCORE_TOOL: dict[str, Any] = {
    "name": "submit_score",
    "description": "Submit the structured score for the agency under review.",
    "input_schema": {
        "type": "object",
        "properties": {
            "overall_score": {
                "type": "number",
                "minimum": 0,
                "maximum": 100,
                "description": "Overall fit, 0-100. Weight sector_focus and service_match most heavily.",
            },
            "sub_scores": {
                "type": "object",
                "properties": {
                    "sector_focus": {"type": "number", "minimum": 0, "maximum": 100},
                    "service_match": {"type": "number", "minimum": 0, "maximum": 100},
                    "size_fit": {"type": "number", "minimum": 0, "maximum": 100},
                    "location_fit": {"type": "number", "minimum": 0, "maximum": 100},
                },
                "required": ["sector_focus", "service_match", "size_fit", "location_fit"],
            },
            "reasoning": {
                "type": "string",
                "description": "2-3 sentences, plain business English. Reference specific agency signals.",
            },
            "red_flags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional concerns. Empty list when none.",
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "How much signal the record provided. See rubric.",
            },
        },
        "required": ["overall_score", "sub_scores", "reasoning", "confidence"],
    },
}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _load_system_prompt() -> str:
    return PROMPT_PATH.read_text()


def _criteria_to_text(criteria: SearchCriteria, query: str) -> str:
    lines = [f"Buyer query: {query}"]
    if criteria.sub_sector:
        lines.append(f"Requested sub-sector: {criteria.sub_sector}")
    if criteria.industry_focus:
        lines.append(f"Industry focus: {', '.join(criteria.industry_focus)}")
    lines.append(f"Location preference: {criteria.location or '(any US)'}")
    if criteria.preferred_size:
        lines.append(f"Preferred size: {criteria.preferred_size}")
    if criteria.must_have_keywords:
        lines.append(f"Must-have keywords: {', '.join(criteria.must_have_keywords)}")
    if criteria.nice_to_have_keywords:
        lines.append(f"Nice-to-have keywords: {', '.join(criteria.nice_to_have_keywords)}")
    return "\n".join(lines)


def _agency_to_text(agency: Agency) -> str:
    parts = [
        f"Name: {agency.name}",
        f"HQ: {agency.headquarters_city or '?'}, {agency.headquarters_state or '?'} ({agency.country})",
    ]
    if agency.other_locations:
        parts.append(f"Other locations: {', '.join(agency.other_locations)}")
    if agency.founded_year:
        parts.append(f"Founded: {agency.founded_year}")
    if agency.employee_count_range:
        parts.append(f"Size: {agency.employee_count_range}")
    if agency.specialties:
        parts.append(f"Specialties: {', '.join(agency.specialties)}")
    if agency.services:
        parts.append(f"Services: {', '.join(agency.services)}")
    if agency.industries:
        parts.append(f"Industries: {', '.join(agency.industries)}")
    if agency.notable_clients:
        parts.append(f"Notable clients: {', '.join(agency.notable_clients)}")
    if agency.description:
        parts.append(f"Description: {agency.description}")
    return "\n".join(parts)


# ----------------------- Boost logic -----------------------

# Boost magnitudes — kept lightweight and interpretable.
BOOST_EXPERIENTIAL = 3.0
BOOST_SPORTS = 3.0
BOOST_AUSTIN = 5.0
BOOST_TEXAS = 2.0  # TX HQ that isn't Austin


def _location_targets_texas(location: str | None) -> bool:
    if not location:
        return False
    needle = location.lower()
    return any(t in needle for t in ("austin", "texas", " tx", ", tx"))


def _location_is_agnostic(location: str | None) -> bool:
    if not location:
        return True
    needle = location.strip().lower()
    return needle in ("us", "usa", "united states", "any", "anywhere", "national", "all", "")


def _criteria_mentions(criteria: SearchCriteria, term: str) -> bool:
    """Whether the buyer's criteria explicitly references a topic."""
    haystacks: list[str] = []
    if criteria.sub_sector:
        haystacks.append(criteria.sub_sector.lower())
    haystacks.extend(s.lower() for s in criteria.industry_focus)
    haystacks.extend(s.lower() for s in criteria.must_have_keywords)
    haystacks.extend(s.lower() for s in criteria.nice_to_have_keywords)
    return any(term in h for h in haystacks)


def _agency_has_term(agency: Agency, term: str) -> bool:
    """Whether the agency lists the term across specialties / services / industries."""
    for field in (agency.specialties, agency.services, agency.industries):
        if not field:
            continue
        if any(term in s.lower() for s in field):
            return True
    return False


def compute_boost(agency: Agency, criteria: SearchCriteria) -> BoostBreakdown:
    """Deterministic boosts applied on top of the LLM score.

    - `experiential` / `sports` fire only when the buyer asked for that focus
      AND the agency lists it. Two-sided check avoids inflating scores when
      either side doesn't actually want / offer it.
    - `austin` / `texas` fire only when the buyer is location-agnostic or
      explicitly targeting Texas. Mutually exclusive: Austin agencies get
      `austin`, other TX agencies get `texas`.
    """
    boost = BoostBreakdown()

    if _criteria_mentions(criteria, "experiential") and _agency_has_term(agency, "experiential"):
        boost.experiential = BOOST_EXPERIENTIAL

    if _criteria_mentions(criteria, "sports") and _agency_has_term(agency, "sports"):
        boost.sports = BOOST_SPORTS

    location_eligible = (
        _location_is_agnostic(criteria.location)
        or _location_targets_texas(criteria.location)
    )
    if location_eligible:
        city = (agency.headquarters_city or "").strip().lower()
        state = (agency.headquarters_state or "").strip().upper()
        if city == "austin":
            boost.austin = BOOST_AUSTIN
        elif state == "TX":
            boost.texas = BOOST_TEXAS

    return boost


# ----------------------- LLM call -----------------------


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=8),
    retry=retry_if_exception_type(APIError),
    reraise=True,
)
async def _score_one(
    client: AsyncAnthropic,
    *,
    system_blocks: list[dict[str, Any]],
    criteria_text: str,
    agency_text: str,
    model: str,
) -> dict[str, Any]:
    response = await client.messages.create(
        model=model,
        max_tokens=600,
        system=system_blocks,
        tools=[SCORE_TOOL],
        tool_choice={"type": "tool", "name": "submit_score"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"# Search criteria\n\n{criteria_text}",
                        "cache_control": {"type": "ephemeral"},
                    },
                    {
                        "type": "text",
                        "text": (
                            f"# Agency to score\n\n{agency_text}\n\n"
                            "Return the score via the submit_score tool."
                        ),
                    },
                ],
            }
        ],
    )
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "submit_score":
            return block.input  # type: ignore[return-value]
    raise RuntimeError(f"submit_score tool was not called. Stop reason: {response.stop_reason}")


def _to_score_out(raw: dict[str, Any], agency: Agency, criteria: SearchCriteria) -> ScoreOut:
    sub = raw["sub_scores"]
    sub_scores = SubScores(
        sector_focus=_clamp(float(sub["sector_focus"])),
        service_match=_clamp(float(sub["service_match"])),
        size_fit=_clamp(float(sub["size_fit"])),
        location_fit=_clamp(float(sub["location_fit"])),
    )
    overall = _clamp(float(raw["overall_score"]))
    boosts = compute_boost(agency, criteria)
    final = _clamp(overall + boosts.total)
    confidence = raw.get("confidence")
    return ScoreOut(
        overall_score=overall,
        sub_scores=sub_scores,
        reasoning=str(raw["reasoning"]).strip(),
        red_flags=list(raw.get("red_flags") or []),
        confidence=float(confidence) if confidence is not None else None,
        boosts=boosts,
        final_score=final,
    )


# ----------------------- Public API -----------------------


async def score_agencies(
    agencies: list[Agency],
    criteria: SearchCriteria,
    query: str,
    *,
    model: str | None = None,
    concurrency: int | None = None,
) -> list[tuple[Agency, ScoreOut]]:
    """Score agencies in parallel against criteria. Returns only successful scores."""
    if not agencies:
        return []

    settings = get_settings()
    model = model or settings.llm_model
    sem = asyncio.Semaphore(concurrency or settings.scoring_concurrency)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    system_blocks: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": _load_system_prompt(),
            "cache_control": {"type": "ephemeral"},
        }
    ]
    criteria_text = _criteria_to_text(criteria, query)

    async def _score_with_sem(agency: Agency) -> tuple[Agency, ScoreOut | None]:
        async with sem:
            try:
                raw = await _score_one(
                    client,
                    system_blocks=system_blocks,
                    criteria_text=criteria_text,
                    agency_text=_agency_to_text(agency),
                    model=model,
                )
                return agency, _to_score_out(raw, agency, criteria)
            except Exception:
                log.exception("Failed to score agency %s", agency.name)
                return agency, None

    pairs = await asyncio.gather(*[_score_with_sem(a) for a in agencies])
    return [(a, s) for a, s in pairs if s is not None]


def rank(scored: list[tuple[Agency, ScoreOut]]) -> list[tuple[Agency, ScoreOut]]:
    """Sort by final_score desc, with overall_score as tiebreak."""
    return sorted(scored, key=lambda p: (p[1].final_score, p[1].overall_score), reverse=True)


# ----------------------- CLI demo -----------------------


def _run_demo() -> None:
    """Quick local check: score 5 seeded agencies against the brief criteria."""
    from sqlalchemy import select

    from app.db import SessionLocal, init_db

    if not get_settings().anthropic_api_key:
        raise SystemExit("ANTHROPIC_API_KEY not set in .env or environment.")

    init_db()
    with SessionLocal() as db:
        agencies = db.scalars(select(Agency).limit(5)).all()
        if not agencies:
            raise SystemExit("DB is empty. Run: python -m scripts.seed_agencies")

    criteria = SearchCriteria(
        sub_sector="experiential",
        industry_focus=["sports"],
        location="Austin, TX (preferred, not required)",
        nice_to_have_keywords=["sponsorship", "activation"],
    )
    query = "Experiential marketing agencies with a sports focus, US-based, Austin preferred."

    scored = asyncio.run(score_agencies(agencies, criteria, query))
    for agency, score in rank(scored):
        active_boosts = {k: v for k, v in score.boosts.model_dump(exclude={"total"}).items() if v}
        print(f"\n{agency.name:30s}  final={score.final_score:5.1f}  "
              f"(llm={score.overall_score:.1f} + boosts={score.boosts.total:.1f})")
        if active_boosts:
            print(f"  boosts: {active_boosts}")
        print(f"  sub: {score.sub_scores.model_dump()}")
        print(f"  reasoning: {score.reasoning}")
        if score.red_flags:
            print(f"  red_flags: {score.red_flags}")


if __name__ == "__main__":
    _run_demo()
