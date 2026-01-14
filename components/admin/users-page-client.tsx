"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Users, Music2, Video, Shield, ExternalLink } from "lucide-react";
import { UserRole } from "@prisma/client";
import { CreatorDetailsModal } from "@/components/admin/creator-details-modal";
import { ArtistDetailsModal } from "@/components/admin/artist-details-modal";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  balance: number;
  tiktokHandle: string | null;
  createdAt: string;
  _count: {
    campaigns: number;
    submissions: number;
    transactions: number;
  };
};

type Stats = {
  total: number;
  artists: number;
  creators: number;
  admins: number;
};

interface UsersPageClientProps {
  users: User[];
  stats: Stats;
}

export function UsersPageClient({ users, stats }: UsersPageClientProps) {
  const [activeFilters, setActiveFilters] = useState<UserRole[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<"creator" | "artist" | null>(null);

  const filteredUsers = useMemo(() => {
    if (activeFilters.length === 0) return users;
    return users.filter((user) => activeFilters.includes(user.role));
  }, [users, activeFilters]);

  const toggleFilter = (role: UserRole) => {
    setActiveFilters((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleUserClick = (user: User) => {
    if (user.role === "CREATOR") {
      setSelectedUser(user);
      setModalType("creator");
    } else if (user.role === "ARTIST") {
      setSelectedUser(user);
      setModalType("artist");
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType(null);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kullanıcı Yönetimi</h2>
          <p className="text-muted-foreground">
            Tüm platform kullanıcılarını görüntüleyin ve yönetin
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
              activeFilters.length === 0 && "ring-2 ring-primary border-primary shadow-md"
            )}
            onClick={() => setActiveFilters([])}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                activeFilters.length === 0 ? "bg-primary/20" : "bg-muted"
              )}>
                <Users className={cn(
                  "h-5 w-5",
                  activeFilters.length === 0 ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
              activeFilters.includes("ARTIST") && "ring-2 ring-primary border-primary bg-primary/5 shadow-md"
            )}
            onClick={() => toggleFilter("ARTIST")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sanatçılar</CardTitle>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                activeFilters.includes("ARTIST") ? "bg-primary/20" : "bg-muted"
              )}>
                <Music2 className={cn(
                  "h-5 w-5",
                  activeFilters.includes("ARTIST") ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.artists}</div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
              activeFilters.includes("CREATOR") && "ring-2 ring-primary border-primary bg-primary/5 shadow-md"
            )}
            onClick={() => toggleFilter("CREATOR")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">İçerik Üreticiler</CardTitle>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                activeFilters.includes("CREATOR") ? "bg-primary/20" : "bg-muted"
              )}>
                <Video className={cn(
                  "h-5 w-5",
                  activeFilters.includes("CREATOR") ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.creators}</div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
              activeFilters.includes("ADMIN") && "ring-2 ring-primary border-primary bg-primary/5 shadow-md"
            )}
            onClick={() => toggleFilter("ADMIN")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yöneticiler</CardTitle>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                activeFilters.includes("ADMIN") ? "bg-primary/20" : "bg-muted"
              )}>
                <Shield className={cn(
                  "h-5 w-5",
                  activeFilters.includes("ADMIN") ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.admins}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-xl">Tüm Kullanıcılar</CardTitle>
            <CardDescription>
              {activeFilters.length > 0
                ? `${filteredUsers.length} kullanıcı gösteriliyor`
                : "Kayıtlı kullanıcıların tam listesi"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold min-w-[120px]">İsim</TableHead>
                    <TableHead className="font-semibold min-w-[180px]">Email</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">TikTok</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Rol</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Bakiye</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Kampanyalar</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Gönderiler</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">Katılım Tarihi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground/50" />
                          <p>Kullanıcı bulunamadı</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        className={cn(
                          "transition-all",
                          (user.role === "CREATOR" || user.role === "ARTIST") &&
                            "cursor-pointer hover:bg-muted/70 active:bg-muted"
                        )}
                        onClick={() => handleUserClick(user)}
                      >
                        <TableCell className="font-medium">
                          {user.name || "İsimsiz"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {user.tiktokHandle ? (
                            <a
                              href={`https://www.tiktok.com/@${user.tiktokHandle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{user.tiktokHandle}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Bağlı değil</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === "ADMIN"
                                ? "default"
                                : user.role === "ARTIST"
                                ? "secondary"
                                : "outline"
                            }
                            className="font-medium"
                          >
                            {user.role === "ADMIN"
                              ? "Yönetici"
                              : user.role === "ARTIST"
                              ? "Sanatçı"
                              : "İçerik Üretici"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(user.balance)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{user._count.campaigns}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{user._count.submissions}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {modalType === "creator" && selectedUser && (
        <CreatorDetailsModal user={selectedUser} open={true} onClose={closeModal} />
      )}

      {modalType === "artist" && selectedUser && (
        <ArtistDetailsModal user={selectedUser} open={true} onClose={closeModal} />
      )}
    </>
  );
}

