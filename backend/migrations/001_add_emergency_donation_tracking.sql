-- ============================================
-- Migration: Donation eligibility + emergency approval support
-- Safe to run on an existing blood_bank database (idempotent).
-- ============================================

ALTER TABLE donation_requests ADD COLUMN IF NOT EXISTS units INTEGER NOT NULL DEFAULT 1;
ALTER TABLE donation_requests ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE donation_requests ADD COLUMN IF NOT EXISTS emergency_approved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE donation_history ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- Backfill email on existing history rows from the linked user, where possible
UPDATE donation_history dh
SET email = u.email
FROM users u
WHERE dh.user_id = u.id AND dh.email IS NULL;

CREATE INDEX IF NOT EXISTS idx_donation_history_email ON donation_history(email);
