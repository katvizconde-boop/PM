-- Up Migration

ALTER TABLE projects ADD COLUMN notes TEXT;

-- Down Migration

ALTER TABLE projects DROP COLUMN notes;
