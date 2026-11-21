-- Company details and logo for a client's private listings page.

ALTER TABLE users ADD COLUMN company_website TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN company_zip TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN logo_key TEXT;
ALTER TABLE users ADD COLUMN logo_content_type TEXT;
