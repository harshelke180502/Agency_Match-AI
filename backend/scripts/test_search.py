"""End-to-end test of POST /search.

Uses FastAPI TestClient — no separate server needed.

    python -m scripts.test_search
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app


PAYLOAD = {
    "query": "Experiential marketing agencies with a sports focus, US-based, Austin preferred but not required.",
    "criteria": {
        "sub_sector": "experiential",
        "industry_focus": ["sports"],
        "location": "Austin, TX (preferred, not required)",
        "nice_to_have_keywords": ["sponsorship", "activation"],
    },
    "limit": 10,
}


def main() -> None:
    with TestClient(app) as client:
        response = client.post("/search", json=PAYLOAD)

    print(f"HTTP {response.status_code}")
    if response.status_code != 200:
        print(response.text)
        raise SystemExit(1)

    data = response.json()

    print(f"\nSearch #{data['search_id']}")
    print(f"Query:       {data['query']}")
    print(f"Candidates:  {data['candidate_count']}")
    print(f"Scored:      {data['scored_count']}")
    print(f"Latency:     {data['latency_ms']:.0f}ms total ({data['scoring_ms']:.0f}ms scoring)")
    print(f"\nTop {len(data['results'])} results:\n")

    for r in data["results"]:
        a = r["agency"]
        s = r["score"]
        boosts = s["boosts"]
        active = {k: v for k, v in boosts.items() if k != "total" and v}
        loc = f"{a.get('headquarters_city') or '?'}, {a.get('headquarters_state') or '?'}"
        print(
            f"#{r['ranking']:>2} {a['name']:<32} "
            f"final={s['final_score']:5.1f}  "
            f"(llm={s['overall_score']:5.1f} + boosts={boosts['total']:.1f})  "
            f"{loc}"
        )
        if active:
            print(f"     boosts: {active}")
        print(f"     {s['reasoning']}")
        if s.get("red_flags"):
            print(f"     red_flags: {s['red_flags']}")
        print()

    # Sanity-check the response shape
    sample = data["results"][0] if data["results"] else None
    if sample:
        print("=" * 70)
        print("Sample full record (rank #1) — JSON shape verification:")
        print(json.dumps(sample, indent=2))


if __name__ == "__main__":
    main()
