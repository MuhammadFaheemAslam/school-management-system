# Docker Hub Deployment Guide

Deploy the School Management System by pushing images to Docker Hub, then running them on any client machine — no source code needed on the client.

---

## Overview

```
Your Machine (Developer)          Client Machine
─────────────────────────         ─────────────────────────
1. Build Docker images            4. Create docker-compose.yml
2. Push to Docker Hub      ──►    5. Create .env file
3. Done                           6. docker compose up -d
                                  7. App is live ✓
```

---

## PART 1 — Developer Machine (Do This Once)

### Step 1 — Update entrypoint.sh to auto-create superuser

The current `entrypoint.sh` does not create a superuser automatically. Update it so the client doesn't need to run any extra commands.

Open `backend/entrypoint.sh` and replace its contents with:

```sh
#!/bin/sh
set -e

echo "==> Waiting for database..."
until python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
" 2>/dev/null; do
  echo "    Database not ready — retrying in 2s..."
  sleep 2
done
echo "    Database ready."

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Creating superuser (if not exists)..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
import os
User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'superadmin')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'Admin@12345')
email    = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@school.com')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, password=password, email=email)
    print(f'Superuser created: {username}')
else:
    print(f'Superuser already exists: {username}')
"

echo "==> Starting Gunicorn..."
exec gunicorn school_management.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 1 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

> This script auto-creates the superuser on first startup using the credentials from the `.env` file. If the user already exists, it skips creation silently.

---

### Step 2 — Log in to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password when prompted.

---

### Step 3 — Build and push the backend image

Replace `your-dockerhub-username` with your actual Docker Hub username in every command below.

```bash
# Build
docker build -t your-dockerhub-username/school-backend:latest ./backend

# Push
docker push your-dockerhub-username/school-backend:latest
```

---

### Step 4 — Build and push the frontend image

The frontend image bakes the API URL at build time. Build it with the correct value:

```bash
# Build (replace yourdomain.com with the client's actual domain or IP)
docker build \
  --build-arg VITE_API_URL=/api \
  -t your-dockerhub-username/school-frontend:latest \
  ./frontend

# Push
docker push your-dockerhub-username/school-frontend:latest
```

> Use `VITE_API_URL=/api` when the frontend and backend share the same domain/IP (recommended). This works for both `http://localhost` and any real domain.

---

### Step 5 — Verify images are on Docker Hub

Go to [https://hub.docker.com](https://hub.docker.com) and confirm both repositories appear:
- `your-dockerhub-username/school-backend`
- `your-dockerhub-username/school-frontend`

---

## PART 2 — Client Machine (Share These Files)

The client only needs **two files**. Send them both.

---

### File 1 — `docker-compose.yml`

Create this file on the client machine. Replace `your-dockerhub-username` with your actual Docker Hub username.

```yaml
services:

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB:       ${DB_NAME}
      POSTGRES_USER:     ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    image: your-dockerhub-username/school-backend:latest
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - media_files:/app/media
      - static_files:/app/staticfiles
    expose:
      - "8000"

  frontend:
    image: your-dockerhub-username/school-frontend:latest
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    volumes:
      - media_files:/media:ro
      - static_files:/static:ro

volumes:
  postgres_data:
  media_files:
  static_files:
```

> **Key difference from the dev version:** `build:` is replaced with `image:` — the client pulls from Docker Hub instead of building from source.

---

### File 2 — `.env`

Create this file in the same folder as `docker-compose.yml` on the client machine.

```env
# ── Django ──────────────────────────────────────────────
SECRET_KEY=change-me-to-a-long-random-string
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# ── Database (PostgreSQL) ────────────────────────────────
DB_NAME=school_db
DB_USER=school_user
DB_PASSWORD=StrongPassword123
DB_HOST=db
DB_PORT=5432

# ── CORS & URLs ──────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost
FRONTEND_URL=http://localhost

# ── Email (Gmail SMTP) ───────────────────────────────────
EMAIL_HOST_USER=yourschool@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# ── Frontend build ───────────────────────────────────────
VITE_API_URL=/api

# ── Superuser (auto-created on first startup) ────────────
DJANGO_SUPERUSER_USERNAME=superadmin
DJANGO_SUPERUSER_PASSWORD=Admin@12345
DJANGO_SUPERUSER_EMAIL=admin@school.com
```

**Fields the client must fill in:**

| Field | What to put |
|-------|-------------|
| `SECRET_KEY` | A long random string — generate with: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DB_PASSWORD` | Any strong password, e.g. `School@2024` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` for local; or the server's IP/domain |
| `CORS_ALLOWED_ORIGINS` | `http://localhost` for local; or `http://your-server-ip` |
| `FRONTEND_URL` | Same as above |
| `EMAIL_HOST_USER` | Gmail address for sending emails |
| `EMAIL_HOST_PASSWORD` | Gmail App Password (16-char code, not the Gmail login password) |
| `DJANGO_SUPERUSER_PASSWORD` | The admin password the client wants to use |

**Fields to leave as-is:**

| Field | Value | Why |
|-------|-------|-----|
| `DEBUG` | `False` | Production mode |
| `DB_HOST` | `db` | Docker internal service name |
| `DB_PORT` | `5432` | PostgreSQL default |
| `VITE_API_URL` | `/api` | Frontend calls backend via Nginx proxy |

---

## PART 3 — Running on Client Machine

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Both `docker-compose.yml` and `.env` in the same folder

### Folder structure on client machine

```
school-app/
├── docker-compose.yml
└── .env
```

### Start the app

```bash
cd school-app
docker compose up -d
```

Docker will:
1. Pull `postgres:16-alpine` from Docker Hub
2. Pull `your-dockerhub-username/school-backend:latest` from Docker Hub
3. Pull `your-dockerhub-username/school-frontend:latest` from Docker Hub
4. Start the database
5. Run Django migrations automatically
6. Collect static files
7. **Create the superuser automatically** using credentials from `.env`
8. Start Gunicorn (backend)
9. Start Nginx (frontend)

First run takes 2–3 minutes (image download + startup). Subsequent starts are under 30 seconds.

### Open the app

```
http://localhost
```

### Log in

| Field    | Value |
|----------|-------|
| Username | `superadmin` (or whatever you set in `.env`) |
| Password | `Admin@12345` (or whatever you set in `.env`) |

> On first login the app will ask the user to set a new password.

---

## Useful Commands (Run on Client Machine)

```bash
# Check if all containers are running
docker compose ps

# View all logs
docker compose logs -f

# View only backend logs
docker compose logs -f backend

# View only frontend logs
docker compose logs -f frontend

# Stop the app (data is preserved)
docker compose down

# Restart after stopping
docker compose up -d

# Pull latest images (after developer pushes an update)
docker compose pull
docker compose up -d

# Stop and delete ALL data (WARNING: irreversible)
docker compose down -v
```

---

## Updating the App (Developer Workflow)

When you release a new version:

```bash
# 1. Rebuild and push new images
docker build -t your-dockerhub-username/school-backend:latest ./backend
docker push your-dockerhub-username/school-backend:latest

docker build --build-arg VITE_API_URL=/api \
  -t your-dockerhub-username/school-frontend:latest ./frontend
docker push your-dockerhub-username/school-frontend:latest

# 2. Tell the client to run:
docker compose pull
docker compose up -d
```

---

## Deploying to a Real Server (Not Localhost)

If the client is deploying to a VPS or cloud server (e.g. IP `192.168.1.100`):

Update the `.env` on the server:

```env
ALLOWED_HOSTS=192.168.1.100
CORS_ALLOWED_ORIGINS=http://192.168.1.100
FRONTEND_URL=http://192.168.1.100
```

If the client has a domain name (e.g. `school.example.com`):

```env
ALLOWED_HOSTS=school.example.com
CORS_ALLOWED_ORIGINS=https://school.example.com
FRONTEND_URL=https://school.example.com
```

For HTTPS, a reverse proxy like Nginx or Caddy is needed in front of the containers — that is a separate setup.

---

## Troubleshooting

**Port 80 already in use**
```yaml
# In docker-compose.yml, change the frontend ports line:
ports:
  - "8080:80"   # access at http://localhost:8080
```

**Superuser not created / can't log in**
Check the backend logs — the superuser creation output appears there:
```bash
docker compose logs backend | grep -i superuser
```
If the container already ran once without the new entrypoint, force recreate:
```bash
docker compose down
docker compose up -d
```

**Database connection refused**
The backend retries automatically. Wait 30 seconds, then check:
```bash
docker compose ps      # confirm db container is healthy
docker compose logs db
```

**Containers keep restarting**
```bash
docker compose logs backend   # read the error message
```
Usually caused by a wrong value in `.env` (missing `SECRET_KEY`, wrong `DB_PASSWORD`, etc.).

**Images not found / pull failed**
Make sure the images were pushed successfully and the `image:` names in `docker-compose.yml` match exactly what was pushed to Docker Hub.
