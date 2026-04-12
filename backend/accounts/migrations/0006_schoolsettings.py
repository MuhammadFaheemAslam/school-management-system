from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_user_middle_name'),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolSettings',
            fields=[
                ('id',         models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',       models.CharField(default='My School', max_length=200)),
                ('logo',       models.ImageField(blank=True, null=True, upload_to='school/')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'verbose_name': 'School Settings'},
        ),
    ]
