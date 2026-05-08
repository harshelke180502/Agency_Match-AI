# Agency Match AI

An AI-powered screening tool for US marketing agencies. Describe the agency you need in plain English; Claude scores 31 curated agencies against your brief and explains every match.

Built as a take-home assignment to evaluate the ability to ship an AI-powered tool that a non-technical user can drive end-to-end.

---

## What it does

- **Search** by free-text query plus structured filters (sub-sector, industry, location, size, keywords).
- **Score** every agency 0–100 against the criteria using Claude Sonnet 4.6, with sub-scores for sector focus, service match, size fit, and location fit.
- **Explain** each score in 2–3 sentences of plain business language — surfaces matching signals and red flags.
- **Rank** results with a small deterministic boost for experiential / sports specialists and Austin / Texas HQs.
- **Persist** every search and the per-agency scores so results are reproducible and inspectable.

---

## System design

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 / Tailwind / Framer Motion)                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  SearchBar   │  │ FilterSidebar│  │  AgencyCard list       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────▲─────────────┘  │
│         └─────────┬───────┘                     │                │
│                   ▼                             │                │
│              POST /search                  ranked JSON           │
└───────────────────┬─────────────────────────────┴────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────────┐
│  Backend (FastAPI)                                               │
│                                                                  │
│   1. Load 31 agencies from SQLite                                │
│   2. Score in parallel — asyncio.gather, semaphore = 10          │
│        ├── Claude Sonnet 4.6 with tool_use (structured output)   │
│        ├── 2 prompt-cache breakpoints (rubric + criteria)        │
│        └── 3 retries on transient errors                         │
│   3. Apply deterministic boosts (specialty + location)           │
│   4. Rank by final_score                                         │
│   5. Persist Search + Score rows                                 │
└───────────────────┬──────────────────────────────────────────────┘
                    │
             ┌──────▼──────┐
             │   SQLite    │
             │  agencies   │
             │  searches   │
             │   scores    │
             └─────────────┘
```

### Why this shape

- **Curated dataset over a Google Places API integration.** The original plan was Places + website scraping. We pivoted: Places returns generic "marketing agency" results with no sub-sector specificity, scraping is flaky, and both add latency, quotas, and external failure surface. A 31-agency curated seed (sourced from public directory knowledge — Clutch, DesignRush, Agency Spotter, GoodFirms) gives much richer per-agency data and makes the demo deterministic.
- **Search-contextual scoring.** Scores live in their own table keyed by `(agency_id, search_id)`. The same agency scores differently for different briefs, and we keep the history so any past search is fully reproducible.
- **LLM does subjective judgment, deterministic boosts handle the thumb on the scale.** Claude produces `overall_score` from a calibrated rubric. The four boosts are small, named, and inspectable — every result shows its LLM score next to its boost breakdown so ranking is always explainable.
- **Prompt caching at two breakpoints** — system rubric (universal) and search criteria (per-batch). With 31 agencies in a single search, the per-agency call only sends the small agency block as uncached input.

---

## Tech stack

**Backend**
- FastAPI 0.115 + Uvicorn
- SQLAlchemy 2.0 + SQLite
- Anthropic SDK 0.40 (Claude Sonnet 4.6)
- Pydantic 2.9 + pydantic-settings
- tenacity (retries with exponential backoff)

**Frontend**
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS 3.4 with custom theme tokens
- shadcn-style UI primitives (hand-rolled, no Radix)
- framer-motion for transitions and score-badge animations
- lucide-react icons
- Inter font via `next/font`

---

## Project structure

```
Agency_Match-AI/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan, logging setup
│   │   ├── config.py            # pydantic-settings, .env loader (repo-root anchored)
│   │   ├── db.py                # SQLAlchemy engine + session
│   │   ├── api/
│   │   │   └── search.py        # POST /search orchestration + timing logs
│   │   ├── services/
│   │   │   └── scoring.py       # async LLM scoring + boosts + ranking
│   │   ├── models/
│   │   │   ├── agency.py        # Agency / Search / Score (SQLAlchemy ORM)
│   │   │   └── schemas.py       # Pydantic request / response types
│   │   └── prompts/
│   │       └── score_agency.md  # Versioned scoring rubric + 3 few-shot examples
│   ├── data/
│   │   ├── agencies.db          # SQLite (gitignored)
│   │   └── agencies_seed.json   # Curated dataset of 31 agencies
│   ├── scripts/
│   │   ├── seed_agencies.py     # Load JSON → SQLite (idempotent upsert, --reset)
│   │   └── test_search.py       # End-to-end test via FastAPI TestClient
│   ├── requirements.txt
│   └── pyproject.toml           # Tool config only (ruff + pytest)
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css          # Theme tokens, glass header, dashboard gradient
│   │   └── page.tsx             # Dashboard (hero + search + sidebar + results)
│   ├── components/
│   │   ├── ui/                  # 8 shadcn-style primitives
│   │   ├── header.tsx
│   │   ├── search-bar.tsx
│   │   ├── filter-sidebar.tsx
│   │   ├── agency-card.tsx
│   │   ├── score-badge.tsx
│   │   ├── boost-breakdown.tsx
│   │   ├── empty-state.tsx
│   │   └── loading-skeletons.tsx
│   ├── lib/
│   │   ├── utils.ts             # cn(), getScoreTone(), boostLabel(), formatLatency()
│   │   ├── types.ts             # TypeScript mirror of backend schemas
│   │   └── api.ts               # POST /search wrapper
│   └── package.json
├── .env.example
└── README.md
```

---

## How a search works (end to end)

1. User enters a free-text brief and / or adjusts filters in the sidebar.
2. Frontend POSTs to `/search` with `{ query, criteria, limit }`.
3. Backend loads all 31 agencies from SQLite (~5 ms).
4. `score_agencies()` fans out to Claude in parallel (`asyncio.gather`, semaphore = 10):
   - System prompt (rubric + 3 few-shot calibration examples) is cached.
   - Criteria block is cached per batch.
   - Per-agency content is the only uncached input.
   - Claude returns structured JSON via the `submit_score` tool — overall + 4 sub-scores + reasoning + red flags + confidence.
5. Deterministic boosts apply on top of the LLM score:
   - `+3 experiential` if the buyer asks for it AND the agency lists it.
   - `+3 sports` if the buyer asks for it AND the agency lists it.
   - `+5 austin` if HQ is Austin AND buyer is location-agnostic or TX-targeting.
   - `+2 texas` if HQ is in TX (non-Austin), same gating.
6. `final_score = clamp(overall_score + sum(boosts), 0, 100)`.
7. Results sort by `final_score desc` (with `overall_score` as the tie-breaker).
8. Backend persists the `Search` row plus a `Score` row per agency in one transaction.
9. Frontend renders animated cards with score badges, sub-score bars, boost pills, and AI reasoning.

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Anthropic API key

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `.env` at the **repo root** (next to `.env.example`):

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Seed the database:

```bash
python -m scripts.seed_agencies
```

Re-seeding (after schema changes):

```bash
python -m scripts.seed_agencies --reset
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000` and only needs editing if your backend runs elsewhere.

---

## Running

Two terminals:

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

> **Note:** use `python -m uvicorn …` (not just `uvicorn …`) on Python 3.13 + macOS — the reloader's worker subprocess can otherwise pick up system Python and fail to find `fastapi`.

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Open **http://localhost:3000**. The brief query is pre-filled — one click on **Find agencies** triggers the full pipeline.

### Backend-only checks

```bash
cd backend && source venv/bin/activate

# Full E2E via FastAPI TestClient — exercises real DB + real LLM
python -m scripts.test_search

# Quick sanity check against 5 agencies — useful for prompt iteration
python -m app.services.scoring
```

---

## API reference

### `POST /search`

Request:

```json
{
  "query": "Experiential marketing agencies with a sports focus, US-based, Austin preferred but not required.",
  "criteria": {
    "sub_sector": "experiential",
    "industry_focus": ["sports"],
    "location": "Austin, TX (preferred, not required)",
    "preferred_size": null,
    "must_have_keywords": [],
    "nice_to_have_keywords": ["sponsorship", "activation"]
  },
  "limit": 10
}
```

Response (excerpt):

```json
{
  "search_id": 2,
  "candidate_count": 31,
  "scored_count": 31,
  "latency_ms": 17204,
  "scoring_ms": 17168,
  "results": [
    {
      "ranking": 1,
      "agency": {
        "id": 1,
        "name": "Wasserman",
        "headquarters_city": "Los Angeles",
        "headquarters_state": "CA",
        "specialties": ["sports marketing", "experiential activation", "..."],
        "services": ["sports marketing", "experiential", "..."],
        "...": "..."
      },
      "score": {
        "overall_score": 92,
        "sub_scores": {
          "sector_focus": 95,
          "service_match": 95,
          "size_fit": 78,
          "location_fit": 82
        },
        "reasoning": "Specialist sports and experiential agency...",
        "red_flags": [],
        "confidence": 0.95,
        "boosts": {
          "experiential": 3,
          "sports": 3,
          "austin": 0,
          "texas": 0,
          "total": 6
        },
        "final_score": 98
      }
    }
  ]
}
```

### `GET /health`

Returns `{"status": "ok"}`.

---

## Scoring rubric

Documented in [`backend/app/prompts/score_agency.md`](backend/app/prompts/score_agency.md). The prompt includes:

- **Sub-score definitions** with explicit anchoring rules — when to score 90+, 50–70, under 25.
- **Overall score rubric** — 90+ strong, 70+ good, 50+ partial, 30+ weak, <30 no fit. Overall is **not** an average; sector_focus and service_match carry more weight.
- **Reasoning style** — 2–3 sentences, business English, no marketing fluff, reference specific signals from the agency record, never invent client names.
- **Confidence scale** — 0.9+ when the record is rich, dropping below 0.3 when there's almost no signal.
- **Three calibration examples** — Wasserman as a strong fit (~92), GSD&M as medium (~48), T3 as weak (~22) — using actual seed agencies so when those names appear they have direct calibration.

---

## Curated dataset

`backend/data/agencies_seed.json` contains 31 US marketing agencies, weighted toward the brief:

- **18 sports + experiential specialists** — Wasserman, Octagon, GMR, Two Circles, Team Epic, rEvolution, MKTG, Momentum, Jack Morton, GPJ, Inspira, Mosaic, Match, Civic, Premier Partnerships, Playfly, Excel, Legends.
- **11 Austin / Texas agencies** — GSD&M, McGarrah Jessee, T3, Door Number 3, Proof, Sanders\\Wingo, 70kft, MAS Event + Design, Slingshot, Richards Group, Moroch, plus The Marketing Arm and Genesco Sports.

Each entry has `source: "curated_starter"` and a verification note in the file header — verify any specific detail before client-facing use.

---

## Performance

End-to-end latency for a 31-agency search: **~17 seconds**, with LLM scoring as the only meaningful contributor.

| Stage | Latency |
|-------|--------:|
| Load 31 agencies from SQLite | ~5 ms |
| Score (parallel, concurrency 10) | ~17 s |
| Persist Search + 31 Score rows | ~50 ms |

Optimizations already applied:

- Parallel scoring via `asyncio.gather`
- Two prompt-cache breakpoints — ~85% of input tokens cached on second-and-later batches
- Bulk SQL insert for scores
- Per-agency retries (3 attempts, exponential backoff) without failing the whole search

Possible future wins:

- Reduce `max_tokens` from 600 → 300 (reasoning is short anyway) — likely cuts P50 ~30%.
- Increase concurrency past 10 (depends on your Anthropic rate-limit tier).
- Pre-filter candidates by SQL when `location` is strict (skip non-matching agencies before LLM scoring).

---

## Development log — what was built, in order

1. **Initial plan** with Google Places API + website scraping pipeline.
2. **DB schema** — `Agency`, `Search`, `Score` tables with search-contextual scoring.
3. **Pivot away from Google Places** — replaced with a curated 31-agency seed dataset for richer signal and deterministic demo behavior.
4. **Scoring engine** — Claude Sonnet 4.6 with `tool_use`, prompt caching, parallel async, retries.
5. **Calibration** — 3-example few-shot rubric in versioned markdown.
6. **Boost system** — 4 named boosts (experiential, sports, Austin, Texas) returned as a structured `BoostBreakdown`.
7. **Search API** — `POST /search` with timing / logging, graceful per-agency error handling, persistence.
8. **End-to-end test** — `scripts/test_search.py` validates response shape via `TestClient`.
9. **Frontend dashboard** — Next.js 14, Tailwind, framer-motion, hand-rolled shadcn-style primitives, animated score badges, sub-score bars, expandable score breakdowns, empty / loading states.

---

## Known limits and notes

- Seed dataset is curated from public-directory knowledge — verify any specific agency detail before client-facing use.
- No website scraping; all agency signal comes from the curated record.
- No authentication, no rate limiting — single-user demo only.
- SQLite is fine at this scale; for >1000 agencies switch to Postgres.
- Sector / location filtering currently happens through the LLM's interpretation of criteria rather than at the SQL layer. With only 31 candidates this is a no-op; at scale, pre-filtering would reduce LLM cost.
- The `SubScores.size_fit` defaults to 75 when no buyer preference is specified. Same for `location_fit` when location is "any US."

---

Built for the Agency Match AI take-home assignment, May 2026.
