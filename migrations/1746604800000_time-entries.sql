-- Up Migration

CREATE TABLE time_entries (
  id          SERIAL PRIMARY KEY,
  task_id     INT  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_time_task          ON time_entries(task_id);
CREATE INDEX idx_time_user_started  ON time_entries(user_id, started_at DESC);

-- Enforce at most one running timer per user. NULL ended_at = running.
CREATE UNIQUE INDEX idx_time_one_running_per_user
  ON time_entries(user_id) WHERE ended_at IS NULL;

-- Down Migration

DROP TABLE IF EXISTS time_entries;
