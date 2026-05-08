"use client"

import { motion, useSpring, useTransform } from "framer-motion"
import { useEffect } from "react"
import { cn, getScoreTone } from "@/lib/utils"

interface ScoreBadgeProps {
  score: number
  llmScore: number
  boostTotal: number
}

export function ScoreBadge({ score, llmScore, boostTotal }: ScoreBadgeProps) {
  const tone = getScoreTone(score)
  const spring = useSpring(0, { stiffness: 80, damping: 16 })
  const display = useTransform(spring, (v) => Math.round(v))

  useEffect(() => {
    spring.set(score)
  }, [score, spring])

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div className="relative">
        <div className={cn("absolute inset-0 rounded-2xl blur-md opacity-40", tone.bg)} />
        <div
          className={cn(
            "relative w-[78px] h-[78px] rounded-2xl flex flex-col items-center justify-center",
            "ring-4 shadow-md transition-transform group-hover:scale-105",
            tone.bg,
            tone.ring,
          )}
        >
          <motion.div
            className={cn("text-2xl font-bold tabular leading-none", tone.fg)}
          >
            {display}
          </motion.div>
          <div
            className={cn(
              "text-[9px] font-semibold uppercase tracking-[0.12em] mt-1 opacity-90",
              tone.fg,
            )}
          >
            {tone.label}
          </div>
        </div>
      </div>
      {boostTotal > 0 && (
        <div className="text-[10px] text-muted-foreground tabular">
          {Math.round(llmScore)} <span className="text-foreground/40">+</span>{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {boostTotal.toFixed(0)}
          </span>{" "}
          boost
        </div>
      )}
    </div>
  )
}
