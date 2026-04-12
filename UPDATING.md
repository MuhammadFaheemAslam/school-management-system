# Production Update Guide

How to safely release new features or fixes to the client's running app — without losing any data.

---

## How Data Is Protected During Updates

Understanding this removes all fear of updates breaking the client's data.

```
docker compose down        ← stops containers (code)
docker compose up -d       ← starts new containers (new code)

postgres_data volume       ← NEVER touched — all student/teacher/fee data lives here
media_files volume         ← NEVER touched — uploaded files (photos, documents)
static_files volume        ← rebuilt by Django collectstatic (safe, auto-managed)
```

**Containers are disposable. Volumes are permanent.**
Pulling a new image and restarting is like swapping the app's executable — the database is untouched.

---

## PART 1 — Developer Side (You)

### Step 1 — Make your code changes

Make whatever changes you need: new features, bug fixes, UI updates, model changes, etc.

---

### Step 2 — Handle database migrations (if you changed models)

If you added, removed, or changed any Django model field, create migrations locally before building:

```bash
cd backend
python manage.py makemigrations
python manage.py migrate   # test locally first
```

Commit the new migration files. They will be included in the Docker image.
The `entrypoint.sh` runs `migrate --noinput` on every startup, so migrations apply automatically when the client updates.

> **Safe migration practices:**
> - Adding a new field → always safe (use `null=True, blank=True` for existing rows)
> - Adding a new model → always safe
> - Renaming a field → do it in two releases: add new field → copy data → remove old field
> - Removing a field → make sure no code references it before removing it from the model
> - Never run `migrate --fake` on production unless you are fixing a broken state

---

### Step 3 — Tag your release with a version number

Using version tags instead of always overwriting `latest` lets you roll back instantly if something goes wrong.

```bash
# Use semantic versioning: v1.0.0, v1.1.0, v1.2.0 ...
VERSION=v1.2.0
DOCKER_USER=your-dockerhub-username
```

---

### Step 4 — Build and push backend

```bash
docker build -t $DOCKER_USER/school-backend:$VERSION \
             -t $DOCKER_USER/school-backend:latest \
             ./backend

docker push $DOCKER_USER/school-backend:$VERSION
docker push $DOCKER_USER/school-backend:latest
```

Pushing two tags at once:
- `latest` → client always gets the newest version with a simple `docker compose pull`
- `v1.2.0` → pinned tag for rollback if needed

---

### Step 5 — Build and push frontend

```bash
docker build \
  --build-arg VITE_API_URL=/api \
  -t $DOCKER_USER/school-frontend:$VERSION \
  -t $DOCKER_USER/school-frontend:latest \
  ./frontend

docker push $DOCKER_USER/school-frontend:$VERSION
docker push $DOCKER_USER/school-frontend:latest
```

---

### Step 6 — Write release notes for the client

Tell the client:
- What changed (new features, fixes)
- Whether there are database migrations (usually they don't need to do anything extra)
- Whether the `.env` file needs new variables
- The version number

Example message to client:
```
Version v1.2.0 is ready.
Changes: Added fee payment report, fixed attendance export bug.
To update: run the two commands below.
No changes needed to your .env file.
```

---

## PART 2 — Client Side (How to Apply the Update)

### Normal update (no .env changes needed)

```bash
cd school-app

# Pull the new images from Docker Hub
docker compose pull

# Restart containers with the new images
docker compose up -d
```

That's it. Docker will:
1. Download only the changed layers (fast after the first time)
2. Stop the old containers
3. Start new containers with the updated code
4. Run any new database migrations automatically
5. Rebuild static files
6. Resume serving the app

**Downtime:** approximately 10–30 seconds while containers restart.

---

### Update with new .env variables

If the new version requires new environment variables (developer will tell you):

```bash
# 1. Open .env and add the new variables
notepad .env       # Windows
nano .env          # Linux/Mac

# 2. Pull and restart
docker compose pull
docker compose up -d
```

---

### Update with a specific version (instead of latest)

If the developer gives you a specific version number like `v1.2.0`:

Open `docker-compose.yml` and change the image tags:

```yaml
# Before
image: your-dockerhub-username/school-backend:latest
image: your-dockerhub-username/school-frontend:latest

# After
image: your-dockerhub-username/school-backend:v1.2.0
image: your-dockerhub-username/school-frontend:v1.2.0
```

Then run:
```bash
docker compose pull
docker compose up -d
```

---

## PART 3 — Rollback (If Something Goes Wrong)

If after an update the app has a problem, roll back to the previous version in under 2 minutes.

### Option A — Roll back using a version tag (recommended)

```bash
cd school-app
```

Open `docker-compose.yml` and change the image tags back to the last working version:

```yaml
image: your-dockerhub-username/school-backend:v1.1.0
image: your-dockerhub-username/school-frontend:v1.1.0
```

Then:
```bash
docker compose pull
docker compose up -d
```

The app is back to the previous version. **All data is intact** — only the code changed.

---

### Option B — Roll back if you always use `latest`

If you did not use version tags, the developer must push the old code again as `latest`:

```bash
# Developer re-builds from the previous git commit
git checkout v1.1.0
docker build -t $DOCKER_USER/school-backend:latest ./backend
docker push $DOCKER_USER/school-backend:latest
# (same for frontend)
```

Then client runs:
```bash
docker compose pull
docker compose up -d
```

> This is why version tags are strongly recommended.

---

### Rolling back a database migration

This is the only genuinely tricky case. If the new version added a migration that changed the database schema, and you rolled back the code, Django may complain that the database is ahead of the code.

**Simple fix (reverse the migration):**

```bash
# On client machine — find the previous migration name
docker compose exec backend python manage.py showmigrations

# Reverse to a specific migration (example: accounts 0003)
docker compose exec backend python manage.py migrate accounts 0003

# Then restart
docker compose restart backend
```

**Best prevention:** for risky migrations (dropping columns, renaming fields), always do a two-release deploy:
- Release 1: new code that works with both old and new schema
- Release 2: remove old schema once everything is confirmed working

---

## PART 4 — Pre-Update Checklist

Run through this before every production update:

```
Developer side:
[ ] Code changes are tested locally
[ ] New migrations created and tested locally
[ ] Any new .env variables documented for the client
[ ] Images built and pushed with a version tag AND latest
[ ] Release notes written

Client side:
[ ] Inform users of a brief maintenance window (10–30 seconds)
[ ] Take a database backup (see below)
[ ] Run: docker compose pull
[ ] Run: docker compose up -d
[ ] Open the app and verify it works
[ ] Check logs if anything looks wrong: docker compose logs -f backend
```

---

## PART 5 — Database Backup Before Any Update

Always back up before a production update. This takes 30 seconds.

### Create a backup

```bash
cd school-app

# Creates a file: backup_2024-01-15.sql
docker compose exec db pg_dump -U school_user school_db > backup_$(date +%Y-%m-%d).sql
```

### Restore from backup (if needed)

```bash
# Stop the backend first so nothing writes to the DB
docker compose stop backend

# Restore
docker compose exec -T db psql -U school_user school_db < backup_2024-01-15.sql

# Restart
docker compose start backend
```

### Automate daily backups (optional)

Add this to crontab on the client server (`crontab -e`):

```cron
# Every day at 2:00 AM
0 2 * * * cd /path/to/school-app && docker compose exec -T db pg_dump -U school_user school_db > /backups/school_$(date +\%Y-\%m-\%d).sql
```

---

## Update Scenarios Quick Reference

| Scenario | What developer does | What client does |
|----------|--------------------|--------------------|
| Bug fix (no model change) | Build & push new images | `docker compose pull && docker compose up -d` |
| New feature (no model change) | Build & push new images | `docker compose pull && docker compose up -d` |
| New feature (with model change) | Add migration + build & push | `docker compose pull && docker compose up -d` |
| New .env variable required | Notify client of new variable | Add to `.env`, then pull & up |
| Urgent rollback needed | Push old version as new tag | Change tag in `docker-compose.yml`, pull & up |

---

## What NEVER Gets Deleted During a Normal Update

| Data | Stored in | Safe during update? |
|------|-----------|---------------------|
| Students, teachers, users | `postgres_data` volume | Yes |
| Fee records, attendance, marks | `postgres_data` volume | Yes |
| Uploaded photos and documents | `media_files` volume | Yes |
| App settings and configurations | `postgres_data` volume | Yes |
| Static files (CSS, JS) | `static_files` volume | Yes (rebuilt automatically) |

The only way to lose data is to explicitly run `docker compose down -v` (which deletes all volumes). Normal updates never do this.
