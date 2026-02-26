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
import { Music2, Calendar, DollarSign, Users, Loader2, ExternalLink } from "lucide-react";
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

type Campaign = {
  id: string;
  title: string;
  status: string;
  totalBudget: number;
  remainingBudget: number;
  startDate: string;
  endDate: string;
  _count: {
    submissions: number;
  };
};

interface ArtistDetailsModalProps {
  user: User;
  open: boolean;
  onClose: () => void;
}

export function ArtistDetailsModal({ user, open, onClose }: ArtistDetailsModalProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user.id) {
      fetchCampaigns();
    }
  }, [open, user.id]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/${user.id}/campaigns`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      COMPLETED: "default",
      CANCELLED: "destructive",
    };

    const labels: Record<string, string> = {
      ACTIVE: "Aktif",
      COMPLETED: "Tamamlandı",
      CANCELLED: "İptal Edildi",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl">Sanatçı Detayları</DialogTitle>
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

          {/* Stats Card */}
          <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kampanya</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Music2 className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaigns.length}</div>
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          <Card className="border-2 shadow-md">
            <CardHeader>
              <CardTitle>Kampanyalar</CardTitle>
              <CardDescription>Oluşturulan tüm kampanyalar</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Henüz kampanya bulunmuyor
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="min-w-[150px]">Başlık</TableHead>
                        <TableHead className="min-w-[100px]">Durum</TableHead>
                        <TableHead className="min-w-[120px]">Toplam Bütçe</TableHead>
                        <TableHead className="min-w-[120px]">Kalan Bütçe</TableHead>
                        <TableHead className="min-w-[120px]">Başlangıç</TableHead>
                        <TableHead className="min-w-[120px]">Bitiş</TableHead>
                        <TableHead className="min-w-[100px]">Gönderiler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.title}</TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(campaign.totalBudget || 0)}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(campaign.remainingBudget || 0)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(campaign.startDate)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(campaign.endDate)}
                          </TableCell>
                          <TableCell>{campaign._count.submissions}</TableCell>
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

