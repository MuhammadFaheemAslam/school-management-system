"""
Drop the accounts.SchoolSettings table now that its data has been merged
into courses.SchoolSettings (see courses migration 0009).
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_alter_schoolsettings_id'),
        ('courses',  '0009_merge_school_settings'),
    ]

    operations = [
        migrations.DeleteModel(
            name='SchoolSettings',
        ),
    ]
