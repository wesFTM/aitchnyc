-- Close date and the commission inputs used to compute net commission.

ALTER TABLE deals ADD COLUMN close_date TEXT;
ALTER TABLE deals ADD COLUMN gross_commission_cents INTEGER;
ALTER TABLE deals ADD COLUMN company_split_bps INTEGER;
ALTER TABLE deals ADD COLUMN referral_fee_cents INTEGER;
