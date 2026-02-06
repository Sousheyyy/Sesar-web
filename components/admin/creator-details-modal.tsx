"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Video, Loader2, ExternalLink } from "lucide-react";
import { UserRole } from "@prisma/client";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  balance: any;
  tiktokHandle: string | null;
  createdAt: string | Date;
  _count: {
    campaigns: number;
    submissions: number;
    transactions: number;
  };
};

type Submission = {
  id: string;
  tiktokUrl: string;
  status: string;
  totalEarnings: number;
  contributionPercent?: number;
  createdAt: string;
  campaign: {
    title: string;
  };
};

interface CreatorDetailsModalProps {
  user: User;
  open: boolean;
  onClose: () => void;
}

export function CreatorDetailsModal({ user, open, onClose }: CreatorDetailsModalProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user.id) {
      fetchSubmissions();
    }
  }, [open, user.id]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/${user.id}/submissions`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      APPROVED: "default",
      PENDING: "secondary",
      REJECTED: "destructive",
      PENDING_REVIEW: "outline",
    };

    const labels: Record<string, string> = {
      APPROVED: "Onaylandı",
      PENDING: "Beklemede",
      REJECTED: "Reddedildi",
      PENDING_REVIEW: "İnceleniyor",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const totalEarnings = submissions.reduce((sum, s) => sum + (s.totalEarnings || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl">İçerik Üretici Detayları</DialogTitle>
          <DialogDescription className="text-base">
            {user.name || "İsimsiz"} - {user.tiktokHandle ? `@${user.tiktokHandle}` : "Bağlı değil"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <Card className="border-2 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Kullanıcı Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">İsim</p>
                <p className="font-medium">{user.name || "İsimsiz"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TikTok Kullanıcı Adı</p>
                <p className="font-medium">
                  {user.tiktokHandle ? (
                    <a
                      href={`https://www.tiktok.com/@${user.tiktokHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      @{user.tiktokHandle}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "Bağlı değil"
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bakiye</p>
                <p className="font-medium text-primary">
                  {formatCurrency(Number(user.balance))}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Gönderi</CardTitle>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Video className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{submissions.length}</div>
              </CardContent>
            </Card>
            <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Kazanç</CardTitle>
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-600 font-bold">₺</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalEarnings)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submissions Table */}
          <Card className="border-2 shadow-md">
            <CardHeader>
              <CardTitle>Gönderiler</CardTitle>
              <CardDescription>Tüm video gönderimleri</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Henüz gönderi bulunmuyor
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="min-w-[150px]">Kampanya</TableHead>
                        <TableHead className="min-w-[200px]">Video</TableHead>
                        <TableHead className="min-w-[100px]">Durum</TableHead>
                        <TableHead className="min-w-[100px]">Kazanç</TableHead>
                        <TableHead className="min-w-[120px]">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {submission.campaign?.title || "Bilinmiyor"}
                          </TableCell>
                          <TableCell>
                            <a
                              href={submission.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 truncate max-w-[200px]"
                            >
                              {submission.tiktokUrl}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>{getStatusBadge(submission.status)}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(submission.totalEarnings || 0)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(submission.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
