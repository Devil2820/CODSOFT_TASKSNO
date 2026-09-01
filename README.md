# Blood Bank App

Full-stack blood bank management system — Node.js/Express backend, PostgreSQL database, vanilla JS frontend. Handles donor registration, blood stock tracking, donation requests with a 90-day eligibility check (with emergency override), and an admin panel for managing everything.

## Run with Docker

```bash
docker compose up --build
```

Spins up the app and a seeded Postgres database. Open `http://localhost:4000`.

Demo logins:
| Role  | Username | Password  |
|-------|----------|-----------|
| User  | `user`   | `user123` |
| Admin | `admin`  | `admin123`|

Pre-built image: `docker pull devil2820/blood-bank-app:latest`

To stop: `docker compose down` (add `-v` to also wipe the database).

## Run without Docker

Requires Node 18+ and PostgreSQL 14+.

```bash
psql -U postgres -c "CREATE DATABASE blood_bank"
psql -U postgres -d blood_bank -f backend/schema.sql
psql -U postgres -d blood_bank -f backend/seed.sql

cd backend
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm install
npm start
```

## Structure

```
backend/    Express API (routes, db, JWT auth)
frontend/   HTML/CSS/JS, served statically by the same Express app
Dockerfile, docker-compose.yml   Containerized setup (app + postgres)
```

## Key features

- JWT-based auth with user/admin roles
- Donation eligibility logic (90-day cooldown) with an admin-approved emergency override
- Admin dashboard: manage blood stock, donors, requests, and contact messages
- Full API reference in `backend/routes/`

## Production notes

- Never commit `.env` — it holds `JWT_SECRET` and DB credentials.
- Put this behind HTTPS in production (e.g. an Nginx reverse proxy).