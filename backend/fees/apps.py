import sys
from django.apps import AppConfig


class FeesConfig(AppConfig):
    name = 'fees'

    def ready(self):
        # Don't start the scheduler during migrations, shell, or tests
        is_manage_py = any('manage.py' in arg for arg in sys.argv)
        is_migration = any(cmd in sys.argv for cmd in ('migrate', 'makemigrations', 'shell', 'test', 'collectstatic'))

        if is_manage_py and is_migration:
            return

        # Only start in the main process (not the reloader child)
        import os
        if os.environ.get('RUN_MAIN') == 'true' or not is_manage_py:
            from . import scheduler
            scheduler.start()
