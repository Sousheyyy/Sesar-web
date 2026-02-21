import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";
import { formatNumber, formatCurrency, cn } from "@/lib/utils";

interface Creator {
  name: string;
  handle: string | null;
  avatar: string | null;
  points: number;
  sharePercent: number;
  estimatedEarnings: number;
}

interface TopCreatorsCardProps {
  creators: Creator[];
}

const rankColors = [
  "text-yellow-400",
  "text-zinc-300",
  "text-amber-600",
  "text-zinc-500",
  "text-zinc-500",
];

export function TopCreatorsCard({ creators }: TopCreatorsCardProps) {
  if (creators.length === 0) {
    return (
      <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            En İyi Üreticiler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500 text-center py-6">Henüz gönderi yok</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          En İyi Üreticiler
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {creators.map((creator, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/[0.03] transition-colors"
          >
            <span className={cn("text-sm font-bold w-5 text-center", rankColors[index] || "text-zinc-500")}>
              {index + 1}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={creator.avatar || ""} />
              <AvatarFallback className="bg-white/10 text-xs">
                {creator.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{creator.name}</p>
              {creator.handle && (
                <p className="text-xs text-zinc-500 truncate">@{creator.handle}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-white">
                {formatNumber(creator.points)} tp
              </p>
              <p className="text-xs text-zinc-500">
                %{creator.sharePercent.toFixed(1)} &middot; {formatCurrency(creator.estimatedEarnings)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
