import postgres from "postgres";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, "utf-8");
  for (const line of fileContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("Running property management database migrations...");

  // 1. Create properties table
  console.log("Creating 'properties' table if not exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS properties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      address text,
      monthly_rent_target numeric(10, 2) DEFAULT 0,
      is_active boolean DEFAULT true,
      notes text,
      created_at timestamptz DEFAULT now()
    )
  `;

  // 2. Add property_id column to transactions table
  console.log("Adding 'property_id' column to 'transactions' table if not exists...");
  await sql`
    ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL
  `;

  // Check if categories table exists and if 'Real Estate' exists first
  const existingCategories = await sql`
    SELECT id FROM categories WHERE name = 'Real Estate' LIMIT 1
  `;
  if (existingCategories.length === 0) {
    console.log("Inserting 'Real Estate' category...");
    await sql`
      INSERT INTO categories (name, type, sort_order, icon)
      VALUES ('Real Estate', 'fixed', 14, 'building')
    `;
  } else {
    console.log("'Real Estate' category already exists.");
  }

  console.log("Migration complete!");
  await sql.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
