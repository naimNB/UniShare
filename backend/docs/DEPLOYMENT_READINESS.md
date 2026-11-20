# UniShare Deployment Readiness & Architecture Guide

This document outlines the architecture, security policies, and step-by-step roadmap for migrating UniShare from local single-node development (SQLite + local disk storage) to a free-tier/low-cost cloud deployment (PostgreSQL, Supabase Storage, Discord Webhook Alerts, and Cloudflare Turnstile).

---

## 1. System Architecture Overview

UniShare is designed as a **publicly read-only academic resource repository** with a **moderated note contribution pipeline**:
- **Students & General Public**: Unauthenticated read-only access (browsing, searching, previewing, and downloading PDFs). Can submit new study materials via `POST /api/submissions`.
- **Maintainers**: Authenticated out-of-band via developer CLI (`backend/scripts/review_submissions.py`) or administrative scripts to approve or reject pending notes.
- **Zero Public Admin Endpoints**: No public administrative HTTP routes (`approve`, `reject`, `delete`, `update`) exist on the FastAPI backend, eliminating credential stuffing and authorization bypass vectors.

```
                    +------------------------------------+
                    |        Frontend (Vite + React)     |
                    |   Turnstile Token / Read-Only UI   |
                    +-----------------+------------------+
                                      |
                         HTTP / REST  |  Cloudflare Proxy
                                      v
                    +------------------------------------+
                    |       FastAPI Backend Service      |
                    |    (Render / Fly.io / Railway)     |
                    +--------+------------------+--------+
                             |                  |
           Public Read /     |                  | Pending Staging /
           Resource Download |                  | Webhook Notifications
                             v                  v
         +-----------------------+    +-----------------------+
         | Managed PostgreSQL    |    | Supabase Storage      |
         | (Supabase / Neon DB)  |    | - 'submissions' (Priv)|
         | - 78 Courses          |    | - 'resources' (Pub)   |
         | - Categories          |    +-----------------------+
         | - Submissions & Meta  |              |
         +-----------------------+              v
                                      +-----------------------+
                                      | Discord Webhook Alert |
                                      | Maintainer Review CLI |
                                      +-----------------------+
```

---

## 2. PostgreSQL Database Setup & Migration

### Current State
- Local SQLite file (`backend/unishare.db`) with 78 CSE curriculum courses, 5 categories, and 12 baseline resources.
- Thread-safe engine configurations with `PRAGMA foreign_keys=ON`.

### Target Cloud State
- PostgreSQL 15+ (free tiers available on Supabase, Neon, or Render).
- Driver: `psycopg2-binary` or `asyncpg`.
- Connection string format:
  ```
  DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require
  ```

### Migration Execution Steps
1. **Schema Generation via Alembic**:
   Initialize migrations in the repository:
   ```bash
   alembic init backend/alembic
   ```
   Configure `env.py` to point to `Base.metadata` in `backend/app/models.py`.
2. **Export Baseline Data from SQLite**:
   Export curriculum tables (Courses, Categories, and baseline Resources) into JSON fixtures:
   ```bash
   python backend/scripts/export_fixtures.py --out fixtures/curriculum_78.json
   ```
3. **Target Database Provisioning**:
   Apply migrations to the remote PostgreSQL instance:
   ```bash
   DATABASE_URL="postgresql://..." alembic upgrade head
   ```
4. **Seed PostgreSQL Instance**:
   Run the idempotent seeding script against the PostgreSQL database to populate all 78 courses and categories without altering course IDs or semester mappings.

---

## 3. Supabase Object Storage Architecture

Local storage currently stages pending files in `backend/storage/submissions` and approved files in `backend/storage/uploads`. In cloud production, local ephemeral disks (e.g. Render/Fly.io) lose files upon container restart.

### Bucket Design
| Bucket Name | Access Level | Purpose | Retention Policy |
| :--- | :--- | :--- | :--- |
| **`submissions`** | **Private** | Holds unverified PDF files from students. Not publicly accessible via direct URL. | Retained until maintainer approves or rejects. Removed on rejection. |
| **`resources`** | **Public Read** | Holds approved study materials. CDN-cached for fast student downloads and previews. | Permanent. |

### Supabase Storage Flow
1. **Submission (`POST /api/submissions`)**:
   - Backend validates PDF bytes (magic bytes, encryption check, 10 MB limit).
   - Backend uploads file to private `submissions` bucket using the Supabase Service Role Key:
     ```python
     supabase.storage.from_("submissions").upload(
         path=f"{uuid}.pdf",
         file=file_bytes,
         file_options={"content-type": "application/pdf"}
     )
     ```
2. **Review & Approval (`cmd_approve`)**:
   - Maintainer approves via review CLI.
   - Stored object is copied from `submissions/{uuid}.pdf` to `resources/{uuid}.pdf`.
   - `Resource` row is inserted into PostgreSQL inside a database transaction.
   - Staged copy is preserved in `submissions` for audit trail.

---

## 4. Abuse Prevention & Cloudflare Turnstile

### Current State
- In-memory sliding window rate limiting (10 requests/minute/IP) with automatic memory pruning.

### Production Abuse Prevention
1. **Cloudflare Turnstile (Free Anti-Bot Protection)**:
   - Add `<Turnstile siteKey={SITE_KEY} onVerify={(token) => setToken(token)} />` to `frontend/src/pages/ContributePage.tsx`.
   - Send `cf_turnstile_token` in form data.
   - Backend validates token against Cloudflare Siteverify API:
     ```python
     async def verify_turnstile(token: str, remote_ip: str) -> bool:
         async with httpx.AsyncClient() as client:
             res = await client.post(
                 "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                 data={
                     "secret": settings.CF_TURNSTILE_SECRET_KEY,
                     "response": token,
                     "remoteip": remote_ip,
                 },
                 timeout=5.0,
             )
             return res.json().get("success", False)
     ```
2. **Distributed Rate Limiting (Redis)**:
   - For multi-worker Uvicorn setups, replace in-memory `_client_timestamps` with Upstash Redis (free tier) sliding window rate limiter.

---

## 5. Discord Webhook Notifications for Maintainers

To eliminate the need for manual polling, new note submissions trigger an asynchronous Discord embed to the maintainer channel.

### Payload Schema
```json
{
  "username": "UniShare Sentinel",
  "avatar_url": "https://unishare.edu/logo.png",
  "embeds": [
    {
      "title": "📥 New Note Submitted for Review",
      "color": 1460801,
      "fields": [
        {"name": "Submission ID", "value": "#14", "inline": true},
        {"name": "Course", "value": "CSE 3101 — Database Systems", "inline": true},
        {"name": "Category", "value": "Lecture Notes", "inline": true},
        {"name": "Title", "value": "Relational Calculus & Query Plans", "inline": false},
        {"name": "File Size", "value": "2.4 MB", "inline": true},
        {"name": "Contributor", "value": "Tanvir Rahim", "inline": true},
        {"name": "Review Command", "value": "`python backend/scripts/review_submissions.py show 14`", "inline": false}
      ],
      "timestamp": "2026-11-20T17:20:00Z"
    }
  ]
}
```

---

## 6. Environment Variables Reference

| Variable | Description | Required in Production | Default (Local Dev) |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string | **Yes** | `sqlite:///./unishare.db` |
| `STORAGE_BACKEND` | Storage driver (`local` or `supabase`) | No | `local` |
| `STORAGE_DIR` | Local public storage directory | No (when local) | `./backend/storage/uploads` |
| `SUBMISSIONS_DIR` | Local private staging directory | No (when local) | `./backend/storage/submissions` |
| `SUPABASE_URL` | Supabase project API URL | Only if `supabase` | `None` |
| `SUPABASE_SERVICE_ROLE_KEY`| Service role key for private storage | Only if `supabase` | `None` |
| `DISCORD_WEBHOOK_URL` | Webhook URL for maintainer alerts | Recommended | `None` (alerts disabled) |
| `CF_TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | Recommended | `None` (bypass in dev) |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | **Yes** | `http://localhost:5173,...` |

---

## 7. Backup and Disaster Recovery Strategy

1. **Daily Database Dumps**:
   - Automated `pg_dump -Fc` cron job running daily, stored with 30-day retention in an isolated S3/GCS bucket.
2. **Storage Object Versioning**:
   - Enable object versioning on the `resources` bucket in Supabase to prevent accidental overwrites or data loss.
3. **Local Database Fallback**:
   - Always retain the verified curriculum seed (`78 courses, 161 credits`) in source code (`backend/scripts/seed.py`) to guarantee zero-data-loss rebuilds from scratch if needed.
