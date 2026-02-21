import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className || ""}`} />;
}

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-52 mb-1" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex justify-between items-center">
            <div>
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-10 w-80" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
