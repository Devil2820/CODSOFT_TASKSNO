-- ============================================
-- Blood Bank Database Schema (PostgreSQL)
-- ============================================

DROP TABLE IF EXISTS donation_history CASCADE;
DROP TABLE IF EXISTS donation_requests CASCADE;
DROP TABLE IF EXISTS contact_messages CASCADE;
DROP TABLE IF EXISTS blood_stock CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ---------- Users (login: user & admin roles) ----------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(100) UNIQUE,
    phone         VARCHAR(20),
    blood_type    VARCHAR(5),
    role          VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    city          VARCHAR(100),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- Blood stock inventory ----------
CREATE TABLE blood_stock (
    blood_type      VARCHAR(5) PRIMARY KEY,
    units_available INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- Donation requests (from Donate page form) ----------
CREATE TABLE donation_requests (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name           VARCHAR(100) NOT NULL,
    blood_type          VARCHAR(5) NOT NULL,
    email               VARCHAR(100) NOT NULL,
    phone               VARCHAR(20) NOT NULL,
    age                 INTEGER NOT NULL CHECK (age BETWEEN 18 AND 65),
    preferred_date      DATE NOT NULL,
    address             TEXT NOT NULL,
    units               INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
    is_emergency        BOOLEAN NOT NULL DEFAULT false,
    emergency_approved  BOOLEAN NOT NULL DEFAULT false,
    status              VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Completed')),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- Completed donation history (for user dashboard stats + eligibility checks) ----------
CREATE TABLE donation_history (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email         VARCHAR(100),
    donation_date DATE NOT NULL,
    blood_type    VARCHAR(5) NOT NULL,
    units         INTEGER NOT NULL DEFAULT 1,
    location      VARCHAR(150),
    status        VARCHAR(20) NOT NULL DEFAULT 'Completed'
);

-- ---------- Contact form messages ----------
CREATE TABLE contact_messages (
    id         SERIAL PRIMARY KEY,
    full_name  VARCHAR(100) NOT NULL,
    email      VARCHAR(100) NOT NULL,
    subject    VARCHAR(200) NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donation_requests_status ON donation_requests(status);
CREATE INDEX idx_donation_requests_blood_type ON donation_requests(blood_type);
CREATE INDEX idx_donation_history_user ON donation_history(user_id);
CREATE INDEX idx_donation_history_email ON donation_history(email);
