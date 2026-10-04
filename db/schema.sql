-- Every module (leads, call log, users, settings, backups) is stored as one
-- JSONB row in this table. Run once on a new database, or use `npm run db:setup`.
create table if not exists app_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
