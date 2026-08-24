CREATE TABLE IF NOT EXISTS emails (
  id                TEXT PRIMARY KEY,           -- Gmail message id
  thread_id         TEXT,
  rfc822_message_id TEXT,
  sender            TEXT,
  sender_email      TEXT,
  subject           TEXT,
  snippet           TEXT,
  body              TEXT,
  status            TEXT NOT NULL DEFAULT 'other',  -- accepted | rejected | other
  topic             TEXT NOT NULL DEFAULT 'other',  -- scholarship | job | other
  matched_keywords  TEXT NOT NULL DEFAULT '[]',     -- JSON array of classifier hits
  received_at       INTEGER,
  updated_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_topic ON emails(topic);
