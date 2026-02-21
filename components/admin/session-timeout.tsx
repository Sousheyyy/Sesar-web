"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SessionTimeoutProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export function SessionTimeout({
  timeoutMinutes = 30,
  warningMinutes = 1,
}: SessionTimeoutProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const warningMs = warningMinutes * 60 * 1000;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const handleLogout = useCallback(async () => {
    clearTimers();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(Math.floor(warningMs / 1000));

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningMs, handleLogout]);

  const resetTimer = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    lastActivityRef.current = Date.now();

    timeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, timeoutMs - warningMs);
  }, [timeoutMs, warningMs, startWarningCountdown]);

  const handleActivity = useCallback(() => {
    if (!showWarning) {
      const now = Date.now();
      // Throttle: only reset if last activity was more than 30s ago
      if (now - lastActivityRef.current > 30_000) {
        resetTimer();
      }
    }
  }, [showWarning, resetTimer]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
    ];

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      clearTimers();
    };
  }, [handleActivity, resetTimer]);

  const handleContinue = () => {
    resetTimer();
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s} saniye`;
  };

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Oturumunuz sona ermek üzere</DialogTitle>
          <DialogDescription>
            Uzun süredir herhangi bir işlem yapmadınız. Oturumunuz{" "}
            <span className="font-semibold text-foreground">
              {formatTime(secondsLeft)}
            </span>{" "}
            içinde sonlandırılacak.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLogout}>
            Çıkış Yap
          </Button>
          <Button onClick={handleContinue}>Devam Et</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
