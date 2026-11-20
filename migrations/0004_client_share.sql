-- Private client page links. Any email can be stored; the link is the way a client opens their listings.

ALTER TABLE users ADD COLUMN share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users (share_token);

UPDATE users
SET share_token = lower(hex(randomblob(16)))
WHERE role = 'client' AND (share_token IS NULL OR share_token = '');
