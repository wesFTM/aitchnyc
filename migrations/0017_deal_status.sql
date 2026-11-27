-- Deal stage: in process, closed, or complete. Existing deals start in process.

ALTER TABLE deals ADD COLUMN status TEXT NOT NULL DEFAULT 'in_process' CHECK (status IN ('in_process', 'closed', 'complete'));
