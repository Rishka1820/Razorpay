// Storage. Uses Postgres (Neon) when DATABASE_URL / POSTGRES_URL is set, otherwise memory (local testing only).
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = url ? neon(url) : null;
export const storage = url ? 'postgres' : 'memory';

const g = globalThis;
g.__orders_mem = g.__orders_mem || new Map();
const mem = g.__orders_mem;

let ready = null;
async function init() {
  if (!sql) return;
  if (!ready) {
    ready = sql(
      'create table if not exists orders (id text primary key, data jsonb not null, sample boolean not null default false, updated_at timestamptz not null default now())'
    );
  }
  await ready;
}

export async function listOrders() {
  if (!sql) return [...mem.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  await init();
  const rows = await sql('select data from orders order by updated_at desc');
  return rows.map((r) => r.data);
}

export async function getOrder(id) {
  if (!sql) return mem.get(id) ? structuredClone(mem.get(id)) : null;
  await init();
  const rows = await sql('select data from orders where id = $1', [id]);
  return rows[0]?.data || null;
}

export async function saveOrder(o) {
  o.updatedAt = new Date().toISOString();
  if (!sql) {
    mem.set(o.id, structuredClone(o));
    return o;
  }
  await init();
  await sql(
    'insert into orders (id, data, sample, updated_at) values ($1, $2::jsonb, $3, now()) on conflict (id) do update set data = $2::jsonb, sample = $3, updated_at = now()',
    [o.id, JSON.stringify(o), !!o.sample]
  );
  return o;
}

export async function clearAll() {
  if (!sql) {
    mem.clear();
    return;
  }
  await init();
  await sql('delete from orders');
}

// Small key-value store (push keys and subscriptions).
g.__kv_mem = g.__kv_mem || new Map();
let kvReady = null;
export async function kvGet(key) {
  if (!sql) return g.__kv_mem.get(key) ?? null;
  if (!kvReady) kvReady = sql('create table if not exists kv (key text primary key, data jsonb not null)');
  await kvReady;
  const rows = await sql('select data from kv where key = $1', [key]);
  return rows[0]?.data ?? null;
}
export async function kvSet(key, val) {
  if (!sql) { g.__kv_mem.set(key, structuredClone(val)); return; }
  if (!kvReady) kvReady = sql('create table if not exists kv (key text primary key, data jsonb not null)');
  await kvReady;
  await sql('insert into kv (key, data) values ($1, $2::jsonb) on conflict (key) do update set data = $2::jsonb', [key, JSON.stringify(val)]);
}
