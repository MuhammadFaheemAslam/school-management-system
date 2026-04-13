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
