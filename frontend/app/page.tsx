"use client"

import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, Clock, Database, Zap } from "lucide-react"
import { useState } from "react"

import { AgencyCard } from "@/components/agency-card"
import { EmptyState } from "@/components/empty-state"
import { FilterSidebar } from "@/components/filter-sidebar"
import { Header } from "@/components/header"
import { ResultsSkeleton } from "@/components/loading-skeletons"
import { SearchBar } from "@/components/search-bar"
import { Card } from "@/components/ui/card"
import { searchAgencies } from "@/lib/api"
import { formatLatency } from "@/lib/utils"
import type { SearchCriteria, SearchResponse } from "@/lib/types"

const DEMO_QUERY =
  "Experiential marketing agencies with a sports focus, US-based, Austin preferred but not required."

const DEMO_CRITERIA: SearchCriteria = {
  sub_sector: "experiential",
  industry_focus: ["sports"],
  location: "Austin, TX (preferred, not required)",
  preferred_size: null,
  must_have_keywords: [],
  nice_to_have_keywords: ["sponsorship", "activation"],
}

export default function DashboardPage() {
  const [query, setQuery] = useState<string>(DEMO_QUERY)
  const [criteria, setCriteria] = useState<SearchCriteria>(DEMO_CRITERIA)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const data = await searchAgencies(query, criteria, 10)
      setResponse(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen dashboard-bg">
      <Header />

      <main className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8 lg:py-10">
        {/* Hero / search */}
        <section className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-primary mb-2">
              AI Agency Screening
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-[1.1]">
              Find the right marketing agency
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 bg-clip-text text-transparent">
                in seconds, not weeks.
              </span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
              Describe your brief in plain English. Claude scores 31 curated US
              agencies against your criteria and explains every match.
            </p>
          </motion.div>

          <SearchBar
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            loading={loading}
          />
        </section>

        {/* Results layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8">
          {/* Sidebar */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <FilterSidebar criteria={criteria} onChange={setCriteria} />
          </div>

          {/* Results */}
          <section className="min-w-0">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-destructive mb-0.5">
                        Search failed
                      </div>
                      <div className="text-xs text-destructive/80">{error}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Make sure the backend is running on{" "}
                        <code className="px-1 py-0.5 rounded bg-background border">
                          {process.env.NEXT_PUBLIC_API_URL ||
                            "http://localhost:8000"}
                        </code>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {loading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <LoadingMeta />
                  <ResultsSkeleton count={5} />
                </motion.div>
              )}

              {!loading && response && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <ResultsHeader response={response} />
                  {response.results.map((r, i) => (
                    <AgencyCard
                      key={`${response.search_id}-${r.agency.id}`}
                      ranked={r}
                      index={i}
                    />
                  ))}
                </motion.div>
              )}

              {!loading && !response && !error && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EmptyState />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  )
}

function ResultsHeader({ response }: { response: SearchResponse }) {
  const stats = [
    {
      icon: Database,
      label: "Candidates",
      value: response.candidate_count.toString(),
    },
    {
      icon: Zap,
      label: "Scored",
      value: `${response.scored_count}/${response.candidate_count}`,
    },
    {
      icon: Clock,
      label: "Latency",
      value: formatLatency(response.latency_ms),
    },
  ]
  return (
    <Card className="p-4 mb-3 bg-muted/30 border-dashed">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm">
          <span className="font-semibold tracking-tight">
            Top {response.results.length} matches
          </span>
          <span className="text-muted-foreground"> · ranked by AI fit</span>
        </div>
        <div className="flex items-center gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="font-medium tabular text-foreground">
                {s.value}
              </span>
              <span>{s.label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function LoadingMeta() {
  return (
    <Card className="p-4 mb-3 bg-muted/30 border-dashed">
      <div className="flex items-center gap-3 text-sm">
        <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <span className="font-medium">Scoring agencies in parallel…</span>
        <span className="text-xs text-muted-foreground">
          Claude is evaluating each agency against your brief
        </span>
      </div>
    </Card>
  )
}
