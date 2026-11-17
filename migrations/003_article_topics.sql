ALTER TABLE topics ADD COLUMN semantic_exclusions TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN topic_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN topic_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE articles ADD COLUMN topic_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN topic_next_run TEXT;
ALTER TABLE articles ADD COLUMN topic_token TEXT;
ALTER TABLE articles ADD COLUMN topic_error TEXT;
ALTER TABLE articles ADD COLUMN topic_checked_at TEXT;
ALTER TABLE articles ADD COLUMN topic_version TEXT;
ALTER TABLE articles ADD COLUMN topic_notify INTEGER NOT NULL DEFAULT 0;

CREATE TABLE topic_catalog (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL
);
INSERT INTO topic_catalog(id,revision) VALUES(1,1);

CREATE TABLE article_topic_results (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK(origin IN ('rules','ai')),
  adopted INTEGER NOT NULL CHECK(adopted IN (0,1)),
  confidence TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY(article_id,topic_id,origin)
);
CREATE INDEX articles_topic_revision ON articles(manual_topics,topic_revision,id);
CREATE INDEX articles_topic_work ON articles(manual_topics,topic_status,topic_next_run);
