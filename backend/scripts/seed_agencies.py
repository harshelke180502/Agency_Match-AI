"""Load the curated agency dataset from JSON into SQLite.

Usage:
    cd backend
    python -m scripts.seed_agencies                 # load default seed
    python -m scripts.seed_agencies --reset         # drop + recreate tables first
    python -m scripts.seed_agencies --file path.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy import select

from app.db import Base, SessionLocal, engine, init_db
from app.models import Agency

DEFAULT_SEED = Path(__file__).resolve().parent.parent / "data" / "agencies_seed.json"


def load_seed(path: Path) -> list[dict]:
    with path.open() as f:
        payload = json.load(f)
    agencies = payload.get("agencies", [])
    if not isinstance(agencies, list):
        raise ValueError(f"Seed file {path} has no `agencies` list")
    return agencies


def upsert_agencies(records: list[dict]) -> tuple[int, int]:
    """Insert new agencies; update existing ones (matched by name)."""
    inserted = updated = 0
    with SessionLocal() as db:
        for rec in records:
            name = rec.get("name")
            if not name:
                continue

            existing = db.scalar(select(Agency).where(Agency.name == name))
            fields = {
                "name": name,
                "website": rec.get("website"),
                "headquarters_city": rec.get("headquarters_city"),
                "headquarters_state": rec.get("headquarters_state"),
                "country": rec.get("country", "US"),
                "other_locations": rec.get("other_locations") or [],
                "founded_year": rec.get("founded_year"),
                "employee_count_range": rec.get("employee_count_range"),
                "description": rec.get("description"),
                "services": rec.get("services") or [],
                "industries": rec.get("industries") or [],
                "specialties": rec.get("specialties") or [],
                "notable_clients": rec.get("notable_clients") or [],
                "source": rec.get("source", "curated"),
                "source_url": rec.get("source_url"),
            }

            if existing:
                for k, v in fields.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(Agency(**fields))
                inserted += 1
        db.commit()
    return inserted, updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=Path, default=DEFAULT_SEED)
    parser.add_argument("--reset", action="store_true", help="Drop and recreate tables first")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(bind=engine)

    init_db()
    records = load_seed(args.file)
    inserted, updated = upsert_agencies(records)

    print(f"Seeded {inserted + updated} agencies from {args.file.name} "
          f"({inserted} new, {updated} updated)")


if __name__ == "__main__":
    main()
