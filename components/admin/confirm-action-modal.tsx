"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ConfirmActionModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
}

export function ConfirmActionModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
}: ConfirmActionModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError("Şifre gereklidir");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      // Get current user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Kullanıcı bilgisi alınamadı");
        return;
      }

      // Re-authenticate with password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        setError("Yanlış şifre. Lütfen tekrar deneyin.");
        return;
      }

      // Password verified, proceed with action
      setPassword("");
      onConfirm();
    } catch {
      setError("Doğrulama sırasında bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">
              Devam etmek için şifrenizi girin
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifreniz"
              className="mt-1"
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              İptal
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Onayla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
