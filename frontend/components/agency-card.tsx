"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ExternalLink,
  MapPin,
  Users,
  AlertTriangle,
  Sparkles,
  Calendar,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScoreBadge } from "@/components/score-badge"
import { BoostBreakdown } from "@/components/boost-breakdown"
import { cn, getScoreTone } from "@/lib/utils"
import type { RankedAgency, SubScores as SubScoresT } from "@/lib/types"

interface AgencyCardProps {
  ranked: RankedAgency
  index: number
}

export function AgencyCard({ ranked, index }: AgencyCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { agency, score, ranking } = ranked

  const location = [agency.headquarters_city, agency.headquarters_state]
    .filter(Boolean)
    .join(", ")

  const topSpecialties = (agency.specialties ?? []).slice(0, 4)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.05, 0.4),
        ease: "easeOut",
      }}
    >
      <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="relative p-6">
          <div className="flex items-start gap-6">
            {/* Left: content */}
            <div className="flex-1 min-w-0">
              {/* Rank + name */}
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground tabular">
                  Rank #{ranking}
                </span>
                <div className="h-3 w-px bg-border" />
                <span className="text-[11px] text-muted-foreground tabular">
                  Confidence{" "}
                  <span className="text-foreground/80 font-medium">
                    {((score.confidence ?? 0) * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2 leading-tight">
                {agency.name}
              </h3>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
                {agency.employee_count_range && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {agency.employee_count_range}
                  </span>
                )}
                {agency.founded_year && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Est. {agency.founded_year}
                  </span>
                )}
              </div>

              {/* Specialties */}
              {topSpecialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {topSpecialties.map((s) => (
                    <Badge key={s} variant="default" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              {/* AI explanation */}
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-4 py-3 border border-border/60">
                <div className="flex-shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[13.5px] leading-relaxed text-foreground/90">
                  {score.reasoning}
                </p>
              </div>
            </div>

            {/* Right: score badge */}
            <div className="flex-shrink-0">
              <ScoreBadge
                score={score.final_score}
                llmScore={score.overall_score}
                boostTotal={score.boosts.total}
              />
            </div>
          </div>

          {/* Expandable section */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
            {expanded ? "Hide breakdown" : "View score breakdown"}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="breakdown"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-border/60 space-y-5">
                  <SubScoreBars subScores={score.sub_scores} />
                  <BoostBreakdown boosts={score.boosts} />
                  {score.red_flags.length > 0 && (
                    <RedFlags flags={score.red_flags} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground truncate">
              {agency.industries?.slice(0, 3).join(" · ")}
            </div>
            {agency.website && (
              <a
                href={agency.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Visit website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function SubScoreBars({ subScores }: { subScores: SubScoresT }) {
  const rows = [
    { label: "Sector focus", value: subScores.sector_focus },
    { label: "Service match", value: subScores.service_match },
    { label: "Size fit", value: subScores.size_fit },
    { label: "Location fit", value: subScores.location_fit },
  ]
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Sub-scores
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const tone = getScoreTone(r.value)
          return (
            <div key={r.label} className="flex items-center gap-3 text-xs">
              <div className="w-24 text-muted-foreground">{r.label}</div>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${r.value}%` }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.06,
                    ease: "easeOut",
                  }}
                  className={cn("h-full rounded-full", tone.bar)}
                />
              </div>
              <div className="w-8 text-right tabular font-medium">
                {Math.round(r.value)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RedFlags({ flags }: { flags: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
        <AlertTriangle className="h-3 w-3" />
        Things to consider
      </div>
      <ul className="space-y-1">
        {flags.map((f, i) => (
          <li
            key={i}
            className="text-xs text-foreground/75 leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-amber-500"
          >
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
