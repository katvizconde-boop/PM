-- Up Migration

-- Per-project module toggles. JSONB lets us add new tabs over time without
-- needing a new column each. Default: every tab we currently have is on.
ALTER TABLE projects
  ADD COLUMN modules JSONB NOT NULL DEFAULT
  '{"dashboard": true, "roadmap": true, "tasks": true, "notes": true}'::jsonb;

-- Down Migration

ALTER TABLE projects DROP COLUMN IF EXISTS modules;
