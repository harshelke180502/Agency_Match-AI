"use client"

import { Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function Header() {
  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg blur-md opacity-40" />
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
              <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight leading-none">
              Agency Match AI
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Screening tool for US marketing agencies
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="soft" className="hidden sm:inline-flex">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Claude Sonnet 4.6
          </Badge>
        </div>
      </div>
    </header>
  )
}
