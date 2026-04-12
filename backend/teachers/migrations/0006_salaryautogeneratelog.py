from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0005_salary_sheets'),
    ]

    operations = [
        migrations.CreateModel(
            name='SalaryAutoGenerateLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('month', models.CharField(max_length=7)),
                ('created', models.PositiveIntegerField(default=0)),
                ('skipped', models.PositiveIntegerField(default=0)),
                ('success', models.BooleanField(default=True)),
                ('error', models.TextField(blank=True)),
                ('ran_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-ran_at'],
            },
        ),
    ]
