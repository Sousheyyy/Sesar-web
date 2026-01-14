"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface TransactionApprovalButtonProps {
  transactionId: string;
  action: "approve" | "reject";
}

export function TransactionApprovalButton({
  transactionId,
  action,
}: TransactionApprovalButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/transactions/${transactionId}/${action}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `İşlem ${action === "approve" ? "onaylama" : "reddetme"} başarısız oldu`);
      }

      toast.success(`İşlem başarıyla ${action === "approve" ? "onaylandı" : "reddedildi"}`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || `İşlem ${action === "approve" ? "onaylama" : "reddetme"} başarısız oldu`);
    } finally {
      setIsLoading(false);
    }
  };

  if (action === "approve") {
    return (
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className="gap-2"
        size="sm"
      >
        <Check className="h-4 w-4" />
        {isLoading ? "Onaylanıyor..." : "Onayla"}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant="destructive"
      className="gap-2"
      size="sm"
    >
      <X className="h-4 w-4" />
      {isLoading ? "Reddediliyor..." : "Reddet"}
    </Button>
  );
}


