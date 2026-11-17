CREATE TABLE briefing_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  published_at TEXT NOT NULL
);
CREATE INDEX briefing_changes_due ON briefing_changes(published_at);

CREATE FUNCTION briefing_article_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (
      OLD.published_at, OLD.publication_verified, OLD.title, OLD.summary, OLD.description,
      OLD.source_name, OLD.url, OLD.relevance, OLD.manual_topics, OLD.topic_revision,
      OLD.topic_status IN ('done','rules','failed')
    ) IS NOT DISTINCT FROM (
      NEW.published_at, NEW.publication_verified, NEW.title, NEW.summary, NEW.description,
      NEW.source_name, NEW.url, NEW.relevance, NEW.manual_topics, NEW.topic_revision,
      NEW.topic_status IN ('done','rules','failed')
    ) THEN RETURN NULL;
    END IF;
  END IF;
  IF TG_OP<>'INSERT' AND OLD.publication_verified=1 THEN
    INSERT INTO briefing_changes(published_at) VALUES(OLD.published_at);
  END IF;
  IF TG_OP<>'DELETE' AND NEW.publication_verified=1 THEN
    INSERT INTO briefing_changes(published_at) VALUES(NEW.published_at);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER briefing_article_change AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION briefing_article_change();

CREATE FUNCTION briefing_assignment_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT published_at FROM articles
    WHERE id=(CASE WHEN TG_OP='DELETE' THEN OLD.article_id ELSE NEW.article_id END)
      AND publication_verified=1;
  RETURN NULL;
END;
$$;
CREATE TRIGGER briefing_assignment_change AFTER INSERT OR DELETE ON article_topics
FOR EACH ROW EXECUTE FUNCTION briefing_assignment_change();

CREATE FUNCTION briefing_topic_rename() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT DISTINCT a.published_at FROM articles a JOIN article_topics at ON at.article_id=a.id
    WHERE at.topic_id=NEW.id AND a.publication_verified=1;
  RETURN NULL;
END;
$$;
CREATE TRIGGER briefing_topic_rename AFTER UPDATE OF name ON topics
FOR EACH ROW WHEN (OLD.name <> NEW.name) EXECUTE FUNCTION briefing_topic_rename();

CREATE FUNCTION briefing_catalog_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO briefing_changes(published_at)
    SELECT DISTINCT a.published_at FROM articles a JOIN article_topics at ON at.article_id=a.id
    WHERE a.publication_verified=1 AND a.manual_topics=0 AND a.topic_revision=OLD.revision
      AND a.topic_status IN ('done','rules','failed');
  RETURN NULL;
END;
$$;
CREATE TRIGGER briefing_catalog_change AFTER UPDATE OF revision ON topic_catalog
FOR EACH ROW WHEN (OLD.revision <> NEW.revision) EXECUTE FUNCTION briefing_catalog_change();
