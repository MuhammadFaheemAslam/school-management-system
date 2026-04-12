import sys
from django.apps import AppConfig


class TeachersConfig(AppConfig):
    name = 'teachers'

    def ready(self):
        # Don't start during migrations, shell, tests, etc.
        is_manage_py  = any('manage.py' in arg for arg in sys.argv)
        is_management = any(cmd in sys.argv for cmd in (
            'migrate', 'makemigrations', 'shell', 'test', 'collectstatic'
        ))

        if is_manage_py and is_management:
            return

        import os
        if os.environ.get('RUN_MAIN') == 'true' or not is_manage_py:
            from . import scheduler
            scheduler.start()
