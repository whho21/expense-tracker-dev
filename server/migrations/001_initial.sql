CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  icon text NOT NULL CHECK (length(icon) BETWEEN 1 AND 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  transaction_date date NOT NULL,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 100),
  category_id text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_category_id_idx ON transactions (category_id);