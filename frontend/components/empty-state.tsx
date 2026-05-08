"use client"

import { motion } from "framer-motion"
import { Sparkles, Search, MapPin, Trophy } from "lucide-react"

export function EmptyState() {
  const tips = [
    {
      icon: Search,
      title: "Free-text query",
      desc: "Describe what you need in plain English. The model will figure out the rest.",
    },
    {
      icon: Trophy,
      title: "Sub-sector + industry",
      desc: "Combine an agency type (experiential, digital) with an industry focus (sports, CPG).",
    },
    {
      icon: MapPin,
      title: "Location boost",
      desc: "Leave location blank or set Texas to apply the Austin/TX preference boost.",
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-xl border bg-card/40 backdrop-blur-sm p-10 text-center"
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight mb-1.5">
        Describe the agency you&apos;re looking for
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
        Claude scores all 31 curated US marketing agencies against your brief and
        ranks them with concise, business-focused reasoning.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
        {tips.map((t) => (
          <div
            key={t.title}
            className="rounded-lg border bg-background/60 p-4 text-left"
          >
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted mb-2">
              <t.icon className="h-3.5 w-3.5 text-foreground/60" />
            </div>
            <div className="text-[13px] font-semibold mb-0.5">{t.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {t.desc}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
