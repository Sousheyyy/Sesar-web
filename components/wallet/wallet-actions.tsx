"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDownCircle, Clock } from "lucide-react";

export function WalletActions() {
  const [depositOpen, setDepositOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setDepositOpen(true)} className="gap-2">
        <ArrowDownCircle className="h-4 w-4" />
        Para Yatır
      </Button>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto mb-2 rounded-full bg-purple-500/10 p-3 w-fit">
              <Clock className="h-8 w-8 text-purple-400" />
            </div>
            <DialogTitle>Yakında Geliyor</DialogTitle>
            <DialogDescription className="pt-2">
              Para yatırma özelliği çok yakında aktif olacaktır. Güncellemeler için takipte kalın!
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="outline"
            onClick={() => setDepositOpen(false)}
            className="mt-2"
          >
            Tamam
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
