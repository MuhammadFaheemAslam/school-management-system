"""
APScheduler setup for auto-generating monthly salary sheets.
Runs on the 1st of every month at 06:30 (server time).
Started from TeachersConfig.ready() in apps.py.

Eligibility rule:
  A teacher receives their first salary sheet in the calendar month
  AFTER the month they joined.
  Example: joined 2026-03-15 → first sheet generated on 2026-04-01 (for month 2026-04).
"""
import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler = None   # module-level singleton


def _eligible(teacher, current_year, current_month):
    """
    Returns True if the teacher should receive a salary sheet for
    (current_year, current_month).

    Conditions:
      - is_active = True
      - basic_salary is set (not None / not zero)
      - date_of_joining is set
      - joining month is strictly before current month  (year*12+month comparison)
    """
    if not teacher.is_active:
        return False
    if not teacher.basic_salary:
        return False
    if not teacher.date_of_joining:
        return False
    join_ordinal = teacher.date_of_joining.year * 12 + teacher.date_of_joining.month
    curr_ordinal = current_year * 12 + current_month
    return curr_ordinal > join_ordinal


def auto_generate_salary_sheets(month=None):
    """
    Core logic — can be called from the scheduler or from a manual trigger.
    Returns (created, skipped).
    """
    from .models import Teacher, SalarySheet

    today = date.today()
    if month is None:
        month = f'{today.year}-{today.month:02d}'

    year_int, month_int = int(month[:4]), int(month[5:7])

    teachers = Teacher.objects.filter(is_active=True).select_related('user')
    created = skipped = 0

    for teacher in teachers:
        if not _eligible(teacher, year_int, month_int):
            skipped += 1
            continue
        if SalarySheet.objects.filter(teacher=teacher, month=month).exists():
            skipped += 1
            continue
        SalarySheet.objects.create(
            teacher      = teacher,
            month        = month,
            basic_salary = teacher.basic_salary,
            # generated_by = None  (system-generated)
        )
        created += 1

    return created, skipped


def _run_and_log(month=None):
    """Wrapper that runs auto_generate_salary_sheets and writes the log entry."""
    from .models import SalaryAutoGenerateLog

    today = date.today()
    if month is None:
        month = f'{today.year}-{today.month:02d}'

    logger.info(f'[SalaryAutoGen] Starting for {month}')
    try:
        created, skipped = auto_generate_salary_sheets(month)
        SalaryAutoGenerateLog.objects.create(
            month=month, created=created, skipped=skipped, success=True
        )
        logger.info(f'[SalaryAutoGen] Done — created={created}, skipped={skipped}')
    except Exception as exc:
        SalaryAutoGenerateLog.objects.create(
            month=month, created=0, skipped=0, success=False, error=str(exc)
        )
        logger.error(f'[SalaryAutoGen] Failed for {month}: {exc}')


def start():
    """Start the background scheduler. Called once from TeachersConfig.ready()."""
    global _scheduler

    if _scheduler is not None:
        return  # already running

    _scheduler = BackgroundScheduler()

    # Run on the 1st of every month at 06:30 (offset from fees to avoid collision)
    _scheduler.add_job(
        _run_and_log,
        trigger          = CronTrigger(day=1, hour=6, minute=30),
        id               = 'auto_generate_salary_sheets',
        name             = 'Auto-generate monthly salary sheets',
        replace_existing = True,
    )

    _scheduler.start()
    logger.info('[SalaryAutoGen] Scheduler started — will run on 1st of every month at 06:30')


def stop():
    """Gracefully stop the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def get_status():
    """Return scheduler status dict for the API."""
    if _scheduler is None or not _scheduler.running:
        return {'running': False, 'next_run': None}

    job = _scheduler.get_job('auto_generate_salary_sheets')
    next_run = None
    if job and job.next_run_time:
        next_run = job.next_run_time.isoformat()

    return {'running': True, 'next_run': next_run}
