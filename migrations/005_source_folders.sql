CREATE TABLE source_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  name_key TEXT NOT NULL UNIQUE
);
ALTER TABLE sources ADD COLUMN folder_id TEXT REFERENCES source_folders(id) ON DELETE SET NULL;
CREATE INDEX sources_folder ON sources(folder_id);
CREATE INDEX articles_source ON articles(source_id);
