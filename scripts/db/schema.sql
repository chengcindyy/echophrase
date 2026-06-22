CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS tags_user_id_idx ON tags (user_id);

CREATE TABLE IF NOT EXISTS vocab (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('word', 'sentence')),
  text TEXT NOT NULL,
  ipa TEXT,
  translation TEXT,
  notes TEXT,
  tag_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_score REAL,
  last_practiced_at BIGINT,
  practice_count INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS vocab_user_id_idx ON vocab (user_id);
