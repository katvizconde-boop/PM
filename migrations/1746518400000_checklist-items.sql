-- Up Migration

CREATE TABLE checklist_items (
  id            SERIAL PRIMARY KEY,
  project_id    INT  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position      INT  NOT NULL,
  text          TEXT NOT NULL,
  completed_at  TIMESTAMPTZ,
  completed_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_checklist_project_position ON checklist_items(project_id, position);

-- Down Migration

DROP TABLE IF EXISTS checklist_items;
