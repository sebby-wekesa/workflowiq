CREATE TABLE chart_account (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  normal_balance TEXT CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  is_bank BOOLEAN,
  is_system BOOLEAN,
  description TEXT
);

CREATE TABLE journal_entry (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  entry_number TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED',
  source TEXT,
  source_type TEXT,
  source_id TEXT,
  posted_at TIMESTAMP,
  posted_by UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ledger_line (
  id UUID PRIMARY KEY,
  journal_entry_id UUID REFERENCES journal_entry(id),
  account_id UUID REFERENCES chart_account(id),
  debit NUMERIC,
  credit NUMERIC
);
