import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
const ALEX_PIN = process.env.ALEX_PIN;
const EMINE_PIN = process.env.EMINE_PIN;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!ALEX_PIN || !EMINE_PIN) {
  console.error("ALEX_PIN and EMINE_PIN environment variables are required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function seed() {
  console.log("Seeding users...");

  const alexHash = bcrypt.hashSync(ALEX_PIN!, 10);
  const emineHash = bcrypt.hashSync(EMINE_PIN!, 10);

  await sql`
    INSERT INTO users (name, pin_hash, role)
    SELECT 'Alex', ${alexHash}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Alex')
  `;

  await sql`
    INSERT INTO users (name, pin_hash, role)
    SELECT 'Emine', ${emineHash}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Emine')
  `;

  await sql`
    UPDATE users
    SET pin_hash = CASE
      WHEN name = 'Alex' THEN ${alexHash}
      WHEN name = 'Emine' THEN ${emineHash}
      ELSE pin_hash
    END
    WHERE name IN ('Alex', 'Emine')
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
