"use client";

import { useState, useMemo, memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ExternalLink, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";

interface SubmissionWithCreator {
  id: string;
  tiktokUrl: string;
  status: string; // "PENDING" | "APPROVED" | "REJECTED"
  rejectionReason?: string | null;
  lastViewCount: number;
  lastLikeCount: number;
  lastShareCount: number;
  totalEarnings: number | string | any; // decimal
  estimatedEarnings: number | string | any; // decimal
  contributionPercent?: number;
  contributionPoints?: number; // Added contribution points
  creator: {
    name: string | null;
    tiktokHandle: string | null;
    avatar?: string | null;
  };
}

interface SubmissionsTableProps {
  submissions: SubmissionWithCreator[];
}

// Weights from PAYOUT_SYSTEM.md
const WEIGHTS = {
  VIEWS: 0.01,
  LIKES: 0.5,
  SHARES: 1,
};

type SortField = 
  | "name" 
  | "views" 
  | "likes" 
  | "shares" 
  | "points" 
  | "contribution" 
  | "earnings"
  | "status";

type SortDirection = "asc" | "desc";

export const SubmissionsTable = memo(function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    let filtered = submissions;

    // Filter by search query (creator name or TikTok handle)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = submissions.filter((sub) => {
        const name = sub.creator.name?.toLowerCase() || "";
        const handle = sub.creator.tiktokHandle?.toLowerCase() || "";
        return name.includes(query) || handle.includes(query);
      });
    }

    // Sort submissions
    const sorted = [...filtered].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case "name":
          aValue = a.creator.name?.toLowerCase() || "";
          bValue = b.creator.name?.toLowerCase() || "";
          break;
        case "views":
          aValue = a.lastViewCount || 0;
          bValue = b.lastViewCount || 0;
          break;
        case "likes":
          aValue = a.lastLikeCount || 0;
          bValue = b.lastLikeCount || 0;
          break;
        case "shares":
          aValue = a.lastShareCount || 0;
          bValue = b.lastShareCount || 0;
          break;
        case "points":
          aValue = a.contributionPoints || 0;
          bValue = b.contributionPoints || 0;
          break;
        case "contribution":
          aValue = a.contributionPercent || 0;
          bValue = b.contributionPercent || 0;
          break;
        case "earnings":
          const aEarnings = Number(a.totalEarnings) > 0 
            ? Number(a.totalEarnings) 
            : Number(a.estimatedEarnings) || 0;
          const bEarnings = Number(b.totalEarnings) > 0 
            ? Number(b.totalEarnings) 
            : Number(b.estimatedEarnings) || 0;
          aValue = aEarnings;
          bValue = bEarnings;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc" 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [submissions, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const getSortFieldLabel = (field: SortField): string => {
    switch (field) {
      case "name":
        return "İsim";
      case "views":
        return "İzlenme";
      case "likes":
        return "Beğeni";
      case "shares":
        return "Paylaşım";
      case "points":
        return "Puan";
      case "contribution":
        return "Katkı Payı";
      case "earnings":
        return "Kazanç";
      case "status":
        return "Durum";
      default:
        return "İsim";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Üretici adı veya TikTok kullanıcı adı ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Sırala: {getSortFieldLabel(sortField)}
              {getSortIcon(sortField)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleSort("name")} className="flex items-center justify-between">
              <span>İsim</span>
              {sortField === "name" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("views")} className="flex items-center justify-between">
              <span>İzlenme</span>
              {sortField === "views" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("likes")} className="flex items-center justify-between">
              <span>Beğeni</span>
              {sortField === "likes" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("shares")} className="flex items-center justify-between">
              <span>Paylaşım</span>
              {sortField === "shares" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("points")} className="flex items-center justify-between">
              <span>Puan</span>
              {sortField === "points" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("contribution")} className="flex items-center justify-between">
              <span>Katkı Payı</span>
              {sortField === "contribution" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("earnings")} className="flex items-center justify-between">
              <span>Kazanç</span>
              {sortField === "earnings" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("status")} className="flex items-center justify-between">
              <span>Durum</span>
              {sortField === "status" && (
                sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Üretici</TableHead>
            <TableHead className="text-center">Durum</TableHead>
            <TableHead className="text-right">İzlenme</TableHead>
            <TableHead className="text-right">Beğeni</TableHead>
            <TableHead className="text-right">Paylaşım</TableHead>
            <TableHead className="text-right">Katkı Puanı</TableHead>
            <TableHead className="text-right">Katkı Payı</TableHead>
            <TableHead className="text-right">Toplam Kazanç</TableHead>
            <TableHead className="text-right">Video</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedSubmissions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                {searchQuery ? "Arama sonucu bulunamadı." : "Henüz gönderi bulunmuyor."}
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedSubmissions.map((submission) => {
              // Calculate scores locally to determine split for points
              const viewPoints = submission.lastViewCount * WEIGHTS.VIEWS;
              const likePoints = submission.lastLikeCount * WEIGHTS.LIKES;
              const sharePoints = submission.lastShareCount * WEIGHTS.SHARES;
              // const totalPoints = viewPoints + likePoints + sharePoints; // This should match contributionPoints

              const earnings = Number(submission.totalEarnings) > 0 
                ? Number(submission.totalEarnings) 
                : Number(submission.estimatedEarnings) || 0;

              return (
                <TableRow key={submission.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={submission.creator.avatar || ""} />
                        <AvatarFallback>
                          {submission.creator.name?.slice(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {submission.creator.name || "İsimsiz"}
                        </span>
                        {submission.creator.tiktokHandle && (
                          <span className="text-xs text-muted-foreground">
                            @{submission.creator.tiktokHandle}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        submission.status === "APPROVED"
                          ? "success"
                          : submission.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {submission.status === "PENDING" && "BEKLEMEDE"}
                      {submission.status === "APPROVED" && "ONAYLANDI"}
                      {submission.status === "REJECTED" && "REDDEDİLDİ"}
                    </Badge>
                    {submission.status === "REJECTED" && submission.rejectionReason && (
                      <div
                        className="text-xs text-destructive mt-1 max-w-[150px] truncate mx-auto"
                        title={submission.rejectionReason}
                      >
                        {submission.rejectionReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span>{formatNumber(submission.lastViewCount)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatNumber(viewPoints)} tp
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span>{formatNumber(submission.lastLikeCount)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatNumber(likePoints)} tp
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                     <div className="flex flex-col items-end">
                      <span>{formatNumber(submission.lastShareCount)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatNumber(sharePoints)} tp
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(submission.contributionPoints || 0)} tp
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">
                      {submission.contributionPercent !== undefined
                        ? `%${submission.contributionPercent.toFixed(2)}` 
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(earnings)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        href={submission.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Videoyu Görüntüle</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
});
