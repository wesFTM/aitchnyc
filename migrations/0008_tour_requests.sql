-- A liked listing can be marked when the client asks for a tour.

ALTER TABLE listing_likes ADD COLUMN tour_requested INTEGER NOT NULL DEFAULT 0;
