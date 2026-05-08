// Mirrors backend/app/models/schemas.py — keep in sync.

export type SizeEstimate =
  | "solo"
  | "small"
  | "mid"
  | "large"
  | "enterprise"
  | "unknown"

export interface SearchCriteria {
  sub_sector?: string | null
  industry_focus: string[]
  location?: string | null
  preferred_size?: SizeEstimate | null
  must_have_keywords: string[]
  nice_to_have_keywords: string[]
}

export interface SearchRequest {
  query: string
  criteria: SearchCriteria
  limit: number
}

export interface AgencyOut {
  id: number
  name: string
  website?: string | null
  headquarters_city?: string | null
  headquarters_state?: string | null
  other_locations?: string[] | null
  founded_year?: number | null
  employee_count_range?: string | null
  description?: string | null
  services?: string[] | null
  industries?: string[] | null
  specialties?: string[] | null
  notable_clients?: string[] | null
  source: string
  source_url?: string | null
}

export interface SubScores {
  sector_focus: number
  service_match: number
  size_fit: number
  location_fit: number
}

export interface BoostBreakdown {
  experiential: number
  sports: number
  austin: number
  texas: number
  total: number
}

export interface ScoreOut {
  overall_score: number
  sub_scores: SubScores
  reasoning: string
  red_flags: string[]
  confidence?: number | null
  boosts: BoostBreakdown
  final_score: number
}

export interface RankedAgency {
  ranking: number
  agency: AgencyOut
  score: ScoreOut
}

export interface SearchResponse {
  search_id: number
  query: string
  criteria: SearchCriteria
  results: RankedAgency[]
  candidate_count: number
  scored_count: number
  latency_ms: number
  scoring_ms: number
  created_at: string
}
