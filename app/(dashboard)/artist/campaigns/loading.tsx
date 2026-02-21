import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className || ""}`} />;
}

export default function CampaignsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      {/* Campaign Cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
