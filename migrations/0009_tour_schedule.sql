-- After a client requests a tour, an admin can set the date and time.

ALTER TABLE listing_likes ADD COLUMN tour_scheduled_at TEXT;
