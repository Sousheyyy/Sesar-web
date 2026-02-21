"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PaginationControl } from "@/components/ui/pagination-control";

interface WalletPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function WalletPagination({ currentPage, totalPages }: WalletPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", page.toString());
    router.push(`/artist/wallet?${params.toString()}`);
  };

  return (
    <PaginationControl
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
    />
  );
}
