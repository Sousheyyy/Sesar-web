"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  if (rangeStart > 2) {
    pages.push("ellipsis");
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < total - 1) {
    pages.push("ellipsis");
  }

  pages.push(total);

  return pages;
}

export function PaginationControl({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Önceki
      </Button>

      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="min-w-[36px]"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Sonraki
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="ml-2 text-sm text-muted-foreground">
        Sayfa {currentPage} / {totalPages}
      </span>
    </div>
  );
}
