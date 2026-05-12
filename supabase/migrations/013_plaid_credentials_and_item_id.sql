-- 013_plaid_credentials_and_item_id
alter table public.plaid_items
  add column if not exists plaid_item_id text,
  add column if not exists access_token text;

create unique index if not exists plaid_items_plaid_item_id_idx
  on public.plaid_items (plaid_item_id)
  where plaid_item_id is not null;

update public.plaid_items
set access_token = replace(cursor, '__token__', '')
where access_token is null
  and cursor like '__token__%';
