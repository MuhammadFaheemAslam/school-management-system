from datetime import date

from django.conf import settings
from django.db import models

SCHOOL_CODE = settings.SCHOOL_CODE


def generate_employee_id():
    last = Teacher.objects.order_by('-id').first()
    seq  = (last.id + 1) if last else 1
    return f'{SCHOOL_CODE}-EMP-{str(seq).zfill(4)}'


class Teacher(models.Model):
    DESIGNATION_CHOICES = (
        ('head_teacher',      'Head Teacher'),
        ('senior_teacher',    'Senior Teacher'),
        ('junior_teacher',    'Junior Teacher'),
        ('subject_specialist','Subject Specialist'),
        ('visiting_teacher',  'Visiting Teacher'),
    )
    QUALIFICATION_CHOICES = (
        ('matric',       'Matric'),
        ('intermediate', 'Intermediate'),
        ('ba',           'BA'),
        ('bsc',          'BSc'),
        ('bed',          'B.Ed'),
        ('ma',           'MA'),
        ('msc',          'MSc'),
        ('med',          'M.Ed'),
        ('mphil',        'M.Phil'),
        ('phd',          'PhD'),
        ('other',        'Other'),
    )
    GENDER_CHOICES = (
        ('male', 'Male'), ('female', 'Female'), ('other', 'Other'),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teacher_profile',
    )

    # ── Employment ────────────────────────────────────────────────────────────
    employee_id     = models.CharField(max_length=20, unique=True, blank=True)
    designation     = models.CharField(max_length=20, choices=DESIGNATION_CHOICES, default='junior_teacher')
    date_of_joining = models.DateField(null=True, blank=True)
    is_active       = models.BooleanField(default=True)

    # ── Personal ─────────────────────────────────────────────────────────────
    gender        = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    cnic          = models.CharField(max_length=20, blank=True, null=True, unique=True)
    qualification = models.CharField(max_length=15, choices=QUALIFICATION_CHOICES, blank=True)
    phone_number  = models.CharField(max_length=20, blank=True)
    address       = models.TextField(blank=True)

    # ── Salary ───────────────────────────────────────────────────────────────
    PAYMENT_MODE_CHOICES = (
        ('cash',          'Cash'),
        ('bank_transfer', 'Bank Transfer'),
    )
    basic_salary        = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_mode        = models.CharField(max_length=15, choices=PAYMENT_MODE_CHOICES, default='cash')
    bank_name           = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)

    # ── Subjects ──────────────────────────────────────────────────────────────
    subjects = models.ManyToManyField(
        'courses.Subject',
        blank=True,
        related_name='teachers',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['user__last_name', 'user__first_name']

    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = generate_employee_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.employee_id})"


# ── Salary Sheet ─────────────────────────────────────────────────────────────

class SalarySheet(models.Model):
    teacher      = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='salary_sheets')
    month        = models.CharField(max_length=7)       # YYYY-MM
    basic_salary = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    note         = models.CharField(max_length=300, blank=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('teacher', 'month')]
        ordering = ['-month', 'teacher__user__last_name']

    def __str__(self):
        return f"{self.teacher} — {self.month}"

    @property
    def total_allowances(self):
        return round(sum(float(c.amount) for c in self.components.filter(component_type='allowance')), 2)

    @property
    def total_deductions(self):
        return round(sum(float(c.amount) for c in self.components.filter(component_type='deduction')), 2)

    @property
    def net_salary(self):
        return round(float(self.basic_salary) + self.total_allowances - self.total_deductions, 2)

    @property
    def balance(self):
        return round(self.net_salary - float(self.amount_paid), 2)

    @property
    def status(self):
        paid = float(self.amount_paid)
        net  = self.net_salary
        if net <= 0 or paid >= net:
            return 'paid'
        if paid > 0:
            return 'partial'
        return 'pending'


class SalaryComponent(models.Model):
    TYPES = (('allowance', 'Allowance'), ('deduction', 'Deduction'))

    salary_sheet   = models.ForeignKey(SalarySheet, on_delete=models.CASCADE, related_name='components')
    component_type = models.CharField(max_length=10, choices=TYPES)
    label          = models.CharField(max_length=100)
    amount         = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.label} ({self.component_type})"


class SalaryPayment(models.Model):
    METHOD_CHOICES = (
        ('cash',          'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque',        'Cheque'),
    )

    salary_sheet   = models.ForeignKey(SalarySheet, on_delete=models.CASCADE, related_name='payments')
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date   = models.DateField(default=date.today)
    payment_method = models.CharField(max_length=15, choices=METHOD_CHOICES, default='cash')
    transaction_id = models.CharField(max_length=100, blank=True)
    paid_by        = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    note = models.CharField(max_length=300, blank=True)

    def __str__(self):
        return f"PKR {self.amount} — {self.salary_sheet}"


class SalaryAutoGenerateLog(models.Model):
    month   = models.CharField(max_length=7)
    created = models.PositiveIntegerField(default=0)
    skipped = models.PositiveIntegerField(default=0)
    success = models.BooleanField(default=True)
    error   = models.TextField(blank=True)
    ran_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-ran_at']

    def __str__(self):
        return f"{self.month} — {'OK' if self.success else 'FAILED'}"
