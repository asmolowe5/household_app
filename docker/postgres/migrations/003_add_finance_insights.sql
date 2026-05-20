CREATE TABLE IF NOT EXISTS finance_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with timezone NOT NULL DEFAULT now()
);
