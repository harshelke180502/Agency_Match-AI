from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, computed_field


SizeEstimate = Literal["solo", "small", "mid", "large", "enterprise", "unknown"]


class SearchCriteria(BaseModel):
    """Structured criteria used for LLM scoring."""

    sub_sector: str | None = Field(None, description="e.g. 'experiential', 'digital', 'PR'")
    industry_focus: list[str] = Field(default_factory=list, description="e.g. ['sports', 'consumer brands']")
    location: str | None = Field(None, description="Free-text, e.g. 'Austin, TX' or 'United States'")
    preferred_size: SizeEstimate | None = None
    must_have_keywords: list[str] = Field(default_factory=list)
    nice_to_have_keywords: list[str] = Field(default_factory=list)


class SearchRequest(BaseModel):
    query: str = Field(..., description="Free-text describing the agency the user wants")
    criteria: SearchCriteria = Field(default_factory=SearchCriteria)
    limit: int = Field(20, ge=1, le=50)


class AgencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    website: str | None = None
    headquarters_city: str | None = None
    headquarters_state: str | None = None
    other_locations: list[str] | None = None
    founded_year: int | None = None
    employee_count_range: str | None = None
    description: str | None = None
    services: list[str] | None = None
    industries: list[str] | None = None
    specialties: list[str] | None = None
    notable_clients: list[str] | None = None
    source: str = "curated"
    source_url: str | None = None


class SubScores(BaseModel):
    sector_focus: float = Field(..., ge=0, le=100)
    service_match: float = Field(..., ge=0, le=100)
    size_fit: float = Field(..., ge=0, le=100)
    location_fit: float = Field(..., ge=0, le=100)


class BoostBreakdown(BaseModel):
    """Deterministic boosts applied on top of the LLM score.

    Each value is the points contributed to `final_score` from that category.
    Zero means the boost did not fire.
    """

    experiential: float = Field(0.0, description="Buyer wants experiential AND agency lists it")
    sports: float = Field(0.0, description="Buyer wants sports AND agency lists it")
    austin: float = Field(0.0, description="Agency HQ is Austin (when buyer is location-agnostic or TX-targeting)")
    texas: float = Field(0.0, description="Agency HQ is in TX, non-Austin (same gating as `austin`)")

    @computed_field  # type: ignore[misc]
    @property
    def total(self) -> float:
        return self.experiential + self.sports + self.austin + self.texas


class ScoreOut(BaseModel):
    overall_score: float = Field(..., description="LLM-produced score, 0-100")
    sub_scores: SubScores
    reasoning: str
    red_flags: list[str] = Field(default_factory=list)
    confidence: float | None = None
    boosts: BoostBreakdown = Field(default_factory=BoostBreakdown)
    final_score: float = Field(..., description="overall_score + boosts.total, clamped 0-100")


class RankedAgency(BaseModel):
    ranking: int = Field(..., description="1-indexed position in the ranked results")
    agency: AgencyOut
    score: ScoreOut


class SearchResponse(BaseModel):
    search_id: int
    query: str
    criteria: SearchCriteria
    results: list[RankedAgency]
    candidate_count: int
    scored_count: int
    latency_ms: float = Field(..., description="Total server-side wall time for this search")
    scoring_ms: float = Field(..., description="LLM scoring time only (the bottleneck)")
    created_at: datetime
