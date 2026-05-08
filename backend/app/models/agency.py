from datetime import datetime, timezone
from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Agency(Base):
    """A marketing agency from the curated dataset.

    Data is loaded from `data/agencies_seed.json` and may be enriched in-place
    by the LLM. There is no external fetch step at request time.
    """

    __tablename__ = "agencies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(128), unique=True, index=True)

    name: Mapped[str] = mapped_column(String(256), index=True)
    website: Mapped[str | None] = mapped_column(String(512))

    headquarters_city: Mapped[str | None] = mapped_column(String(128), index=True)
    headquarters_state: Mapped[str | None] = mapped_column(String(64), index=True)
    country: Mapped[str] = mapped_column(String(64), default="US")
    other_locations: Mapped[list[str] | None] = mapped_column(JSON)

    founded_year: Mapped[int | None] = mapped_column(Integer)
    employee_count_range: Mapped[str | None] = mapped_column(String(32))  # "1-10", "11-50", "51-200", ...

    description: Mapped[str | None] = mapped_column(Text)
    services: Mapped[list[str] | None] = mapped_column(JSON)
    industries: Mapped[list[str] | None] = mapped_column(JSON)
    specialties: Mapped[list[str] | None] = mapped_column(JSON)  # ["experiential", "sports marketing", ...]
    notable_clients: Mapped[list[str] | None] = mapped_column(JSON)

    source: Mapped[str] = mapped_column(String(64), default="curated")  # clutch, designrush, agencyspotter, goodfirms, curated
    source_url: Mapped[str | None] = mapped_column(String(512))

    enriched_by_llm: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    scores: Mapped[list["Score"]] = relationship(back_populates="agency", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_agencies_state_city", "headquarters_state", "headquarters_city"),
    )


class Search(Base):
    """A user search — captures criteria so scores can be reproduced/explained."""

    __tablename__ = "searches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    query: Mapped[str] = mapped_column(String(512))
    criteria: Mapped[dict] = mapped_column(JSON)

    candidate_count: Mapped[int] = mapped_column(Integer, default=0)
    scored_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    scores: Mapped[list["Score"]] = relationship(back_populates="search", cascade="all, delete-orphan")


class Score(Base):
    """LLM-produced score for an agency in the context of a specific search."""

    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agency_id: Mapped[int] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    search_id: Mapped[int] = mapped_column(ForeignKey("searches.id", ondelete="CASCADE"), index=True)

    overall_score: Mapped[float] = mapped_column(Float, index=True)  # 0-100, from LLM
    sub_scores: Mapped[dict] = mapped_column(JSON)  # {sector_focus, service_match, size_fit, location_fit}
    reasoning: Mapped[str] = mapped_column(Text)
    red_flags: Mapped[list[str] | None] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Float)  # 0-1

    boosts: Mapped[dict] = mapped_column(JSON)  # {experiential, sports, austin, texas}
    final_score: Mapped[float] = mapped_column(Float, index=True)  # overall + sum(boosts), clamped 0-100

    model: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    agency: Mapped["Agency"] = relationship(back_populates="scores")
    search: Mapped["Search"] = relationship(back_populates="scores")

    __table_args__ = (
        UniqueConstraint("agency_id", "search_id", name="uq_score_per_search"),
        Index("ix_scores_search_final", "search_id", "final_score"),
    )
