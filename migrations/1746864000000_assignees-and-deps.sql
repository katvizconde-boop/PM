-- Up Migration

-- Multiple assignees. We keep `tasks.assignee_id` as the "primary" / owner;
-- task_assignees holds additional collaborators (reviewer, pair, etc.).
-- Lets existing endpoints + tooling keep working unchanged.
CREATE TABLE task_assignees (
  task_id  INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);

-- Task dependencies (many-to-many self-reference).
-- blocking_task_id finishes first; blocked_task_id has to wait.
CREATE TABLE task_dependencies (
  blocking_task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  blocked_task_id  INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocking_task_id, blocked_task_id),
  CHECK (blocking_task_id <> blocked_task_id)
);
CREATE INDEX idx_dep_blocking ON task_dependencies(blocking_task_id);
CREATE INDEX idx_dep_blocked  ON task_dependencies(blocked_task_id);

-- Down Migration

DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS task_assignees;
