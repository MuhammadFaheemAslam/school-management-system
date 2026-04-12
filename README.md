# School Management System

A full-stack school management system built with **Django REST Framework** and **React**. Designed to handle the day-to-day operations of a school — students, teachers, attendance, fees, salary, notifications, and reports — all in one place.

---

## Features

| Module | What it does |
|--------|-------------|
| User Management | Create and manage accounts with role-based access |
| Students | Admissions, enrollment, profiles, report cards |
| Teachers | Profiles, subjects, designations, salary |
| Attendance | Daily student and teacher attendance with late tracking |
| Fees | Fee structures, monthly vouchers, payments, ledger, reports |
| Salary | Monthly salary sheets, components, payment tracking |
| Notifications | Send announcements to students, teachers, or parents |
| Reports | CSV and PDF exports for attendance, fees, and results |
| School Settings | School name, logo, timings per section |
| Dashboard | Role-specific stats and overview for every user type |

## User Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access to everything |
| `school_admin` | Manage school, users, fees, salary |
| `principal` | Academic oversight, attendance, reports |
| `teacher` | Mark attendance, view own sections and salary |
| `student` | View own attendance, fees, report card |
| `parent` | View child's attendance, fees, results |

---

## Tech Stack

**Backend**
- Python 3.12 / Django 6.0
- Django REST Framework + SimpleJWT
- PostgreSQL
- Gunicorn
- APScheduler (automated fee and salary generation)
- ReportLab (PDF generation)

**Frontend**
- React 18 + Vite
- React Router
- Recharts (dashboard charts)
- Nginx (production serving)

**Infrastructure**
- Docker + Docker Compose
- Multi-stage frontend build

---

## Quick Start (Docker)

The fastest way to run the full stack locally.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone the repo
git clone https://github.com/your-username/school-management-system.git
cd school-management-system

# 2. Create your environment file
cp .env.example .env
```

Open `.env` and fill in:

| Field | What to put |
|-------|-------------|
| `SECRET_KEY` | A long random string — generate with the command below |
| `DB_PASSWORD` | Any strong password e.g. `School@2024` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost` |
| `EMAIL_HOST_USER` | Your Gmail address |
| `EMAIL_HOST_PASSWORD` | Your [Gmail App Password](https://myaccount.google.com/apppasswords) |

Generate a SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

```bash
# 3. Build and start
docker compose up --build
```

First build takes 3–5 minutes. Once running:

- **App:** http://localhost
- **Django Admin:** http://localhost/admin

The superuser is created automatically using the credentials in your `.env`:
```env
DJANGO_SUPERUSER_USERNAME=superadmin
DJANGO_SUPERUSER_PASSWORD=Admin@12345
DJANGO_SUPERUSER_EMAIL=admin@school.com
```

### Useful Docker commands

```bash
# Start in background
docker compose up -d --build

# View logs
docker compose logs -f

# View logs for one service
docker compose logs -f backend

# Stop everything (data is preserved)
docker compose down

# Stop and delete all data (WARNING: irreversible)
docker compose down -v

# Restart one service
docker compose restart backend
```

---

## Local Development (Without Docker)

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL installed and running locally

### Step 1 — Set up PostgreSQL

Open pgAdmin or psql and run:

```sql
CREATE DATABASE school_db;
CREATE USER school_user WITH PASSWORD 'school1234';
GRANT ALL PRIVILEGES ON DATABASE school_db TO school_user;
```

### Step 2 — Configure backend `.env`

Open `backend/.env` and set:

| Field | Value |
|-------|-------|
| `DB_PASSWORD` | The password you set above |
| `DB_HOST` | `localhost` |
| `SECRET_KEY` | Any long random string |

### Step 3 — Activate virtual environment

```bash
# From the project root
source venv/Scripts/activate   # Windows
source venv/bin/activate       # Mac/Linux
```

You should see `(venv)` at the start of your terminal.

### Step 4 — Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

### Step 5 — Run migrations

```bash
cd backend
python manage.py migrate
```

### Step 6 — Create a Super Admin

```bash
python manage.py createsuperuser
```

### Step 7 — Start the Django server

```bash
python manage.py runserver
```

Backend runs at: `http://localhost:8000`

### Step 8 — Start the React frontend

Open a **second terminal**:

```bash
cd frontend
npm install        # first time only
npm run dev
```

Frontend runs at: `http://localhost:5173`

You need **two terminals** running at the same time:

| Terminal | Command |
|----------|---------|
| Terminal 1 | activate venv → `cd backend` → `python manage.py runserver` |
| Terminal 2 | `cd frontend` → `npm run dev` |

---

## Deployment

See [DEPLOY.md](DEPLOY.md) to deploy using Docker Hub — push images once, run anywhere with just a `docker-compose.yml` and `.env`.

See [UPDATING.md](UPDATING.md) for how to safely push updates to a live production app without losing data.

---

## Project Structure

```
school-management-system/
├── backend/                  # Django project
│   ├── accounts/             # Users, auth, roles, dashboard
│   ├── attendance/           # Student and teacher attendance
│   ├── courses/              # Classes, sections, sessions, subjects
│   ├── exams/                # Exams and results
│   ├── fees/                 # Fee structures, vouchers, payments
│   ├── notifications/        # Announcements
│   ├── reports/              # PDF and CSV exports
│   ├── students/             # Student profiles and enrollment
│   ├── teachers/             # Teacher profiles and salary
│   ├── school_management/    # Django settings, urls, wsgi
│   ├── requirements.txt
│   ├── Dockerfile
│   └── entrypoint.sh
├── frontend/                 # React + Vite app
│   ├── src/
│   │   ├── components/       # Shared UI components
│   │   ├── context/          # Auth context
│   │   ├── pages/            # Feature pages
│   │   └── services/         # API client
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
├── DEPLOY.md
└── UPDATING.md
```

---

## Default Login

After first run, log in at http://localhost with:

| Field | Value |
|-------|-------|
| Username | `superadmin` |
| Password | `Admin@12345` |

On first login you will be prompted to set a new password.

---

## Gmail App Password Setup

The system sends emails for password resets and notifications. It uses Gmail SMTP.

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification (must be ON)
3. Security → App Passwords → create one for "Mail"
4. Copy the 16-character code into `EMAIL_HOST_PASSWORD` in your `.env`

> Do NOT use your regular Gmail password — it will not work.

---

## Troubleshooting

**Docker: `port 80 already in use`**
```yaml
# In docker-compose.yml, change:
ports:
  - "8080:80"   # access at http://localhost:8080
```

**Docker: database connection refused**
Wait a few seconds — PostgreSQL takes a moment to start. The backend retries automatically.

**Local: `django-admin: command not found`**
Virtual environment is not activated. Run `source venv/Scripts/activate` first.

**Local: CORS error in browser**
Make sure Django is running on port 8000 and React on port 5173.

**`401 Unauthorized` on API calls**
Your access token expired. Log out and log back in.

**`ModuleNotFoundError`**
Virtual environment is not activated. Run `source venv/Scripts/activate` first.

**Migrations out of date**
```bash
python manage.py migrate                                # local
docker compose exec backend python manage.py migrate    # Docker
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
