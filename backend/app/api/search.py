"""Search orchestration: query -> load -> score (parallel) -> rank -> persist -> respond."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Agency, Score, Search
from app.models.schemas import (
    AgencyOut,
    RankedAgency,
    SearchRequest,
    SearchResponse,
)
from app.services.scoring import rank, score_agencies

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest, db: Session = Depends(get_db)) -> SearchResponse:
    """Orchestrate a full search: load agencies, score in parallel, rank, persist, return."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not configured. Add it to .env.",
        )

    t_start = time.perf_counter()

    # 1. Load candidates
    agencies = list(db.scalars(select(Agency)).all())
    candidate_count = len(agencies)
    if candidate_count == 0:
        raise HTTPException(
            status_code=503,
            detail="No agencies seeded. Run: python -m scripts.seed_agencies",
        )
    log.info("search.start query=%r candidates=%d", request.query, candidate_count)

    # 2. Score in parallel
    t_score_start = time.perf_counter()
    try:
        scored = await score_agencies(agencies, request.criteria, request.query)
    except Exception as e:
        log.exception("search.scoring_failed")
        raise HTTPException(status_code=502, detail=f"Scoring failed: {e}") from e
    scoring_ms = (time.perf_counter() - t_score_start) * 1000
    log.info(
        "search.scored ok=%d/%d duration_ms=%.0f",
        len(scored),
        candidate_count,
        scoring_ms,
    )

    if not scored:
        raise HTTPException(
            status_code=502,
            detail="All scoring attempts failed. Check ANTHROPIC_API_KEY and network.",
        )

    # 3. Rank
    ranked = rank(scored)

    # 4. Persist (search row + score rows). Failures here don't lose the LLM work —
    #    we return results regardless and log the persistence error.
    t_persist_start = time.perf_counter()
    search_id = -1
    created_at = datetime.now(timezone.utc)
    try:
        search_row = Search(
            query=request.query,
            criteria=request.criteria.model_dump(),
            candidate_count=candidate_count,
            scored_count=len(scored),
            created_at=created_at,
        )
        db.add(search_row)
        db.flush()  # populate search_row.id

        score_rows = [
            Score(
                agency_id=agency.id,
                search_id=search_row.id,
                overall_score=score.overall_score,
                sub_scores=score.sub_scores.model_dump(),
                reasoning=score.reasoning,
                red_flags=score.red_flags,
                confidence=score.confidence,
                boosts=score.boosts.model_dump(exclude={"total"}),
                final_score=score.final_score,
                model=settings.llm_model,
            )
            for agency, score in ranked
        ]
        db.bulk_save_objects(score_rows)
        db.commit()
        search_id = search_row.id
        persist_ms = (time.perf_counter() - t_persist_start) * 1000
        log.info(
            "search.persisted id=%d scores=%d duration_ms=%.0f",
            search_id,
            len(score_rows),
            persist_ms,
        )
    except Exception:
        db.rollback()
        log.exception("search.persist_failed — returning results without persistence")

    # 5. Build response
    results = [
        RankedAgency(
            ranking=i + 1,
            agency=AgencyOut.model_validate(agency),
            score=score,
        )
        for i, (agency, score) in enumerate(ranked[: request.limit])
    ]

    total_ms = (time.perf_counter() - t_start) * 1000
    log.info(
        "search.done id=%d returned=%d total_ms=%.0f scoring_ms=%.0f",
        search_id,
        len(results),
        total_ms,
        scoring_ms,
    )

    return SearchResponse(
        search_id=search_id,
        query=request.query,
        criteria=request.criteria,
        results=results,
        candidate_count=candidate_count,
        scored_count=len(scored),
        latency_ms=total_ms,
        scoring_ms=scoring_ms,
        created_at=created_at,
    )
