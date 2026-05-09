CREATE TABLE person (
  id            INTEGER PRIMARY KEY,
  linkedin_url  TEXT UNIQUE NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  company       TEXT,
  title         TEXT,
  connected_on  DATE,
  notes_md      TEXT NOT NULL DEFAULT '',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_person_company  ON person(company);
CREATE INDEX idx_person_archived ON person(archived);

CREATE TABLE tag (
  id    INTEGER PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE person_tag (
  person_id INTEGER NOT NULL,
  tag_id    INTEGER NOT NULL,
  PRIMARY KEY (person_id, tag_id),
  FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)    REFERENCES tag(id)    ON DELETE CASCADE
);

CREATE TABLE saved_view (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE import_session (
  id            INTEGER PRIMARY KEY,
  imported_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_name     TEXT,
  rows_total    INTEGER NOT NULL,
  rows_added    INTEGER NOT NULL,
  rows_updated  INTEGER NOT NULL,
  rows_archived INTEGER NOT NULL,
  snapshot_path TEXT
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE VIRTUAL TABLE person_fts USING fts5(
  first_name, last_name, company, title, notes_md,
  content='person', content_rowid='id'
);

CREATE TRIGGER person_ai AFTER INSERT ON person BEGIN
  INSERT INTO person_fts(rowid, first_name, last_name, company, title, notes_md)
  VALUES (new.id, new.first_name, new.last_name, new.company, new.title, new.notes_md);
END;

CREATE TRIGGER person_ad AFTER DELETE ON person BEGIN
  INSERT INTO person_fts(person_fts, rowid, first_name, last_name, company, title, notes_md)
  VALUES ('delete', old.id, old.first_name, old.last_name, old.company, old.title, old.notes_md);
END;

CREATE TRIGGER person_au AFTER UPDATE ON person BEGIN
  INSERT INTO person_fts(person_fts, rowid, first_name, last_name, company, title, notes_md)
  VALUES ('delete', old.id, old.first_name, old.last_name, old.company, old.title, old.notes_md);
  INSERT INTO person_fts(rowid, first_name, last_name, company, title, notes_md)
  VALUES (new.id, new.first_name, new.last_name, new.company, new.title, new.notes_md);
END;
