"use client"

import { motion } from "framer-motion"
import { TrendingUp } from "lucide-react"
import type { BoostBreakdown as Boosts } from "@/lib/types"
import { boostLabel } from "@/lib/utils"

interface BoostBreakdownProps {
  boosts: Boosts
}

export function BoostBreakdown({ boosts }: BoostBreakdownProps) {
  const active = (
    Object.entries(boosts)
      .filter(([k, v]) => k !== "total" && (v as number) > 0)
      .map(([k, v]) => ({ key: k, value: v as number }))
  )

  if (active.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        <TrendingUp className="h-3 w-3" />
        Deterministic boosts
      </div>
      <div className="flex flex-wrap gap-1.5">
        {active.map((b, i) => (
          <motion.div
            key={b.key}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium ring-1 ring-emerald-500/20"
          >
            {boostLabel(b.key)}
            <span className="font-bold tabular">+{b.value.toFixed(0)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
