import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className || ""}`} />;
}

export default function WalletLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-9 w-40 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="bg-white/5 border-white/10 lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-32 mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02]">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-56 mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
