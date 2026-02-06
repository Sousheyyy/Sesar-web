import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env from sesar-web
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteUser(email: string) {
    console.log(`🔍 Searching for user: ${email}...`);
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("❌ Failed to list users:", listError.message);
        return;
    }

    const user = users.find(u => u.email === email);

    if (user) {
        console.log(`🗑️ Deleting user ${email} (ID: ${user.id})...`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
            console.error("❌ Failed to delete user:", deleteError.message);
        } else {
            console.log(`✅ Successfully deleted ${email}`);
        }
    } else {
        console.log(`ℹ️ User ${email} not found in Supabase Auth.`);
    }
}

deleteUser("creator1@tikpay.com")
    .catch(console.error);
