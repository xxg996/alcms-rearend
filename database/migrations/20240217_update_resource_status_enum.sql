BEGIN;

ALTER TABLE resources
  DROP CONSTRAINT IF EXISTS resources_status_check,
  ADD CONSTRAINT resources_status_check
    CHECK (status IN ('draft', 'published', 'archived', 'deleted'));

COMMIT;
