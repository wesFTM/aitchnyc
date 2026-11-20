-- Commercial listing fields.
-- is_inactive stores the commercial Active/Inactive choice. The shared status
-- check stays limited to active, pending, rented, and sold.

ALTER TABLE properties ADD COLUMN sqft_optional INTEGER;
ALTER TABLE properties ADD COLUMN key_money_cents INTEGER;
ALTER TABLE properties ADD COLUMN possession TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN terms TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN frontage TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN ceiling_height TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN neighboring_tenants TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN is_inactive INTEGER NOT NULL DEFAULT 0 CHECK (is_inactive IN (0, 1));
