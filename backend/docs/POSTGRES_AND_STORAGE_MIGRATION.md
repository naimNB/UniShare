# UniShare PostgreSQL & Supabase Storage Migration Strategy

This document provides a production guide for transitioning UniShare from local development (SQLite + local disk storage) to managed cloud infrastructure (PostgreSQL + Supabase Storage) without data corruption, foreign-key misalignment, or downtime.

---

## 1. Relational Integrity & Migration Strategy

The UniShare schema relies on strict foreign-key dependencies:
- `resources.course_id` -> `courses.id` (ON DELETE CASCADE)
- `resources.category_id` -> `categories.id` (ON DELETE RESTRICT)
- `submissions.course_id` -> `courses.id` (ON DELETE CASCADE)
- `submissions.category_id` -> `categories.id` (ON DELETE RESTRICT)

### Preserving Existing Primary Keys & Relationships
During migration, auto-increment sequences must **not** renumber entities, because:
1. Frontend URLs depend on stable course and resource IDs (`/courses/1`, `/library?course_id=2`).
2. Foreign key linkages between `resources` and `courses`/`categories` must remain 100% identical.

### Safe Migration Workflow

```
 +--------------------+       JSON / SQL Dump        +--------------------+
 | Local SQLite DB    | --------------------------> | Remote PostgreSQL  |
 | 78 Courses         |   (Preserve explicit IDs)   | (Alembic Baseline) |
 | 5 Categories       |                             |                    |
 | 12 Resources       |                             | Reset Sequences    |
 +--------------------+                             +--------------------+
```

#### Step 1: Initialize PostgreSQL Target with Alembic
Do not run raw table creates. Apply the versioned Alembic migration:
```bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
alembic upgrade head
```

#### Step 2: Export Data in Topological Order
Export tables in foreign-key dependency order:
1. `courses` (78 rows)
2. `categories` (5 rows)
3. `resources` (12 rows)
4. `submissions` (0+ rows)

An export script extracts rows with explicit primary keys and ISO-8601 UTC timestamps:
```python
# Topological export preserving exact IDs
courses = db.query(Course).order_by(Course.id).all()
categories = db.query(Category).order_by(Category.id).all()
resources = db.query(Resource).order_by(Resource.id).all()
submissions = db.query(Submission).order_by(Submission.id).all()
```

#### Step 3: Insert with Explicit IDs into PostgreSQL
Disable trigger checks during insertion or insert in order:
```sql
-- PostgreSQL respects explicit ID inserts on SERIAL / IDENTITY columns:
INSERT INTO courses (id, code, name, semester, credits, display_order, description) VALUES ...;
INSERT INTO categories (id, name, description) VALUES ...;
INSERT INTO resources (id, title, description, course_id, category_id, file_path, original_filename, mime_type, file_size, created_at, download_count) VALUES ...;
```

#### Step 4: Advance PostgreSQL Identity Sequences
After inserting explicit IDs, the internal PostgreSQL sequence must be advanced to the maximum existing ID. Otherwise, the next `INSERT` will attempt to use `id = 1` and fail with a primary key collision:
```sql
SELECT setval(pg_get_serial_sequence('courses', 'id'), coalesce(max(id), 1)) FROM courses;
SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 1)) FROM categories;
SELECT setval(pg_get_serial_sequence('resources', 'id'), coalesce(max(id), 1)) FROM resources;
SELECT setval(pg_get_serial_sequence('submissions', 'id'), coalesce(max(id), 1)) FROM submissions;
```

---

## 2. File Migration to Supabase Object Storage

Local documents currently reside on disk:
- `backend/storage/uploads/` -> Approved public materials
- `backend/storage/submissions/` -> Moderated staged materials

### Supabase Storage Layout
- Bucket `resources` (Public Read): Serves student downloads and PDF viewer previews.
- Bucket `submissions` (Private): Staging area strictly accessible via Service Role credentials.

### File Sync Procedure
Sync files using the Supabase REST API or S3 compatibility layer:
```bash
# Upload all public resources to Supabase
for file in backend/storage/uploads/*.pdf; do
  filename=$(basename "$file")
  curl -X POST "$SUPABASE_URL/storage/v1/object/resources/$filename" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/pdf" \
    --data-binary @"$file"
done
```
Post-upload integrity verification:
Compare local file SHA-256 hashes against remote object metadata to guarantee 100% byte fidelity.

---

## 3. Privacy & Retention Risks of Staged PDF Copies

### Risk Analysis
Keeping duplicate staged copies of approved notes in `backend/storage/submissions` causes several problems:
1. **Storage Bloat**: Approved files are stored twice (once in `submissions`, once in `uploads`), doubling storage consumption.
2. **Privacy & Right-to-be-Forgotten**: If a student requests that their contribution be removed, maintainers deleting the public resource may leave the staged copy behind in private storage, violating student data privacy rights (FERPA / GDPR).
3. **Copyright & Takedown Liability**: Retaining unpurged copies of DMCA-takedown material exposes maintainers to recurring liability.

### Recommended Bounded Retention Policy
1. **Approved Submissions**:
   - Retain the staged copy in `submissions` for **30 days** post-approval to facilitate review verification or dispute resolution.
   - After 30 days, a scheduled cleanup script purges the staged PDF binary from private storage.
   - The database row in `submissions` is permanently retained for audit purposes, but the binary is pruned.
2. **Rejected Submissions**:
   - Retain rejected files for **7 days** (quarantine) before deleting the staged binary.
   - The database record preserves the rejection reason and timestamp.
3. **SHA-256 Provenance**:
   - Store a `file_hash` on `Submission` and `Resource`. Mathematical provenance is proven without keeping redundant duplicate PDF binaries.

---

## 4. Cloud Integrations Specification

### Discord Webhook Alerts
- **Environment Variable**: `DISCORD_WEBHOOK_URL`
- **Activation Flag**: `DISCORD_NOTIFICATIONS_ENABLED=true`
- **Execution Pattern**: Non-blocking asynchronous task (FastAPI `BackgroundTasks`).
- **Resilience**: If the Discord API is down, rate-limited, or unreachable, student submissions must still succeed. Webhook errors must be logged at `WARNING` level without rolling back database transactions.

### Durable Rate Limiting (Redis & Cloudflare Turnstile)
In multi-worker production (e.g. Uvicorn with 4 workers behind Nginx/Fly.io):
- **Redis (`REDIS_URL`)**: Provides centralized sliding-window rate limiting across all workers.
- **Cloudflare Turnstile (`CF_TURNSTILE_SECRET_KEY`)**: Validates human interaction on `POST /api/submissions`, eliminating automated spam without frustrating CAPTCHAs.
