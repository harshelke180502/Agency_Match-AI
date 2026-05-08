"use client"

import { motion } from "framer-motion"
import { Filter, X, Plus } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { SearchCriteria, SizeEstimate } from "@/lib/types"

const SUB_SECTORS = [
  "experiential",
  "digital",
  "creative",
  "PR",
  "media",
  "sports marketing",
  "shopper",
  "integrated",
] as const

const SIZE_OPTIONS: { value: SizeEstimate; label: string }[] = [
  { value: "solo", label: "Solo (1-10)" },
  { value: "small", label: "Small (11-50)" },
  { value: "mid", label: "Mid (51-200)" },
  { value: "large", label: "Large (201-1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
]

interface FilterSidebarProps {
  criteria: SearchCriteria
  onChange: (criteria: SearchCriteria) => void
}

export function FilterSidebar({ criteria, onChange }: FilterSidebarProps) {
  const [keywordInput, setKeywordInput] = useState("")

  const update = <K extends keyof SearchCriteria>(
    key: K,
    value: SearchCriteria[K],
  ) => onChange({ ...criteria, [key]: value })

  const toggleIndustry = (term: string) => {
    const next = criteria.industry_focus.includes(term)
      ? criteria.industry_focus.filter((t) => t !== term)
      : [...criteria.industry_focus, term]
    update("industry_focus", next)
  }

  const addKeyword = () => {
    const k = keywordInput.trim().toLowerCase()
    if (!k) return
    if (!criteria.nice_to_have_keywords.includes(k)) {
      update("nice_to_have_keywords", [...criteria.nice_to_have_keywords, k])
    }
    setKeywordInput("")
  }

  const removeKeyword = (k: string) =>
    update(
      "nice_to_have_keywords",
      criteria.nice_to_have_keywords.filter((x) => x !== k),
    )

  const INDUSTRIES = ["sports", "entertainment", "consumer brands", "tech", "B2B", "healthcare", "automotive", "spirits"]

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      className="rounded-xl border bg-card/60 backdrop-blur-sm p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-5 pb-4 border-b">
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Filter className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">Filters</h2>
      </div>

      <div className="space-y-5">
        {/* Sub-sector */}
        <div>
          <Label className="block mb-2">Sub-sector</Label>
          <div className="flex flex-wrap gap-1.5">
            {SUB_SECTORS.map((s) => {
              const active = criteria.sub_sector === s
              return (
                <button
                  key={s}
                  onClick={() => update("sub_sector", active ? null : s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Industry focus */}
        <div>
          <Label className="block mb-2">Industry focus</Label>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map((s) => {
              const active = criteria.industry_focus.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleIndustry(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Location */}
        <div>
          <Label htmlFor="loc" className="block mb-2">
            Location
          </Label>
          <Input
            id="loc"
            placeholder="e.g. Austin, TX or any US"
            value={criteria.location ?? ""}
            onChange={(e) => update("location", e.target.value || null)}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Leave blank for any US. Specify Austin/Texas to enable location boost.
          </p>
        </div>

        <Separator />

        {/* Size */}
        <div>
          <Label className="block mb-2">Preferred size</Label>
          <div className="grid grid-cols-1 gap-1">
            {SIZE_OPTIONS.map((s) => {
              const active = criteria.preferred_size === s.value
              return (
                <button
                  key={s.value}
                  onClick={() =>
                    update("preferred_size", active ? null : s.value)
                  }
                  className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Keywords */}
        <div>
          <Label className="block mb-2">Nice-to-have keywords</Label>
          <div className="flex gap-1.5">
            <Input
              placeholder="e.g. sponsorship"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addKeyword()
                }
              }}
            />
            <button
              onClick={addKeyword}
              className="px-2.5 rounded-md border bg-background hover:bg-accent transition"
              aria-label="Add keyword"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {criteria.nice_to_have_keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {criteria.nice_to_have_keywords.map((k) => (
                <Badge
                  key={k}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {k}
                  <button
                    onClick={() => removeKeyword(k)}
                    className="rounded hover:bg-background/60 p-0.5"
                    aria-label={`Remove ${k}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
