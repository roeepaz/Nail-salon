import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setupAdmin() {
  console.log(`Setting up admin user for ${ADMIN_EMAIL}...`);

  // 1. Create or get the user
  let userId = "";

  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const existingUser = users.users.find((u) => u.email === ADMIN_EMAIL);

  if (existingUser) {
    console.log("Admin user already exists in auth.users.");
    userId = existingUser.id;

    // Optional: update password if needed
    await supabase.auth.admin.updateUserById(userId, { password: ADMIN_PASSWORD });
  } else {
    console.log("Creating admin user...");
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      console.error("Error creating user:", createError?.message);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log("User created successfully.");
  }

  // 2. Clear old admins and assign the new admin role
  console.log("Assigning admin role in database...");

  // First, remove the admin role from any existing users
  await supabase.from("user_roles").delete().eq("role", "admin");

  // Then, assign it to the new user
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });

  if (roleError) {
    console.error("Error assigning admin role:", roleError.message);
    process.exit(1);
  }

  console.log("Admin setup complete!");
}

setupAdmin().catch(console.error);
