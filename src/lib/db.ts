import "server-only";
import postgres from "postgres";

// One pooled connection, reused across requests (and across hot-reloads in
// dev) rather than opening a fresh one per call.
const globalForSql = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

// Hosted Postgres (Supabase, Neon, ...) needs TLS; a database on this machine
// usually doesn't offer it.
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

export const sql =
  globalForSql.sql ??
  postgres(process.env.DATABASE_URL!, {
    ssl: isLocalDb ? false : "require",
    prepare: false, // required for Supabase's transaction pooler
  });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;

// A single JSONB key-value table backs every store module below — each one
// used to be its own JSON file; now it's one row here, so the existing
// read-modify-write logic in each *-store.ts barely had to change, just
// where the bytes live. `withStore` takes a row lock for the whole cycle,
// so two overlapping requests (even across separate serverless instances,
// unlike the old in-process queue) can't silently clobber each other.
export async function ensureStoreTable(): Promise<void> {
  await sql`
    create table if not exists app_data (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
}

export async function readStore<T>(key: string, fallback: T): Promise<T> {
  const rows = await sql<{ value: T }[]>`select value from app_data where key = ${key}`;
  return rows.length ? rows[0].value : fallback;
}

export async function withStore<T>(
  key: string,
  fallback: T,
  mutate: (current: T) => T | Promise<T>
): Promise<T> {
  const result = await sql.begin(async (tx) => {
    const rows = await tx<{ value: T }[]>`
      select value from app_data where key = ${key} for update
    `;
    const current = rows.length ? rows[0].value : fallback;
    const next = await mutate(current);
    await tx`
      insert into app_data (key, value, updated_at)
      values (${key}, ${sql.json(next as never)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    return next;
  });
  return result as T;
}

// Like withStore, but locks and rewrites several keys in one transaction —
// for changes that must land in more than one store together (e.g. renaming
// a user along with the leads and call log entries that refer to them).
export async function withStores(
  keys: string[],
  mutate: (current: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>
): Promise<void> {
  await sql.begin(async (tx) => {
    const rows = await tx<{ key: string; value: unknown }[]>`
      select key, value from app_data where key in ${sql(keys)} order by key for update
    `;
    const current: Record<string, unknown> = {};
    for (const r of rows) current[r.key] = r.value;
    const next = await mutate(current);
    for (const [key, value] of Object.entries(next)) {
      await tx`
        insert into app_data (key, value, updated_at)
        values (${key}, ${sql.json(value as never)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `;
    }
  });
}

// A full replace, not a read-modify-write — used by restore-from-backup,
// where the incoming snapshot is already the complete, final value.
export async function overwriteStore<T>(key: string, value: T): Promise<void> {
  await withStore<T>(key, value, () => value);
}

// Writes several stores in ONE transaction — all of them land, or none do —
// then reads each one back inside that same transaction and aborts unless it
// matches exactly. Used by restore and "start fresh", where a half-applied
// result (some modules old, some new) would be worse than failing outright.
// `deletePrefix` also removes every key starting with it in the same step.
export async function replaceStoresAtomically(
  entries: Record<string, unknown>,
  opts: { deletePrefix?: string } = {}
): Promise<void> {
  await sql.begin(async (tx) => {
    for (const [key, value] of Object.entries(entries)) {
      await tx`
        insert into app_data (key, value, updated_at)
        values (${key}, ${sql.json(value as never)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `;
    }
    if (opts.deletePrefix) {
      await tx`delete from app_data where key like ${opts.deletePrefix + "%"}`;
    }

    for (const [key, value] of Object.entries(entries)) {
      const [row] = await tx<{ same: boolean }[]>`
        select value = ${sql.json(value as never)}::jsonb as same from app_data where key = ${key}
      `;
      if (!row?.same) throw new Error(`Check failed for "${key}" — nothing was changed.`);
    }
    if (opts.deletePrefix) {
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from app_data where key like ${opts.deletePrefix + "%"}
      `;
      if (n !== 0) throw new Error("Check failed while removing old backups — nothing was changed.");
    }
  });
}

// Every row whose key starts with `prefix`, newest first by when it was
// written — used to list stored daily backups (keys like `backup:2026-10-01`)
// without needing a separate index table.
export async function listKeysWithPrefix(prefix: string): Promise<string[]> {
  const rows = await sql<{ key: string }[]>`
    select key from app_data where key like ${prefix + "%"} order by key desc
  `;
  return rows.map((r) => r.key);
}

export async function deleteStoreKey(key: string): Promise<void> {
  await sql`delete from app_data where key = ${key}`;
}
