"""
Merge SchoolSettings: add name + logo fields to courses.SchoolSettings,
copy existing data from accounts.SchoolSettings, then the accounts migration
(0008) drops that table.
"""
from django.db import migrations, models


def copy_name_and_logo_from_accounts(apps, schema_editor):
    AccountsSettings = apps.get_model('accounts', 'SchoolSettings')
    CoursesSettings  = apps.get_model('courses',  'SchoolSettings')

    try:
        src = AccountsSettings.objects.get(pk=1)
    except AccountsSettings.DoesNotExist:
        return  # Nothing to copy

    dst, _ = CoursesSettings.objects.get_or_create(pk=1)
    dst.name = src.name
    dst.logo = src.logo
    dst.save()


class Migration(migrations.Migration):

    dependencies = [
        ('courses',  '0008_add_school_settings_nullable_timings'),
        ('accounts', '0007_alter_schoolsettings_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='schoolsettings',
            name='name',
            field=models.CharField(default='My School', max_length=200),
        ),
        migrations.AddField(
            model_name='schoolsettings',
            name='logo',
            field=models.ImageField(blank=True, null=True, upload_to='school/'),
        ),
        migrations.RunPython(copy_name_and_logo_from_accounts, migrations.RunPython.noop),
    ]
