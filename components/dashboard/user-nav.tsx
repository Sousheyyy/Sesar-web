"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || (user.email ? user.email[0].toUpperCase() : "U");

  return (
    <Avatar className="border border-white/10">
      <AvatarFallback className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-200">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
