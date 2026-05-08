import type { SearchCriteria, SearchResponse } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function searchAgencies(
  query: string,
  criteria: SearchCriteria,
  limit: number = 10,
): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, criteria, limit }),
  })

  if (!res.ok) {
    let message = `Search failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.detail) message += `: ${body.detail}`
    } catch {
      /* swallow */
    }
    throw new Error(message)
  }

  return res.json()
}
