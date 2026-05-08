import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ScoreTone = {
  label: string
  bg: string
  ring: string
  text: string
  fg: string
  bar: string
}

export function getScoreTone(score: number): ScoreTone {
  if (score >= 90)
    return {
      label: "Excellent",
      bg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      ring: "ring-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-400",
      fg: "text-white",
      bar: "bg-emerald-500",
    }
  if (score >= 75)
    return {
      label: "Strong",
      bg: "bg-gradient-to-br from-green-500 to-green-600",
      ring: "ring-green-500/20",
      text: "text-green-700 dark:text-green-400",
      fg: "text-white",
      bar: "bg-green-500",
    }
  if (score >= 60)
    return {
      label: "Good",
      bg: "bg-gradient-to-br from-amber-500 to-amber-600",
      ring: "ring-amber-500/20",
      text: "text-amber-700 dark:text-amber-400",
      fg: "text-white",
      bar: "bg-amber-500",
    }
  if (score >= 40)
    return {
      label: "Partial",
      bg: "bg-gradient-to-br from-orange-500 to-orange-600",
      ring: "ring-orange-500/20",
      text: "text-orange-700 dark:text-orange-400",
      fg: "text-white",
      bar: "bg-orange-500",
    }
  return {
    label: "Weak",
    bg: "bg-gradient-to-br from-rose-500 to-rose-600",
    ring: "ring-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
    fg: "text-white",
    bar: "bg-rose-500",
  }
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const BOOST_LABELS: Record<string, string> = {
  experiential: "Experiential",
  sports: "Sports",
  austin: "Austin HQ",
  texas: "Texas HQ",
}

export function boostLabel(key: string): string {
  return BOOST_LABELS[key] ?? key
}
