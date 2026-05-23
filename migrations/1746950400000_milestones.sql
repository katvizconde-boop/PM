-- Up Migration

CREATE TABLE milestones (
  id          SERIAL PRIMARY KEY,
  project_id  INT  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'completed', 'archived')),
  position    INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_milestones_project ON milestones(project_id, position);

-- Optional link: a task may belong to one milestone. SET NULL on delete so a
-- milestone wipe doesn't take its tasks with it.
ALTER TABLE tasks ADD COLUMN milestone_id INT REFERENCES milestones(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);

-- Down Migration

DROP INDEX IF EXISTS idx_tasks_milestone;
ALTER TABLE tasks DROP COLUMN IF EXISTS milestone_id;
DROP TABLE IF EXISTS milestones;
