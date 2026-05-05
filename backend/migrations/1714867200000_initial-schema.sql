-- Up Migration

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role      AS ENUM ('admin', 'manager', 'member');
CREATE TYPE project_status AS ENUM ('not_started', 'in_progress', 'done');
CREATE TYPE task_status    AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE task_priority  AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         CITEXT UNIQUE NOT NULL,
  name          TEXT   NOT NULL,
  password_hash TEXT   NOT NULL,
  role          user_role NOT NULL DEFAULT 'member',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  owner_id    INT  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      project_status NOT NULL DEFAULT 'not_started',
  deadline    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_owner  ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  project_id  INT  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
  status      task_status   NOT NULL DEFAULT 'todo',
  priority    task_priority NOT NULL DEFAULT 'medium',
  due_date    DATE,
  created_by  INT  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_project  ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

CREATE TABLE comments (
  id         SERIAL PRIMARY KEY,
  task_id    INT  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_task ON comments(task_id);

CREATE TABLE activity_logs (
  id          SERIAL PRIMARY KEY,
  actor_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   INT  NOT NULL,
  action      TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_entity  ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;
DROP TYPE  IF EXISTS task_priority;
DROP TYPE  IF EXISTS task_status;
DROP TYPE  IF EXISTS project_status;
DROP TYPE  IF EXISTS user_role;
