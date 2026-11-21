-- Optional phone number on a client account.

ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
