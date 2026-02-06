/**
 * Fix Duplicate Music IDs
 * 
 * This script checks for duplicate values in tiktokMusicId and clears them 
 * to allow the unique constraint to be applied.
 * 
 * Run with: npx tsx scripts/fix-duplicate-music-ids.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking for duplicate tiktokMusicIds...');

    try {
        // 1. Check if we can query the field (it might not exist yet if push failed entirely)
        // We'll use $queryRaw to avoid type errors if the schema doesn't match the client yet

        // Check non-null values
        const songs = await prisma.song.findMany({
            select: { id: true, tiktokMusicId: true },
            // We can't filter by tiktokMusicId if the type defs aren't updated yet,
            // but if the user ran `prisma generate` recently, it might be there.
            // If not, we'll cast to any.
        }) as any[];

        console.log(`Found ${songs.length} total songs.`);

        // Find non-null, non-unique IDs
        const valueMap = new Map<string, string[]>();

        for (const song of songs) {
            const val = song.tiktokMusicId;
            if (val === null || val === undefined) continue;

            // Empty strings are often the culprit
            const key = String(val); // normalize

            if (!valueMap.has(key)) {
                valueMap.set(key, []);
            }
            valueMap.get(key)!.push(song.id);
        }

        let duplicatesFound = 0;

        for (const [key, ids] of Array.from(valueMap.entries())) {
            if (ids.length > 1) {
                console.log(`⚠️ Duplicate found: "${key}" used in ${ids.length} songs`);
                duplicatesFound++;

                // Fix: Set to null for all but the first one (or all of them to be safe)
                console.log(`   Fixing ${ids.length} records...`);

                // We use updateMany if possible, or loop
                await prisma.song.updateMany({
                    where: {
                        id: { in: ids }
                    },
                    data: {
                        tiktokMusicId: null
                    } as any // Cast to avoid type error if field strictly typed
                });

                console.log(`   ✅ Cleared values for these songs.`);
            }
        }

        if (duplicatesFound === 0) {
            console.log('✅ No duplicates found in tiktokMusicId.');

            // Also check tiktokUserId on User table
            console.log('\n🔍 Checking User table for duplicate tiktokUserIds...');
            const users = await prisma.user.findMany({
                select: { id: true, tiktokUserId: true }
            }) as any[];

            const userMap = new Map<string, string[]>();
            for (const u of users) {
                if (u.tiktokUserId) {
                    const k = String(u.tiktokUserId);
                    if (!userMap.has(k)) userMap.set(k, []);
                    userMap.get(k)!.push(u.id);
                }
            }

            let userDupes = 0;
            for (const [k, ids] of Array.from(userMap.entries())) {
                if (ids.length > 1) {
                    console.log(`⚠️ Duplicate tiktokUserId found: "${k}"`);
                    await prisma.user.updateMany({
                        where: { id: { in: ids } },
                        data: { tiktokUserId: null } as any
                    });
                    userDupes++;
                }
            }

            if (userDupes === 0) console.log('✅ No duplicates found in tiktokUserId.');
            else console.log(`✅ Fixed ${userDupes} duplicate user IDs.`);

        } else {
            console.log(`\n✅ Fixed ${duplicatesFound} groups of duplicates.`);
        }

    } catch (error) {
        console.error('Error during fix:', error);
        console.log('\nNOTE: If the error is about "column does not exist", that means the field hasn\'t been added to the DB yet, so the unique constraint error might be coming from a different source or the migration history.');
    } finally {
        await prisma.$disconnect();
    }
}

main();
