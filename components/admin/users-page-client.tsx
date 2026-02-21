"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Users,
  Music2,
  Video,
  Shield,
  ExternalLink,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { UserDetailsModal } from "@/components/admin/user-details-modal";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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

type Stats = {
  total: number;
  artists: number;
  creators: number;
  admins: number;
};

type SortField = "balance" | "campaigns" | "submissions" | "followerCount";
type SortDir = "asc" | "desc";

const ROWS_PER_PAGE = 250;

interface UsersPageClientProps {
  users: User[];
  stats: Stats;
}

export function UsersPageClient({ users, stats }: UsersPageClientProps) {
  const router = useRouter();
  const [activeFilters, setActiveFilters] = useState<UserRole[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const toggleFilter = (role: UserRole) => {
    setActiveFilters((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const filteredAndSorted = useMemo(() => {
    let result = users;

    if (activeFilters.length > 0) {
      result = result.filter((u) => activeFilters.includes(u.role));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.tiktokHandle && u.tiktokHandle.toLowerCase().includes(q))
      );
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: number, bVal: number;
        switch (sortField) {
          case "balance":
            aVal = a.balance;
            bVal = b.balance;
            break;
          case "campaigns":
            aVal = a._count.campaigns;
            bVal = b._count.campaigns;
            break;
          case "submissions":
            aVal = a._count.submissions;
            bVal = b._count.submissions;
            break;
          case "followerCount":
            aVal = a.followerCount;
            bVal = b.followerCount;
            break;
          default:
            return 0;
        }
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
    }

    return result;
  }, [users, activeFilters, searchQuery, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ROWS_PER_PAGE));
  const paginatedUsers = useMemo(
    () => filteredAndSorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredAndSorted, page]
  );

  const handleUserDeleted = useCallback(() => {
    setSelectedUser(null);
    router.refresh();
  }, [router]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />;
    return sortDir === "desc" ? (
      <ChevronDown className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ChevronUp className="w-3.5 h-3.5 text-primary" />
    );
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

        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2",
              activeFilters.length === 0 && "ring-2 ring-primary border-primary shadow-md"
            )}
            onClick={() => { setActiveFilters([]); setPage(1); }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", activeFilters.length === 0 ? "bg-primary/20" : "bg-muted")}>
                <Users className={cn("h-5 w-5", activeFilters.length === 0 ? "text-primary" : "text-muted-foreground")} />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card
            className={cn("cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2", activeFilters.includes("ARTIST") && "ring-2 ring-primary border-primary bg-primary/5 shadow-md")}
            onClick={() => toggleFilter("ARTIST")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sanatçılar</CardTitle>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", activeFilters.includes("ARTIST") ? "bg-primary/20" : "bg-muted")}>
                <Music2 className={cn("h-5 w-5", activeFilters.includes("ARTIST") ? "text-primary" : "text-muted-foreground")} />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.artists}</div></CardContent>
          </Card>
          <Card
            className={cn("cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2", activeFilters.includes("CREATOR") && "ring-2 ring-primary border-primary bg-primary/5 shadow-md")}
            onClick={() => toggleFilter("CREATOR")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">İçerik Üreticiler</CardTitle>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", activeFilters.includes("CREATOR") ? "bg-primary/20" : "bg-muted")}>
                <Video className={cn("h-5 w-5", activeFilters.includes("CREATOR") ? "text-primary" : "text-muted-foreground")} />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.creators}</div></CardContent>
          </Card>
          <Card
            className={cn("cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2", activeFilters.includes("ADMIN") && "ring-2 ring-primary border-primary bg-primary/5 shadow-md")}
            onClick={() => toggleFilter("ADMIN")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yöneticiler</CardTitle>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", activeFilters.includes("ADMIN") ? "bg-primary/20" : "bg-muted")}>
                <Shield className={cn("h-5 w-5", activeFilters.includes("ADMIN") ? "text-primary" : "text-muted-foreground")} />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.admins}</div></CardContent>
          </Card>
        </div>

        {/* Table Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Tüm Kullanıcılar</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredAndSorted.length} kullanıcı gösteriliyor
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Email, isim veya TikTok ara..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold min-w-[220px]">Email</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">TikTok</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Rol</TableHead>
                    <TableHead
                      className="font-semibold min-w-[100px] cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort("followerCount")}
                    >
                      <span className="flex items-center gap-1">Takipçi <SortIcon field="followerCount" /></span>
                    </TableHead>
                    <TableHead
                      className="font-semibold min-w-[100px] cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort("balance")}
                    >
                      <span className="flex items-center gap-1">Bakiye <SortIcon field="balance" /></span>
                    </TableHead>
                    <TableHead
                      className="font-semibold min-w-[110px] cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort("campaigns")}
                    >
                      <span className="flex items-center gap-1">Kampanyalar <SortIcon field="campaigns" /></span>
                    </TableHead>
                    <TableHead
                      className="font-semibold min-w-[100px] cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort("submissions")}
                    >
                      <span className="flex items-center gap-1">Gönderiler <SortIcon field="submissions" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground/50" />
                          <p>Kullanıcı bulunamadı</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => {
                      const avatarUrl = user.tiktokAvatarUrl || user.avatar || null;
                      const initials = (user.name || user.email).slice(0, 2).toUpperCase();
                      return (
                        <TableRow
                          key={user.id}
                          className="cursor-pointer hover:bg-muted/70 active:bg-muted transition-all"
                          onClick={() => setSelectedUser(user)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarUrl || undefined} alt={user.name || "User"} />
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.tiktokHandle ? (
                              <a
                                href={`https://www.tiktok.com/@${user.tiktokHandle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                @{user.tiktokHandle}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.role === "ADMIN" ? "default" : user.role === "ARTIST" ? "secondary" : "outline"}
                              className="font-medium text-xs"
                            >
                              {user.role === "ADMIN" ? "Yönetici" : user.role === "ARTIST" ? "Sanatçı" : "Creator"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatNumber(user.followerCount)}</TableCell>
                          <TableCell className="font-semibold text-primary text-sm">{formatCurrency(user.balance)}</TableCell>
                          <TableCell className="text-sm font-medium">{user._count.campaigns}</TableCell>
                          <TableCell className="text-sm font-medium">{user._count.submissions}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Sayfa {page}/{totalPages} &middot; {filteredAndSorted.length} kullanıcı
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          open={true}
          onClose={() => setSelectedUser(null)}
          onUserDeleted={handleUserDeleted}
        />
      )}
    </>
  );
}
