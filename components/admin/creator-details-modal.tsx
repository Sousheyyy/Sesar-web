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
import { DollarSign, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
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
  totalEarnings: number;
  contributionPercent: number;
  status: string;
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
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalContribution, setTotalContribution] = useState(0);

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
        setSubmissions(data.submissions || []);
        
        // Calculate totals
        const earnings = (data.submissions || []).reduce(
          (sum: number, sub: Submission) => sum + (sub.totalEarnings || 0),
          0
        );
        const contribution = (data.submissions || []).reduce(
          (sum: number, sub: Submission) => sum + (sub.contributionPercent || 0),
          0
        );
        
        setTotalEarnings(earnings);
        setTotalContribution(contribution);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

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
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Kazanç</CardTitle>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalEarnings)}</div>
              </CardContent>
            </Card>
            <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Katkı</CardTitle>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalContribution.toFixed(2)}%</div>
              </CardContent>
            </Card>
            <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Gönderi</CardTitle>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{submissions.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Submissions Table */}
          <Card className="border-2 shadow-md">
            <CardHeader>
              <CardTitle>Gönderiler</CardTitle>
              <CardDescription>Tüm video gönderileri ve kazançları</CardDescription>
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
                        <TableHead className="min-w-[120px]">TikTok URL</TableHead>
                        <TableHead className="min-w-[100px]">Kazanç</TableHead>
                        <TableHead className="min-w-[80px]">Katkı %</TableHead>
                        <TableHead className="min-w-[100px]">Durum</TableHead>
                        <TableHead className="min-w-[120px]">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {submission.campaign.title}
                          </TableCell>
                          <TableCell>
                            <a
                              href={submission.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              Video
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(submission.totalEarnings || 0)}
                          </TableCell>
                          <TableCell>
                            {submission.contributionPercent.toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                submission.status === "APPROVED"
                                  ? "default"
                                  : submission.status === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {submission.status === "APPROVED"
                                ? "Onaylandı"
                                : submission.status === "REJECTED"
                                ? "Reddedildi"
                                : "Beklemede"}
                            </Badge>
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

