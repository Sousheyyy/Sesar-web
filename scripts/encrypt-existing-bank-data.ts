/**
 * One-time migration: encrypt existing plaintext bankDetails in transactions.
 *
 * Usage:
 *   BANK_DATA_ENCRYPTION_KEY=<your-64-char-hex> npx tsx scripts/encrypt-existing-bank-data.ts
 *
 * Safe to run multiple times — skips already-encrypted entries.
 */
import { prisma } from "../lib/prisma";
import { encryptBankDetails } from "../server/lib/encryption";

async function main() {
    const transactions = await prisma.transaction.findMany({
        where: { type: "WITHDRAWAL", bankDetails: { not: null } },
        select: { id: true, bankDetails: true },
    });

    let migrated = 0;
    let skipped = 0;

    for (const tx of transactions) {
        if (!tx.bankDetails) {
            skipped++;
            continue;
        }

        // Already encrypted (contains colons in iv:tag:cipher format and doesn't start with JSON)
        if (!tx.bankDetails.startsWith("{") && !tx.bankDetails.startsWith("[") && tx.bankDetails.includes(":")) {
            skipped++;
            continue;
        }

        const encrypted = encryptBankDetails(tx.bankDetails);
        await prisma.transaction.update({
            where: { id: tx.id },
            data: { bankDetails: encrypted },
        });
        migrated++;
    }

    console.log(`Done. Migrated: ${migrated}, Skipped (already encrypted): ${skipped}`);
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
