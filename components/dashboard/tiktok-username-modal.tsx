"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateTikTokUsername } from "@/app/actions/user";
import { Loader2, AtSign } from "lucide-react";

import { X } from "lucide-react";

interface TikTokUsernameModalProps {
    isOpen: boolean;
}

export function TikTokUsernameModal({ isOpen }: TikTokUsernameModalProps) {
    const [username, setUsername] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        setIsLoading(true);

        try {
            const result = await updateTikTokUsername(username);

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("TikTok hesabınız başarıyla bağlandı!");
                router.refresh();
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen && !isDismissed} onOpenChange={(open) => !open && setIsDismissed(true)}>
            <DialogContent className="sm:max-w-md bg-[#0A0A0B] border-white/10 text-white">
                <button
                    onClick={() => setIsDismissed(true)}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                >
                    <X className="h-4 w-4 text-white" />
                    <span className="sr-only">Close</span>
                </button>
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">TikTok Kullanıcı Adınızı Girin</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Ödemelerinizi alabilmek ve istatistiklerinizi takip edebilmek için TikTok kullanıcı adınızı girmelisiniz.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="username" className="text-zinc-300">Kullanıcı Adı</Label>
                        <div className="relative">
                            <AtSign className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="kullaniciadiniz"
                                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20"
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <p className="text-xs text-zinc-500">
                            Lütfen başında @ olmadan sadece kullanıcı adınızı yazın.
                        </p>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading || !username.trim()}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Kaydediliyor...
                                </>
                            ) : (
                                "Kaydet ve Devam Et"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
