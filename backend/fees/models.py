from datetime import date
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator


zero = MinValueValidator(0)


class EnrollmentFeePackage(models.Model):
    """
    Fee package assigned to a student at the time of enrollment.
    Stores per-student fee amounts for all applicable fee heads.
    Monthly fees (tuition, transport) recur every month.
    One-time fees (registration, books, exam) are charged once.
    """
    student          = models.OneToOneField(
        'students.Student', on_delete=models.CASCADE, related_name='fee_package'
    )
    # ── Monthly recurring ──────────────────────────────────────────────────────
    tuition_fee      = models.DecimalField(max_digits=10, decimal_places=2,
                                           default=0, validators=[zero],
                                           help_text='Monthly tuition fee (PKR)')
    transport_fee    = models.DecimalField(max_digits=10, decimal_places=2,
                                           default=0, validators=[zero],
                                           help_text='Monthly transport fee (0 if not required)')
    # ── One-time ───────────────────────────────────────────────────────────────
    registration_fee = models.DecimalField(max_digits=10, decimal_places=2,
                                           default=0, validators=[zero],
                                           help_text='One-time registration / admission fee')
    books_fee        = models.DecimalField(max_digits=10, decimal_places=2,
                                           default=0, validators=[zero],
                                           help_text='Books fee (optional)')
    exam_fee         = models.DecimalField(max_digits=10, decimal_places=2,
                                           default=0, validators=[zero],
                                           help_text='Exam fee (optional, per term/year)')
    # ── Meta ───────────────────────────────────────────────────────────────────
    note             = models.CharField(max_length=300, blank=True,
                                        help_text='Any special concession or note')
    is_custom        = models.BooleanField(
        default=False,
        help_text='True = manually overridden for this student; False = auto-filled from class fee structure'
    )
    assigned_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Enrollment Fee Package'
        verbose_name_plural = 'Enrollment Fee Packages'

    def __str__(self):
        return f"Fee Package – {self.student}"

    @property
    def total_monthly(self):
        return float(self.tuition_fee) + float(self.transport_fee)

    @property
    def total_onetime(self):
        return float(self.registration_fee) + float(self.books_fee) + float(self.exam_fee)

    @property
    def total_fees(self):
        return self.total_monthly + self.total_onetime


class ClassFeeStructure(models.Model):
    """
    Default fee package for a class in a given session.
    When a student is enrolled, their EnrollmentFeePackage is auto-filled from here.
    Admins can override per-student afterward.
    """
    course   = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE, related_name='class_fee_structures'
    )
    session  = models.ForeignKey(
        'courses.AcademicSession', on_delete=models.PROTECT, related_name='class_fee_structures'
    )
    tuition_fee      = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    transport_fee    = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    registration_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    books_fee        = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    exam_fee         = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    note             = models.CharField(max_length=300, blank=True)
    created_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['course', 'session']
        ordering = ['course__name']

    @property
    def total_monthly(self):
        return float(self.tuition_fee) + float(self.transport_fee)

    @property
    def total_onetime(self):
        return float(self.registration_fee) + float(self.books_fee) + float(self.exam_fee)

    def __str__(self):
        return f"{self.course} – {self.session}"


class FeeRevisionLog(models.Model):
    """Audit trail for every bulk fee revision applied to class fee structures."""
    REVISION_TYPES = (
        ('percentage', 'Percentage %'),
        ('fixed',      'Fixed Amount +'),
    )
    FEE_FIELDS = (
        ('tuition_fee',   'Tuition Fee'),
        ('transport_fee', 'Transport Fee'),
        ('all_monthly',   'All Monthly Fees'),
        ('all',           'All Fee Heads'),
    )
    session        = models.ForeignKey(
        'courses.AcademicSession', on_delete=models.SET_NULL, null=True, related_name='fee_revisions'
    )
    revision_type  = models.CharField(max_length=10, choices=REVISION_TYPES)
    fee_field      = models.CharField(max_length=20, choices=FEE_FIELDS)
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    applied_to_all = models.BooleanField(default=True)
    courses        = models.ManyToManyField('courses.Course', blank=True, related_name='fee_revisions')
    note           = models.CharField(max_length=300, blank=True)
    applied_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    applied_at     = models.DateTimeField(auto_now_add=True)
    affected_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-applied_at']

    def __str__(self):
        target = 'All classes' if self.applied_to_all else f'{self.affected_count} classes'
        return f"{self.revision_type} {self.amount} on {self.fee_field} — {target} ({self.applied_at:%Y-%m-%d})"


# ── Fee Voucher System ────────────────────────────────────────────────────────

def generate_voucher_number(voucher_type, month=None, year=None):
    """Auto-generate unique voucher number."""
    from datetime import date as _date
    today = _date.today()
    if voucher_type == 'admission':
        prefix = f'ADM-{today.year}'
        last = FeeVoucher.objects.filter(voucher_number__startswith=prefix).order_by('-id').first()
        seq = (int(last.voucher_number.rsplit('-', 1)[-1]) + 1) if last else 1
        return f'{prefix}-{str(seq).zfill(4)}'
    elif voucher_type == 'monthly':
        ym = month or f'{today.year}-{today.month:02d}'
        prefix = f'MTH-{ym}'
        last = FeeVoucher.objects.filter(voucher_number__startswith=prefix).order_by('-id').first()
        seq = (int(last.voucher_number.rsplit('-', 1)[-1]) + 1) if last else 1
        return f'{prefix}-{str(seq).zfill(4)}'
    elif voucher_type == 'annual':
        yr = year or today.year
        prefix = f'ANN-{yr}'
        last = FeeVoucher.objects.filter(voucher_number__startswith=prefix).order_by('-id').first()
        seq = (int(last.voucher_number.rsplit('-', 1)[-1]) + 1) if last else 1
        return f'{prefix}-{str(seq).zfill(4)}'
    return f'VCH-{today.year}-0001'


class FeeVoucher(models.Model):
    VOUCHER_TYPES = (
        ('admission', 'Admission'),
        ('monthly',   'Monthly'),
        ('annual',    'Annual'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('partial', 'Partial'),
        ('paid',    'Paid'),
        ('overdue', 'Overdue'),
    )

    voucher_number = models.CharField(max_length=30, unique=True)
    student        = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='vouchers')
    fee_package    = models.ForeignKey(
        EnrollmentFeePackage, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vouchers'
    )
    voucher_type   = models.CharField(max_length=10, choices=VOUCHER_TYPES)
    month          = models.CharField(max_length=7, blank=True)   # e.g. "2025-04" for monthly
    year           = models.IntegerField(null=True, blank=True)    # e.g. 2025 for annual
    due_date       = models.DateField()
    amount_paid    = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    arrears        = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[zero])
    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.voucher_number} – {self.student}'

    @property
    def total_amount(self):
        total = sum(float(item.amount) for item in self.line_items.all())
        return round(total + float(self.arrears), 2)

    @property
    def balance(self):
        return round(self.total_amount - float(self.amount_paid), 2)

    @property
    def status(self):
        paid  = float(self.amount_paid)
        total = self.total_amount
        if total == 0:
            return 'paid'
        if paid >= total:
            return 'paid'
        if paid > 0:
            return 'partial'
        if date.today() > self.due_date:
            return 'overdue'
        return 'pending'


class VoucherLineItem(models.Model):
    voucher = models.ForeignKey(FeeVoucher, on_delete=models.CASCADE, related_name='line_items')
    label   = models.CharField(max_length=100)
    amount  = models.DecimalField(max_digits=10, decimal_places=2, validators=[zero])

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.label}: {self.amount}'


class VoucherPayment(models.Model):
    METHOD_CHOICES = (
        ('cash',          'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque',        'Cheque'),
        ('online',        'Online'),
    )
    voucher        = models.ForeignKey(FeeVoucher, on_delete=models.CASCADE, related_name='payments')
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date   = models.DateField(default=date.today)
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    transaction_id = models.CharField(max_length=100, blank=True)
    received_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-payment_date']

    def __str__(self):
        return f'Payment {self.amount} for {self.voucher.voucher_number}'


# ── Auto-Generate Schedule Log ────────────────────────────────────────────────

class AutoGenerateLog(models.Model):
    """Records each time the scheduler auto-generated monthly vouchers."""
    month      = models.CharField(max_length=7)   # e.g. "2026-04"
    created    = models.IntegerField(default=0)
    skipped    = models.IntegerField(default=0)
    success    = models.BooleanField(default=True)
    error      = models.TextField(blank=True)
    ran_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-ran_at']

    def __str__(self):
        return f'AutoGenerate {self.month} – {"OK" if self.success else "FAILED"} ({self.ran_at:%Y-%m-%d %H:%M})'
