ALTER TABLE articles ADD COLUMN publication_verified INTEGER NOT NULL DEFAULT 0
  CHECK(publication_verified=0 OR (publication_verified=1 AND published_at IS NOT NULL));
CREATE INDEX articles_publication_verified ON articles(published_at) WHERE publication_verified=1;
ALTER TABLE briefings ADD COLUMN timezone TEXT;
ALTER TABLE briefings ADD COLUMN updated_at TEXT;
ALTER TABLE briefings ADD COLUMN truncated INTEGER NOT NULL DEFAULT 0;

CREATE TABLE briefing_legacy_backup (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO briefing_legacy_backup SELECT id,day,content,created_at FROM briefings;
