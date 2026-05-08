import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-6">
          <div className="flex items-start gap-6">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-2/3" />
              <div className="flex gap-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex gap-1.5 pt-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
            <Skeleton className="w-[78px] h-[78px] rounded-2xl flex-shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  )
}
