"use client";

import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, Wallet } from "lucide-react";
import Link from "next/link";
import { UserRole } from "@prisma/client";

interface UserNavProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
}

export function UserNav({ user }: UserNavProps) {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || (user.email ? user.email[0].toUpperCase() : "U");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-white/10">
          <Avatar className="border border-white/10">
            <AvatarImage src={undefined} alt={user.name || ""} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-200">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-[#0A0A0B] border-white/10 text-white" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || "Kullanıcı"}</p>
            <p className="text-xs leading-none text-zinc-400">
              {user.email}
            </p>
            <p className="text-[10px] leading-none text-purple-400 uppercase tracking-wider font-semibold mt-1">
              {user.role.toLowerCase()}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white cursor-pointer transition-colors">
          <Link href="/profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white cursor-pointer transition-colors">
          <Link href="/wallet" className="flex items-center">
            <Wallet className="mr-2 h-4 w-4" />
            Cüzdan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white cursor-pointer transition-colors">
          <Link href="/profile" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Ayarlar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/5" />
        <DropdownMenuItem
          className="cursor-pointer text-pink-500 focus:text-pink-400 focus:bg-pink-500/10 transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Çıkış Yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


