"use client"

import { motion } from "framer-motion"
import { Search, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface SearchBarProps {
  query: string
  onQueryChange: (q: string) => void
  onSearch: () => void
  loading: boolean
}

export function SearchBar({
  query,
  onQueryChange,
  onSearch,
  loading,
}: SearchBarProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSearch()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative"
    >
      <div className="absolute -inset-px bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-60 pointer-events-none" />

      <div className="relative rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground tracking-wide">
            Describe the agency you&apos;re looking for
          </span>
        </div>

        <Textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. Experiential marketing agencies with a sports focus, US-based, Austin preferred but not required."
          className="border-0 shadow-none px-5 pt-1 pb-3 text-base resize-none focus-visible:ring-0 focus-visible:border-0 min-h-[72px]"
          rows={2}
        />

        <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-t">
          <div className="text-[11px] text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">
              ⌘
            </kbd>{" "}
            +{" "}
            <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">
              ↵
            </kbd>{" "}
            to search
          </div>
          <Button
            onClick={onSearch}
            disabled={loading || !query.trim()}
            variant="gradient"
            size="lg"
            className="min-w-[140px]"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Scoring…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Find agencies
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
