-- Up Migration

-- Subtask: a task can hierarchically nest under another in the same project.
-- ON DELETE CASCADE so parent removal cascades to children.
ALTER TABLE tasks
  ADD COLUMN parent_task_id INT REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- Tags: free-form text array on the task itself. Native Postgres TEXT[] avoids
-- a new join table and a new API function — keeps us under the 12-function cap.
-- Lookup by tag uses the GIN index for fast contains-any queries.
ALTER TABLE tasks
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX idx_tasks_tags ON tasks USING GIN (tags);

-- Down Migration

DROP INDEX IF EXISTS idx_tasks_tags;
DROP INDEX IF EXISTS idx_tasks_parent;
ALTER TABLE tasks DROP COLUMN IF EXISTS tags;
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_task_id;
