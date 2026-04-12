from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
from datetime import date


class Migration(migrations.Migration):

    dependencies = [
        ('fees', '0003_class_fee_structure_revision_log'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='enrollmentfeepackage',
            name='amount_paid',
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.CreateModel(
            name='EnrollmentPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('payment_date', models.DateField(default=date.today)),
                ('payment_method', models.CharField(
                    choices=[('cash', 'Cash'), ('bank_transfer', 'Bank Transfer'),
                             ('cheque', 'Cheque'), ('online', 'Online')],
                    default='cash', max_length=20,
                )),
                ('transaction_id', models.CharField(blank=True, max_length=100)),
                ('note', models.CharField(blank=True, max_length=200)),
                ('fee_package', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='payments',
                    to='fees.enrollmentfeepackage',
                )),
                ('received_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-payment_date']},
        ),
    ]
