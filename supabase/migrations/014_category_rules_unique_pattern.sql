-- 014_category_rules_unique_pattern
create unique index if not exists category_rules_pattern_idx
  on public.category_rules (pattern);
