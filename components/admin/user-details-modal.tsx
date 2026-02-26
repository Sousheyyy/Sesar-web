"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Video,
  Music2,
  Loader2,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  TrendingUp,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  User as UserIcon,
  Plus,
  Minus,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  balance: number;
  followerCount: number;
  tiktokHandle: string | null;
  tiktokAvatarUrl: string | null;
  avatar: string | null;
  createdAt: string;
  _count: {
    campaigns: number;
    submissions: number;
    transactions: number;
  };
};

type Submission = {
  id: string;
  tiktokUrl: string;
  tiktokVideoId: string | null;
  status: string;
  verified: boolean;
  verifiedAt: string | null;
  videoDuration: number | null;
  lastViewCount: number;
  lastLikeCount: number;
  lastCommentCount: number;
  lastShareCount: number;
  totalEarnings: number;
  estimatedEarnings: number;
  payoutAmount: number | null;
  contributionPercent: number;
  createdAt: string;
  lastCheckedAt: string | null;
  campaign: { id: string; title: string; status: string };
  creator: {
    id: string;
    name: string | null;
    tiktokHandle: string | null;
    tiktokAvatarUrl: string | null;
  };
};

type Campaign = {
  id: string;
  title: string;
  status: string;
  totalBudget: number;
  remainingBudget: number;
  commissionPercent: number;
  durationDays: number;
  payoutStatus: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  completedAt: string | null;
  song: { id: string; title: string };
  _count: { submissions: number };
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  reference: string | null;
  notes: string | null;
  bankDetails: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
};

interface UserDetailsModalProps {
  user: User;
  open: boolean;
  onClose: () => void;
  onUserDeleted?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<string, string> = {
  CREATOR: "İçerik Üretici",
  ARTIST: "Sanatçı",
  ADMIN: "Yönetici",
};

const STATUS_BADGES: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  APPROVED: { variant: "default", label: "Onaylandı" },
  PENDING: { variant: "secondary", label: "Beklemede" },
  REJECTED: { variant: "destructive", label: "Reddedildi" },
  ACTIVE: { variant: "default", label: "Aktif" },
  COMPLETED: { variant: "secondary", label: "Tamamlandı" },
  CANCELLED: { variant: "destructive", label: "İptal Edildi" },
};

const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Yatırma",
  WITHDRAWAL: "Çekme",
  EARNING: "Kazanç",
  SPEND: "Harcama",
  REFUND: "İade",
  ADJUSTMENT: "Düzenleme",
};

const TX_STATUS_LABELS: Record<string, string> = {
  PENDING: "Beklemede",
  COMPLETED: "Tamamlandı",
  REJECTED: "Reddedildi",
};

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Beklemede",
  COMPLETED: "Tamamlandı",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function UserDetailsModal({
  user,
  open,
  onClose,
  onUserDeleted,
}: UserDetailsModalProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Balance adjustment state
  const [balancePopoverOpen, setBalancePopoverOpen] = useState(false);
  const [balanceAction, setBalanceAction] = useState<"add" | "deduct">("add");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(user.balance);

  // Reset displayBalance when user prop changes
  useEffect(() => {
    setDisplayBalance(user.balance);
  }, [user.balance]);

  const handleBalanceAdjust = async () => {
    const amount = parseFloat(balanceAmount);
    if (!amount || amount <= 0) {
      toast.error("Geçerli bir tutar girin");
      return;
    }

    setBalanceLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          type: balanceAction,
          reason: balanceReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Bakiye güncellenemedi");
        return;
      }

      setDisplayBalance(data.balance);
      toast.success(
        balanceAction === "add"
          ? `₺${amount.toLocaleString("tr-TR")} eklendi`
          : `₺${amount.toLocaleString("tr-TR")} düşüldü`
      );

      // Refresh transactions
      fetch(`/api/user/${user.id}/transactions`)
        .then((r) => r.json())
        .then((d) => setTransactions(d.transactions || []))
        .catch(() => {});

      setBalanceAmount("");
      setBalanceReason("");
      setBalancePopoverOpen(false);
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !user.id) return;
    setLoading(true);
    setShowDeleteConfirm(false);
    setDeleteError(null);

    const fetches: Promise<void>[] = [];

    // Fetch submissions — for creators: their videos; for artists: videos submitted to their campaigns
    const submScope = user.role === "ARTIST" ? "?scope=artist" : "";
    fetches.push(
      fetch(`/api/user/${user.id}/submissions${submScope}`)
        .then((r) => r.json())
        .then((d) => setSubmissions(d.data || []))
        .catch(() => setSubmissions([]))
    );

    // Fetch campaigns for artists
    if (user.role === "ARTIST") {
      fetches.push(
        fetch(`/api/user/${user.id}/campaigns`)
          .then((r) => r.json())
          .then((d) => setCampaigns(d.campaigns || []))
          .catch(() => setCampaigns([]))
      );
    }

    // Fetch transactions for all users
    fetches.push(
      fetch(`/api/user/${user.id}/transactions`)
        .then((r) => r.json())
        .then((d) => setTransactions(d.transactions || []))
        .catch(() => setTransactions([]))
    );

    Promise.all(fetches).finally(() => setLoading(false));
  }, [open, user.id, user.role]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Bir hata oluştu");
        return;
      }
      onClose();
      onUserDeleted?.();
    } catch {
      setDeleteError("Bağlantı hatası");
    } finally {
      setDeleting(false);
    }
  };

  /* derived values */
  const avatarUrl = user.tiktokAvatarUrl || user.avatar || null;
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const totalEarnings = submissions.reduce(
    (s, sub) => s + (sub.totalEarnings || 0),
    0
  );
  const totalViews = submissions.reduce((s, sub) => s + sub.lastViewCount, 0);
  const totalLikes = submissions.reduce((s, sub) => s + sub.lastLikeCount, 0);
  const totalShares = submissions.reduce((s, sub) => s + sub.lastShareCount, 0);

  // For creators — derive unique campaigns from submissions
  const creatorCampaigns = useMemo(() => {
    if (user.role !== "CREATOR") return [];
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        status: string;
        submissions: number;
        earnings: number;
        views: number;
      }
    >();
    for (const s of submissions) {
      const existing = map.get(s.campaign.id);
      if (existing) {
        existing.submissions += 1;
        existing.earnings += s.totalEarnings || 0;
        existing.views += s.lastViewCount;
      } else {
        map.set(s.campaign.id, {
          id: s.campaign.id,
          title: s.campaign.title,
          status: s.campaign.status,
          submissions: 1,
          earnings: s.totalEarnings || 0,
          views: s.lastViewCount,
        });
      }
    }
    return Array.from(map.values());
  }, [submissions, user.role]);

  const totalBudgetSpent = campaigns.reduce(
    (s, c) => s + (c.totalBudget - c.remainingBudget),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white/10">
              <AvatarImage
                src={avatarUrl || undefined}
                alt={user.name || "User"}
              />
              <AvatarFallback className="text-lg bg-white/10 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <DialogTitle className="text-xl truncate">
                  {user.name || user.email}
                </DialogTitle>
                <Badge
                  variant={
                    user.role === "ADMIN"
                      ? "default"
                      : user.role === "ARTIST"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>
              <DialogDescription className="text-sm">
                {user.email}
                {user.tiktokHandle && (
                  <>
                    {" "}
                    &middot;{" "}
                    <a
                      href={`https://www.tiktok.com/@${user.tiktokHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      @{user.tiktokHandle}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
                {" "}&middot; Kayıt: {formatDate(user.createdAt)}
              </DialogDescription>
            </div>
            {/* Delete button — always visible in header */}
            {user.role !== "ADMIN" && (
              <div className="shrink-0">
                {!showDeleteConfirm ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Sil</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    {deleteError && (
                      <span className="text-xs text-red-500">{deleteError}</span>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="gap-1"
                    >
                      {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                      Evet, Sil
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteError(null);
                      }}
                      disabled={deleting}
                    >
                      İptal
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                <UserIcon className="w-3.5 h-3.5 hidden sm:block" /> Genel Bakış
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-1.5 text-xs sm:text-sm">
                <Video className="w-3.5 h-3.5 hidden sm:block" /> Videolar
                {submissions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {submissions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-1.5 text-xs sm:text-sm">
                <Music2 className="w-3.5 h-3.5 hidden sm:block" /> Kampanyalar
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1.5 text-xs sm:text-sm">
                <Wallet className="w-3.5 h-3.5 hidden sm:block" /> İşlemler
                {transactions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {transactions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ============ OVERVIEW TAB ============ */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Popover open={balancePopoverOpen} onOpenChange={setBalancePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Wallet className="w-3 h-3" /> Bakiye
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(displayBalance)}
                        </p>
                      </CardContent>
                    </Card>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-1">Bakiye Düzenleme</h4>
                        <p className="text-xs text-muted-foreground">
                          Mevcut: {formatCurrency(displayBalance)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={balanceAction === "add" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => setBalanceAction("add")}
                        >
                          <Plus className="w-3 h-3" /> Ekle
                        </Button>
                        <Button
                          variant={balanceAction === "deduct" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => setBalanceAction("deduct")}
                        >
                          <Minus className="w-3 h-3" /> Düş
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="balance-amount" className="text-xs">Tutar (₺)</Label>
                        <Input
                          id="balance-amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          value={balanceAmount}
                          onChange={(e) => setBalanceAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="balance-reason" className="text-xs">Sebep (opsiyonel)</Label>
                        <Textarea
                          id="balance-reason"
                          placeholder="Açıklama..."
                          rows={2}
                          value={balanceReason}
                          onChange={(e) => setBalanceReason(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleBalanceAdjust}
                        disabled={balanceLoading || !balanceAmount || parseFloat(balanceAmount) <= 0}
                      >
                        {balanceLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {balanceAction === "add" ? "Bakiye Ekle" : "Bakiye Düş"}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Takipçi
                    </p>
                    <p className="text-lg font-bold">
                      {formatNumber(user.followerCount)}
                    </p>
                  </CardContent>
                </Card>
                {user.role === "CREATOR" && (
                  <>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Video className="w-3 h-3" /> Toplam Video
                        </p>
                        <p className="text-lg font-bold">{submissions.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ArrowDownLeft className="w-3 h-3" /> Toplam Kazanç
                        </p>
                        <p className="text-lg font-bold text-green-500">
                          {formatCurrency(totalEarnings)}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
                {user.role === "ARTIST" && (
                  <>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Music2 className="w-3 h-3" /> Kampanyalar
                        </p>
                        <p className="text-lg font-bold">{campaigns.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> Toplam Harcama
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(totalBudgetSpent)}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
                {user.role === "ADMIN" && (
                  <>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Kayıt Tarihi
                        </p>
                        <p className="text-sm font-bold">
                          {formatDate(user.createdAt)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" /> İşlemler
                        </p>
                        <p className="text-lg font-bold">
                          {transactions.length}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Engagement Summary — for users with submissions */}
              {submissions.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-3 pb-2 px-4">
                      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Toplam Görüntülenme
                      </p>
                      <p className="text-base font-bold">
                        {formatNumber(totalViews)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2 px-4">
                      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Heart className="w-3 h-3" /> Toplam Beğeni
                      </p>
                      <p className="text-base font-bold">
                        {formatNumber(totalLikes)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2 px-4">
                      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> Toplam Paylaşım
                      </p>
                      <p className="text-base font-bold">
                        {formatNumber(totalShares)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-2 px-4">
                      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> İşlemler
                      </p>
                      <p className="text-base font-bold">
                        {transactions.length}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

            </TabsContent>

            {/* ============ VIDEOS TAB ============ */}
            <TabsContent value="videos" className="mt-4">
              {submissions.length === 0 ? (
                <EmptyState icon={Video} text="Henüz video gönderisi yok" />
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {user.role === "ARTIST" && (
                          <TableHead className="min-w-[130px]">Creator</TableHead>
                        )}
                        <TableHead className="min-w-[140px]">Kampanya</TableHead>
                        <TableHead className="min-w-[80px]">Durum</TableHead>
                        <TableHead className="min-w-[80px] text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Eye className="w-3 h-3" /> Görüntülenme
                          </span>
                        </TableHead>
                        <TableHead className="min-w-[70px] text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Heart className="w-3 h-3" /> Beğeni
                          </span>
                        </TableHead>
                        <TableHead className="min-w-[70px] text-right">
                          <span className="flex items-center justify-end gap-1">
                            <MessageCircle className="w-3 h-3" /> Yorum
                          </span>
                        </TableHead>
                        <TableHead className="min-w-[70px] text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Share2 className="w-3 h-3" /> Paylaşım
                          </span>
                        </TableHead>
                        <TableHead className="min-w-[90px] text-right">
                          Kazanç
                        </TableHead>
                        <TableHead className="min-w-[70px] text-right">
                          Katkı %
                        </TableHead>
                        <TableHead className="min-w-[90px]">Tarih</TableHead>
                        <TableHead className="min-w-[60px]">Video</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((s) => (
                        <TableRow key={s.id}>
                          {user.role === "ARTIST" && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={
                                      s.creator.tiktokAvatarUrl || undefined
                                    }
                                  />
                                  <AvatarFallback className="text-[10px]">
                                    {(
                                      s.creator.name ||
                                      s.creator.tiktokHandle ||
                                      "?"
                                    )
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm truncate max-w-[100px]">
                                  {s.creator.tiktokHandle
                                    ? `@${s.creator.tiktokHandle}`
                                    : s.creator.name || "—"}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="font-medium text-sm truncate max-w-[160px]">
                            {s.campaign.title}
                          </TableCell>
                          <TableCell>
                            <SubmissionStatusBadge status={s.status} verified={s.verified} />
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatNumber(s.lastViewCount)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatNumber(s.lastLikeCount)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatNumber(s.lastCommentCount)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatNumber(s.lastShareCount)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-green-500 tabular-nums">
                            {formatCurrency(s.totalEarnings)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                            {s.contributionPercent > 0
                              ? `${s.contributionPercent.toFixed(1)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(s.createdAt)}
                          </TableCell>
                          <TableCell>
                            <a
                              href={s.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary bar */}
              {submissions.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mt-3 px-1 text-xs text-muted-foreground">
                  <span>
                    Toplam: <strong className="text-foreground">{submissions.length}</strong> video
                  </span>
                  <span>
                    Görüntülenme: <strong className="text-foreground">{formatNumber(totalViews)}</strong>
                  </span>
                  <span>
                    Beğeni: <strong className="text-foreground">{formatNumber(totalLikes)}</strong>
                  </span>
                  <span>
                    Kazanç: <strong className="text-green-500">{formatCurrency(totalEarnings)}</strong>
                  </span>
                </div>
              )}
            </TabsContent>

            {/* ============ CAMPAIGNS TAB ============ */}
            <TabsContent value="campaigns" className="mt-4">
              {user.role === "ARTIST" ? (
                <ArtistCampaignsTab campaigns={campaigns} />
              ) : user.role === "CREATOR" ? (
                <CreatorCampaignsTab campaigns={creatorCampaigns} />
              ) : (
                <EmptyState icon={Music2} text="Bu kullanıcının kampanya verisi yok" />
              )}
            </TabsContent>

            {/* ============ TRANSACTIONS TAB ============ */}
            <TabsContent value="transactions" className="mt-4">
              {transactions.length === 0 ? (
                <EmptyState icon={Wallet} text="Henüz işlem bulunmuyor" />
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="min-w-[90px]">Tür</TableHead>
                        <TableHead className="min-w-[100px] text-right">
                          Tutar
                        </TableHead>
                        <TableHead className="min-w-[90px]">Durum</TableHead>
                        <TableHead className="min-w-[160px]">
                          Açıklama
                        </TableHead>
                        <TableHead className="min-w-[100px]">Referans</TableHead>
                        <TableHead className="min-w-[100px]">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => {
                        const isIncome =
                          t.type === "EARNING" ||
                          t.type === "DEPOSIT" ||
                          t.type === "REFUND" ||
                          (t.type === "ADJUSTMENT" && t.description?.includes("ekleme"));
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">
                              <span className="flex items-center gap-1.5">
                                {isIncome ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                                )}
                                {TX_TYPE_LABELS[t.type] || t.type}
                              </span>
                            </TableCell>
                            <TableCell
                              className={`text-sm font-semibold text-right tabular-nums ${
                                isIncome ? "text-green-500" : "text-red-500"
                              }`}
                            >
                              {isIncome ? "+" : "-"}
                              {formatCurrency(t.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  t.status === "COMPLETED"
                                    ? "default"
                                    : t.status === "REJECTED"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className="text-xs"
                              >
                                {TX_STATUS_LABELS[t.status] || t.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {t.description || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">
                              {t.reference || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(t.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary bar */}
              {transactions.length > 0 && (
                <TransactionSummary transactions={transactions} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SubmissionStatusBadge({
  status,
  verified,
}: {
  status: string;
  verified: boolean;
}) {
  if (status === "APPROVED" && verified) {
    return (
      <Badge variant="default" className="text-xs gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Doğrulandı
      </Badge>
    );
  }
  if (status === "APPROVED") {
    return (
      <Badge variant="default" className="text-xs">
        Onaylandı
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <XCircle className="w-3 h-3" />
        Reddedildi
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs gap-1">
      <Clock className="w-3 h-3" />
      Beklemede
    </Badge>
  );
}

function ArtistCampaignsTab({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return <EmptyState icon={Music2} text="Henüz kampanya oluşturulmamış" />;
  }

  const totalBudget = campaigns.reduce((s, c) => s + c.totalBudget, 0);
  const totalRemaining = campaigns.reduce((s, c) => s + c.remainingBudget, 0);
  const totalSubs = campaigns.reduce((s, c) => s + c._count.submissions, 0);

  return (
    <>
      <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[140px]">Kampanya</TableHead>
              <TableHead className="min-w-[100px]">Şarkı</TableHead>
              <TableHead className="min-w-[80px]">Durum</TableHead>
              <TableHead className="min-w-[90px] text-right">Bütçe</TableHead>
              <TableHead className="min-w-[90px] text-right">Kalan</TableHead>
              <TableHead className="min-w-[60px] text-right">
                Komisyon
              </TableHead>
              <TableHead className="min-w-[70px] text-right">
                Gönderiler
              </TableHead>
              <TableHead className="min-w-[70px]">Ödeme</TableHead>
              <TableHead className="min-w-[90px]">Başlangıç</TableHead>
              <TableHead className="min-w-[90px]">Bitiş</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm truncate max-w-[160px]">
                  {c.title}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">
                  {c.song?.title || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      STATUS_BADGES[c.status]?.variant || "outline"
                    }
                    className="text-xs"
                  >
                    {STATUS_BADGES[c.status]?.label || c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {formatCurrency(c.totalBudget)}
                </TableCell>
                <TableCell className="text-right text-sm text-primary tabular-nums">
                  {formatCurrency(c.remainingBudget)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  %{c.commissionPercent}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {c._count.submissions}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      c.payoutStatus === "COMPLETED" ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {PAYOUT_STATUS_LABELS[c.payoutStatus] || c.payoutStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.startDate ? formatDate(c.startDate) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.endDate ? formatDate(c.endDate) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3 px-1 text-xs text-muted-foreground">
        <span>
          Toplam: <strong className="text-foreground">{campaigns.length}</strong>{" "}
          kampanya
        </span>
        <span>
          Bütçe: <strong className="text-foreground">{formatCurrency(totalBudget)}</strong>
        </span>
        <span>
          Kalan: <strong className="text-primary">{formatCurrency(totalRemaining)}</strong>
        </span>
        <span>
          Gönderiler: <strong className="text-foreground">{totalSubs}</strong>
        </span>
      </div>
    </>
  );
}

function CreatorCampaignsTab({
  campaigns,
}: {
  campaigns: {
    id: string;
    title: string;
    status: string;
    submissions: number;
    earnings: number;
    views: number;
  }[];
}) {
  if (campaigns.length === 0) {
    return <EmptyState icon={Music2} text="Henüz kampanyaya katılım yok" />;
  }

  const totalEarnings = campaigns.reduce((s, c) => s + c.earnings, 0);

  return (
    <>
      <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[180px]">Kampanya</TableHead>
              <TableHead className="min-w-[80px]">Durum</TableHead>
              <TableHead className="min-w-[80px] text-right">
                Video Sayısı
              </TableHead>
              <TableHead className="min-w-[100px] text-right">
                Görüntülenme
              </TableHead>
              <TableHead className="min-w-[100px] text-right">
                Kazanç
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm truncate max-w-[200px]">
                  {c.title}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      STATUS_BADGES[c.status]?.variant || "outline"
                    }
                    className="text-xs"
                  >
                    {STATUS_BADGES[c.status]?.label || c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {c.submissions}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(c.views)}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold text-green-500 tabular-nums">
                  {formatCurrency(c.earnings)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3 px-1 text-xs text-muted-foreground">
        <span>
          Toplam: <strong className="text-foreground">{campaigns.length}</strong>{" "}
          kampanya
        </span>
        <span>
          Kazanç:{" "}
          <strong className="text-green-500">{formatCurrency(totalEarnings)}</strong>
        </span>
      </div>
    </>
  );
}

function TransactionSummary({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const income = transactions
    .filter(
      (t) =>
        t.status === "COMPLETED" &&
        (t.type === "EARNING" || t.type === "DEPOSIT" || t.type === "REFUND")
    )
    .reduce((s, t) => s + t.amount, 0);

  const expense = transactions
    .filter(
      (t) =>
        t.status === "COMPLETED" &&
        (t.type === "WITHDRAWAL" || t.type === "SPEND")
    )
    .reduce((s, t) => s + t.amount, 0);

  const pending = transactions.filter((t) => t.status === "PENDING").length;

  return (
    <div className="flex flex-wrap items-center gap-4 mt-3 px-1 text-xs text-muted-foreground">
      <span>
        Toplam: <strong className="text-foreground">{transactions.length}</strong>{" "}
        işlem
      </span>
      <span>
        Gelir: <strong className="text-green-500">{formatCurrency(income)}</strong>
      </span>
      <span>
        Gider: <strong className="text-red-500">{formatCurrency(expense)}</strong>
      </span>
      {pending > 0 && (
        <span>
          Bekleyen: <strong className="text-yellow-500">{pending}</strong>
        </span>
      )}
    </div>
  );
}
