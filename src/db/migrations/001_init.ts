import { systemCategories, systemCategoryId } from "../systemCategories";
import { DEFAULT_WALLET_ID } from "../types";

// Migration 1: the whole v2 schema. Never edit a migration that has shipped.
// Later changes get their own numbered file and only add columns or tables.
//
// Money is INTEGER rupiah and always positive, the direction comes from `type`.
// Time is a UTC epoch plus the offset and zone that applied at entry, and the
// local date is stored so grouping by day never depends on the phone's zone.
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";

const schema = `
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cash','bank','ewallet','other')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income','saving')),
  system_key TEXT UNIQUE,
  name TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (system_key IS NOT NULL OR name IS NOT NULL)
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  target_amount INTEGER CHECK (target_amount IS NULL OR target_amount > 0),
  target_date TEXT,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE recurring_rules (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('expense','income','saving_deposit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  title TEXT NOT NULL,
  counterparty TEXT,
  category_id TEXT REFERENCES categories(id),
  goal_id TEXT REFERENCES goals(id),
  wallet_id TEXT REFERENCES wallets(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','yearly')),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  weekday INTEGER CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6)),
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_due_date TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'confirm' CHECK (mode IN ('confirm','auto')),
  remind INTEGER NOT NULL DEFAULT 0,
  paused_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  image_path TEXT,
  image_hash TEXT,
  ocr_text TEXT,
  parsed_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','confirmed','discarded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE receipt_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'item' CHECK (kind IN ('item','tax','service','discount','fee','rounding')),
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price INTEGER,
  line_total INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN
    ('expense','income','saving_deposit','saving_withdrawal','transfer','adjustment')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  title TEXT NOT NULL,
  counterparty TEXT,
  category_id TEXT REFERENCES categories(id),
  goal_id TEXT REFERENCES goals(id),
  wallet_id TEXT REFERENCES wallets(id),
  to_wallet_id TEXT REFERENCES wallets(id),
  payment_method TEXT,
  note TEXT,
  occurred_at INTEGER NOT NULL,
  occurred_tz TEXT NOT NULL,
  occurred_offset_min INTEGER NOT NULL,
  occurred_local_date TEXT NOT NULL,
  time_precision TEXT NOT NULL CHECK (time_precision IN ('exact','date','estimated')),
  source TEXT NOT NULL CHECK (source IN ('manual','receipt','recurring','import','legacy')),
  location_name TEXT,
  location_lat REAL,
  location_lng REAL,
  location_source TEXT CHECK (location_source IN ('device','manual','receipt')),
  receipt_id TEXT REFERENCES receipts(id),
  recurring_rule_id TEXT REFERENCES recurring_rules(id),
  legacy_ref TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK ((type IN ('saving_deposit','saving_withdrawal')) = (goal_id IS NOT NULL)),
  CHECK (type <> 'transfer' OR to_wallet_id IS NOT NULL)
);
CREATE INDEX tx_by_day ON transactions (occurred_local_date, occurred_at) WHERE deleted_at IS NULL;
CREATE INDEX tx_by_type_day ON transactions (type, occurred_local_date) WHERE deleted_at IS NULL;
CREATE INDEX tx_by_category ON transactions (category_id);
CREATE INDEX tx_by_goal ON transactions (goal_id);
CREATE UNIQUE INDEX tx_recurring_once ON transactions (recurring_rule_id, occurred_local_date)
  WHERE recurring_rule_id IS NOT NULL;

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at INTEGER NOT NULL
);

CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  effective_from TEXT NOT NULL,
  amount INTEGER CHECK (amount IS NULL OR amount > 0),
  alert_pct INTEGER NOT NULL DEFAULT 80 CHECK (alert_pct BETWEEN 1 AND 100),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (category_id, effective_from)
);
`;

const seedCategories = systemCategories
  .map(
    (category, index) =>
      `INSERT INTO categories (id, kind, system_key, name, icon, color, sort_order, created_at, updated_at)
       VALUES ('${systemCategoryId(category.key)}', '${category.kind}', '${category.key}', NULL, '${category.icon}', '${category.color}', ${index}, ${NOW}, ${NOW});`,
  )
  .join("\n");

const seedWallet = `INSERT INTO wallets (id, name, kind, currency, opening_balance, is_default, created_at, updated_at)
  VALUES ('${DEFAULT_WALLET_ID}', 'Main', 'other', 'IDR', 0, 1, ${NOW}, ${NOW});`;

export const init001 = `${schema}\n${seedCategories}\n${seedWallet}\n`;
