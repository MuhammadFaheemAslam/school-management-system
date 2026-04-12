"""
APScheduler setup for auto-generating monthly fee vouchers.
Runs on the 1st of every month at 06:00 (server time).
Started from FeesConfig.ready() — runs in a background thread.
"""
import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler = None   # module-level singleton


def auto_generate_monthly_vouchers():
    """
    Called automatically on the 1st of every month.
    Generates vouchers for the current month for all active students.
    Logs the result in AutoGenerateLog.
    """
    from .models import AutoGenerateLog
    from .utils import generate_monthly_vouchers

    today = date.today()
    month = f'{today.year}-{today.month:02d}'
    logger.info(f'[AutoGenerate] Starting monthly voucher generation for {month}')

    try:
        created, skipped = generate_monthly_vouchers(month)
        AutoGenerateLog.objects.create(
            month   = month,
            created = created,
            skipped = skipped,
            success = True,
        )
        logger.info(f'[AutoGenerate] Done — created={created}, skipped={skipped}')
    except Exception as exc:
        AutoGenerateLog.objects.create(
            month   = month,
            created = 0,
            skipped = 0,
            success = False,
            error   = str(exc),
        )
        logger.error(f'[AutoGenerate] Failed for {month}: {exc}')


def start():
    """Start the background scheduler. Called once from FeesConfig.ready()."""
    global _scheduler

    if _scheduler is not None:
        return  # already running

    _scheduler = BackgroundScheduler()

    # Run on the 1st of every month at 06:00
    _scheduler.add_job(
        auto_generate_monthly_vouchers,
        trigger  = CronTrigger(day=1, hour=6, minute=0),
        id       = 'auto_generate_monthly_vouchers',
        name     = 'Auto-generate monthly fee vouchers',
        replace_existing = True,
    )

    _scheduler.start()
    logger.info('[AutoGenerate] Scheduler started — will run on 1st of every month at 06:00')


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

    job = _scheduler.get_job('auto_generate_monthly_vouchers')
    next_run = None
    if job and job.next_run_time:
        next_run = job.next_run_time.isoformat()

    return {'running': True, 'next_run': next_run}
