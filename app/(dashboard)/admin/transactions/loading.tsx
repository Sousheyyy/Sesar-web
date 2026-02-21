import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className || ""}`} />;
}

export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-48 mb-1" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs placeholder */}
      <div>
        <Skeleton className="h-10 w-96 mb-4" />
      </div>

      {/* Filter cards */}
      <div className="grid gap-3 grid-cols-3 md:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center">
              <Skeleton className="h-3 w-12 mx-auto mb-2" />
              <Skeleton className="h-6 w-8 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex justify-between items-center">
            <div>
              <Skeleton className="h-6 w-24 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-80" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
