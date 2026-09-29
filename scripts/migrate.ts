import postgres from "postgres";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

async function runMigration() {
  console.log("Checking migrations...");
  try {
    // Create migrations tracker table
    await sql`
      CREATE TABLE IF NOT EXISTS public._schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    // Check if 0000 was already applied before we started tracking
    const existingAppointments = await sql`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'appointments'
    `;
    if (existingAppointments.length > 0) {
      await sql`
        INSERT INTO public._schema_migrations (name) 
        VALUES ('0000_nail_salon_booking.sql')
        ON CONFLICT (name) DO NOTHING
      `;
    }

    const existingSalonSettings = await sql`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'salon_settings'
    `;
    if (existingSalonSettings.length > 0) {
      await sql`
        INSERT INTO public._schema_migrations (name) 
        VALUES ('0003_admin_settings.sql')
        ON CONFLICT (name) DO NOTHING
      `;
    }

    const existingEndTime = await sql`
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'blocked_slots' AND column_name = 'end_time'
    `;
    if (existingEndTime.length > 0) {
      await sql`
        INSERT INTO public._schema_migrations (name) 
        VALUES ('0004_blocked_slots_time_range.sql')
        ON CONFLICT (name) DO NOTHING
      `;
    }

    const appliedRows = await sql`SELECT name FROM public._schema_migrations`;
    const applied = new Set(appliedRows.map((r) => r.name));

    const metaDir = path.join(process.cwd(), "drizzle", "migrations", "meta");
    const files = fs
      .readdirSync(metaDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already applied: ${file}`);
        continue;
      }

      console.log(`Applying ${file}...`);
      const migrationSql = fs.readFileSync(path.join(metaDir, file), "utf8");
      await sql.unsafe(migrationSql);
      await sql`INSERT INTO public._schema_migrations (name) VALUES (${file})`;
      console.log(`Applied ${file} successfully.`);
    }
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
