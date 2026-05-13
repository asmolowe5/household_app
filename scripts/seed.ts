import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
const PRIMARY_USER_PIN = process.env.PRIMARY_USER_PIN;
const SECONDARY_USER_PIN = process.env.SECONDARY_USER_PIN;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!PRIMARY_USER_PIN || !SECONDARY_USER_PIN) {
  console.error(
    "PRIMARY_USER_PIN and SECONDARY_USER_PIN environment variables are required",
  );
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function seed() {
  console.log("Seeding users...");

  const primaryUserHash = bcrypt.hashSync(PRIMARY_USER_PIN!, 10);
  const secondaryUserHash = bcrypt.hashSync(SECONDARY_USER_PIN!, 10);

  await sql`
    INSERT INTO users (name, pin_hash, role)
    SELECT 'Primary User', ${primaryUserHash}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Primary User')
  `;

  await sql`
    INSERT INTO users (name, pin_hash, role)
    SELECT 'Secondary User', ${secondaryUserHash}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Secondary User')
  `;

  await sql`
    UPDATE users
    SET pin_hash = CASE
      WHEN name = 'Primary User' THEN ${primaryUserHash}
      WHEN name = 'Secondary User' THEN ${secondaryUserHash}
      ELSE pin_hash
    END
    WHERE name IN ('Primary User', 'Secondary User')
  `;

  console.log("Seeding categories...");

  await sql`
    INSERT INTO categories (name, type, sort_order, icon)
    VALUES
      ('Dining/Delivery', 'discretionary', 1, 'utensils-crossed'),
      ('Groceries', 'discretionary', 2, 'shopping-cart'),
      ('Shopping', 'discretionary', 3, 'shopping-bag'),
      ('Transportation', 'discretionary', 4, 'car'),
      ('Entertainment', 'discretionary', 5, 'film'),
      ('Home', 'discretionary', 6, 'home'),
      ('Personal', 'discretionary', 7, 'user'),
      ('Rent/Mortgage', 'fixed', 10, 'building'),
      ('Utilities', 'fixed', 11, 'zap'),
      ('Insurance', 'fixed', 12, 'shield'),
      ('Subscriptions', 'fixed', 13, 'repeat')
    ON CONFLICT DO NOTHING
  `;

  console.log("Seed complete.");
  await sql.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
