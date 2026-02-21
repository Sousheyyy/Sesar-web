import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/5 ${className || ""}`} />;
}

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-9 w-64 mb-1" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart 1 */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>

      {/* Chart 2 */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>

      {/* Bottom grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-white/5 border-white/10 lg:col-span-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
