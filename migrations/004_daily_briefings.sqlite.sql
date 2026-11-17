CREATE TABLE briefing_changes (id INTEGER PRIMARY KEY, published_at TEXT NOT NULL);
CREATE INDEX briefing_changes_due ON briefing_changes(published_at);

CREATE TRIGGER briefing_article_insert AFTER INSERT ON articles
WHEN NEW.publication_verified=1 BEGIN
  INSERT INTO briefing_changes(published_at) VALUES(NEW.published_at);
END;
CREATE TRIGGER briefing_article_update AFTER UPDATE ON articles
WHEN (OLD.publication_verified=1 OR NEW.publication_verified=1) AND (
  OLD.published_at IS NOT NEW.published_at OR OLD.publication_verified <> NEW.publication_verified
  OR OLD.title <> NEW.title OR OLD.summary <> NEW.summary OR OLD.description <> NEW.description
  OR OLD.source_name <> NEW.source_name OR OLD.url <> NEW.url OR OLD.relevance <> NEW.relevance
  OR OLD.manual_topics <> NEW.manual_topics OR OLD.topic_revision <> NEW.topic_revision
  OR (OLD.topic_status IN ('done','rules','failed')) <> (NEW.topic_status IN ('done','rules','failed'))
) BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT OLD.published_at WHERE OLD.publication_verified=1
    UNION SELECT NEW.published_at WHERE NEW.publication_verified=1;
END;

CREATE TRIGGER briefing_catalog_change AFTER UPDATE OF revision ON topic_catalog
WHEN OLD.revision <> NEW.revision BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT DISTINCT a.published_at FROM articles a JOIN article_topics at ON at.article_id=a.id
    WHERE a.publication_verified=1 AND a.manual_topics=0 AND a.topic_revision=OLD.revision
      AND a.topic_status IN ('done','rules','failed');
END;
CREATE TRIGGER briefing_article_delete AFTER DELETE ON articles
WHEN OLD.publication_verified=1 BEGIN
  INSERT INTO briefing_changes(published_at) VALUES(OLD.published_at);
END;

CREATE TRIGGER briefing_assignment_insert AFTER INSERT ON article_topics BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT published_at FROM articles WHERE id=NEW.article_id AND publication_verified=1;
END;
CREATE TRIGGER briefing_assignment_delete AFTER DELETE ON article_topics BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT published_at FROM articles WHERE id=OLD.article_id AND publication_verified=1;
END;
CREATE TRIGGER briefing_topic_rename AFTER UPDATE OF name ON topics
WHEN OLD.name <> NEW.name BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT DISTINCT a.published_at FROM articles a JOIN article_topics at ON at.article_id=a.id
    WHERE at.topic_id=NEW.id AND a.publication_verified=1;
END;
