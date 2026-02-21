"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  MessageSquare,
  Percent,
  FileText,
  Mail,
  MailOpen,
  User,
  Clock,
  Save,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface ContactMessage {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
}

interface SettingsPageClientProps {
  initialSettings: Record<string, string>;
  initialMessages: ContactMessage[];
  unreadCount: number;
}

export function SettingsPageClient({
  initialSettings,
  initialMessages,
  unreadCount: initialUnreadCount,
}: SettingsPageClientProps) {
  // Messages state
  const [messages, setMessages] = useState(initialMessages);
  const [messageFilter, setMessageFilter] = useState<"all" | "unread" | "read">("all");
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  // Settings state
  const [settings, setSettings] = useState(initialSettings);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Commission & Budget
  const [commissionPercent, setCommissionPercent] = useState(settings.commission_percent || "20");
  const [minBudget, setMinBudget] = useState(settings.min_budget || "20000");
  const [maxBudget, setMaxBudget] = useState(settings.max_budget || "1000000");
  const [minDuration, setMinDuration] = useState(settings.min_duration || "5");
  const [maxDuration, setMaxDuration] = useState(settings.max_duration || "30");

  // Legal
  const [termsContent, setTermsContent] = useState(settings.terms_content || "");
  const [privacyContent, setPrivacyContent] = useState(settings.privacy_content || "");

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (messageFilter === "unread") return !msg.read;
    if (messageFilter === "read") return msg.read;
    return true;
  });

  // Toggle message read status
  const toggleRead = async (id: string, currentRead: boolean) => {
    try {
      const res = await fetch("/api/admin/contact-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: !currentRead }),
      });

      if (!res.ok) throw new Error("Failed");

      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, read: !currentRead } : msg))
      );
      setUnreadCount((prev) => (currentRead ? prev + 1 : prev - 1));
    } catch {
      toast.error("Mesaj durumu güncellenemedi");
    }
  };

  // Save settings helper
  const saveSettings = async (
    newSettings: Record<string, string>,
    label: string,
    savingId: string
  ) => {
    setSavingKey(savingId);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (!res.ok) throw new Error("Failed");

      setSettings((prev) => ({ ...prev, ...newSettings }));
      toast.success(`${label} başarıyla kaydedildi`);
    } catch {
      toast.error(`${label} kaydedilemedi`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
          <Settings className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Sistem Ayarları</h1>
          <p className="text-sm text-zinc-400">Uygulama ayarlarını yönetin</p>
        </div>
      </div>

      <Tabs defaultValue="messages" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="messages" className="gap-2 data-[state=active]:bg-white/10">
            <MessageSquare className="h-4 w-4" />
            Mesajlar
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="commission" className="gap-2 data-[state=active]:bg-white/10">
            <Percent className="h-4 w-4" />
            Komisyon & Bütçe
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-2 data-[state=active]:bg-white/10">
            <FileText className="h-4 w-4" />
            Yasal Belgeler
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Messages */}
        <TabsContent value="messages" className="space-y-4">
          {/* Filter buttons */}
          <div className="flex gap-2">
            <Button
              variant={messageFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setMessageFilter("all")}
            >
              Tümü ({messages.length})
            </Button>
            <Button
              variant={messageFilter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => setMessageFilter("unread")}
            >
              Okunmamış ({messages.filter((m) => !m.read).length})
            </Button>
            <Button
              variant={messageFilter === "read" ? "default" : "outline"}
              size="sm"
              onClick={() => setMessageFilter("read")}
            >
              Okunmuş ({messages.filter((m) => m.read).length})
            </Button>
          </div>

          {filteredMessages.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">
                  {messageFilter === "unread"
                    ? "Okunmamış mesaj yok"
                    : messageFilter === "read"
                    ? "Okunmuş mesaj yok"
                    : "Henüz mesaj yok"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((msg) => (
                <Card
                  key={msg.id}
                  className={`bg-white/5 border-white/10 transition-colors cursor-pointer hover:bg-white/[0.07] ${
                    !msg.read ? "border-l-2 border-l-purple-500" : ""
                  }`}
                  onClick={() =>
                    setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!msg.read ? (
                            <Mail className="h-4 w-4 text-purple-400 shrink-0" />
                          ) : (
                            <MailOpen className="h-4 w-4 text-zinc-500 shrink-0" />
                          )}
                          <span className={`font-medium text-sm truncate ${!msg.read ? "text-white" : "text-zinc-300"}`}>
                            {msg.subject}
                          </span>
                          {!msg.read && (
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs shrink-0">
                              Yeni
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {msg.user?.name || msg.name || msg.email}
                          </span>
                          {msg.user && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-white/10">
                              {msg.user.role}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(msg.createdAt), {
                              addSuffix: true,
                              locale: tr,
                            })}
                          </span>
                        </div>

                        {/* Expanded content */}
                        {expandedMessageId === msg.id && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                              {msg.message}
                            </p>
                            <div className="mt-2 text-xs text-zinc-500">
                              {msg.email}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-zinc-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRead(msg.id, msg.read);
                        }}
                      >
                        {msg.read ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Commission & Budget */}
        <TabsContent value="commission" className="space-y-6">
          {/* Commission */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Komisyon Oranı</CardTitle>
              <CardDescription>
                Tüm yeni kampanyalara uygulanacak komisyon oranı. Mevcut kampanyaların komisyonu değişmez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1 max-w-xs">
                  <Label htmlFor="commission">Komisyon (%)</Label>
                  <div className="relative">
                    <Input
                      id="commission"
                      type="number"
                      min="0"
                      max="100"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    saveSettings(
                      { commission_percent: commissionPercent },
                      "Komisyon oranı",
                      "commission"
                    )
                  }
                  disabled={savingKey === "commission"}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingKey === "commission" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Budget Limits */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Bütçe Limitleri</CardTitle>
              <CardDescription>
                Kampanya oluşturma sırasında geçerli olan minimum ve maksimum bütçe limitleri.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="minBudget">Minimum Bütçe (₺)</Label>
                  <Input
                    id="minBudget"
                    type="number"
                    min="0"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxBudget">Maksimum Bütçe (₺)</Label>
                  <Input
                    id="maxBudget"
                    type="number"
                    min="0"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  saveSettings(
                    { min_budget: minBudget, max_budget: maxBudget },
                    "Bütçe limitleri",
                    "budget"
                  )
                }
                disabled={savingKey === "budget"}
              >
                <Save className="h-4 w-4 mr-2" />
                {savingKey === "budget" ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </CardContent>
          </Card>

          {/* Duration Limits */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Süre Limitleri</CardTitle>
              <CardDescription>
                Kampanya süresi için minimum ve maksimum gün sayısı.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="minDuration">Minimum Süre (gün)</Label>
                  <Input
                    id="minDuration"
                    type="number"
                    min="1"
                    value={minDuration}
                    onChange={(e) => setMinDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDuration">Maksimum Süre (gün)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    min="1"
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  saveSettings(
                    { min_duration: minDuration, max_duration: maxDuration },
                    "Süre limitleri",
                    "duration"
                  )
                }
                disabled={savingKey === "duration"}
              >
                <Save className="h-4 w-4 mr-2" />
                {savingKey === "duration" ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Legal Documents */}
        <TabsContent value="legal" className="space-y-6">
          {/* Terms of Service */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg">Kullanım Koşulları</CardTitle>
                  <CardDescription>
                    /terms sayfasında görüntülenecek içerik
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("/terms", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Önizle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  value={termsContent}
                  onChange={(e) => setTermsContent(e.target.value)}
                  placeholder="Kullanım koşulları içeriğini buraya yazın..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() =>
                    saveSettings(
                      { terms_content: termsContent },
                      "Kullanım koşulları",
                      "terms"
                    )
                  }
                  disabled={savingKey === "terms"}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingKey === "terms" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Policy */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg">Gizlilik Politikası</CardTitle>
                  <CardDescription>
                    /privacy sayfasında görüntülenecek içerik
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("/privacy", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Önizle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  value={privacyContent}
                  onChange={(e) => setPrivacyContent(e.target.value)}
                  placeholder="Gizlilik politikası içeriğini buraya yazın..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() =>
                    saveSettings(
                      { privacy_content: privacyContent },
                      "Gizlilik politikası",
                      "privacy"
                    )
                  }
                  disabled={savingKey === "privacy"}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingKey === "privacy" ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
