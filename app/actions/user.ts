"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateTikTokUsername(username: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return { error: "Oturum açmanız gerekiyor." };
        }

        if (!username || username.trim().length < 2) {
            return { error: "Geçerli bir kullanıcı adı girin." };
        }

        // Clean the username (remove @ if present)
        const cleanUsername = username.trim().replace(/^@/, "");

        await prisma.user.update({
            where: {
                id: session.user.id,
            },
            data: {
                tiktokHandle: cleanUsername,
            },
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to update TikTok username:", error);
        return { error: "Bir hata oluştu. Lütfen tekrar deneyin." };
    }
}
