from datetime import date

from django.conf import settings
from django.db import models

SCHOOL_CODE = settings.SCHOOL_CODE


def generate_admission_number():
    """AAPHS-{YEAR}-{NNNN}  — sequence resets each calendar year."""
    year = date.today().year
    last = (
        Student.objects.filter(admission_number__startswith=f'{SCHOOL_CODE}-{year}-')
        .order_by('-admission_number')
        .first()
    )
    if last:
        try:
            seq = int(last.admission_number.rsplit('-', 1)[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f'{SCHOOL_CODE}-{year}-{str(seq).zfill(4)}'


def generate_student_id():
    """AAPHS-STD-{NNNN}  — ever-increasing, never resets."""
    last = Student.objects.order_by('-id').first()
    seq  = (last.id + 1) if last else 1
    return f'{SCHOOL_CODE}-STD-{str(seq).zfill(4)}'


def generate_roll_number(course=None, section=None, session=None):
    """
    001, 002, … — sequential within the same class/section for a session.
    Scoped to section if provided, otherwise to course+session.
    """
    qs = StudentEnrollment.objects.filter(session=session)
    if section:
        qs = qs.filter(class_section=section)
    elif course:
        qs = qs.filter(course=course)
    else:
        return ''
    return str(qs.count() + 1).zfill(3)


class Parent(models.Model):
    user         = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='parent_profile'
    )
    phone_number = models.CharField(max_length=20, blank=True)
    address      = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class Student(models.Model):
    """
    Permanent student record — never changes when the student moves to a new class.
    Academic placement (class, section, roll number) lives in StudentEnrollment.
    """
    GENDER_CHOICES = (
        ('male', 'Male'), ('female', 'Female'), ('other', 'Other'),
    )
    BLOOD_GROUP_CHOICES = (
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-'),
    )
    ADMISSION_TYPE_CHOICES = (
        ('new', 'New Admission'), ('transfer', 'Transfer'),
    )
    SLC_STATUS_CHOICES = (
        ('not_required', 'Not Required'),
        ('pending',      'Pending'),
        ('submitted',    'Submitted'),
    )

    # ── Login account (optional) ──────────────────────────────────────────────
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile',
        null=True, blank=True,
    )

    # ── Permanent IDs ─────────────────────────────────────────────────────────
    student_id       = models.CharField(max_length=30, unique=True, blank=True)
    admission_number = models.CharField(max_length=30, unique=True, blank=True)

    # ── Name (always stored here, regardless of login account) ───────────────
    first_name  = models.CharField(max_length=100, blank=True)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name   = models.CharField(max_length=100, blank=True)

    # ── Personal info ─────────────────────────────────────────────────────────
    date_of_birth = models.DateField(null=True, blank=True)
    gender        = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    blood_group   = models.CharField(max_length=5,  choices=BLOOD_GROUP_CHOICES, blank=True)
    cnic          = models.CharField(max_length=20, blank=True, null=True, unique=True)

    # ── Contact ───────────────────────────────────────────────────────────────
    phone_number = models.CharField(max_length=20, blank=True)
    address      = models.TextField(blank=True)

    # ── Father info ───────────────────────────────────────────────────────────
    father_name  = models.CharField(max_length=100, blank=True)
    father_cnic  = models.CharField(max_length=20,  blank=True)
    father_phone = models.CharField(max_length=20,  blank=True)

    # ── Mother info ───────────────────────────────────────────────────────────
    mother_name  = models.CharField(max_length=100, blank=True)
    mother_cnic  = models.CharField(max_length=20,  blank=True)
    mother_phone = models.CharField(max_length=20,  blank=True)

    # ── Guardian info ─────────────────────────────────────────────────────────
    guardian_name     = models.CharField(max_length=100, blank=True)
    guardian_relation = models.CharField(max_length=50,  blank=True)
    guardian_phone    = models.CharField(max_length=20,  blank=True)

    # ── Emergency contact ─────────────────────────────────────────────────────
    emergency_contact_name  = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=20,  blank=True)

    # ── Admission background ──────────────────────────────────────────────────
    admission_type  = models.CharField(max_length=10, choices=ADMISSION_TYPE_CHOICES, default='new')
    previous_school = models.CharField(max_length=200, blank=True)
    previous_class  = models.CharField(max_length=50,  blank=True)
    slc_status      = models.CharField(max_length=15, choices=SLC_STATUS_CHOICES, default='not_required')
    slc_submitted_date = models.DateField(null=True, blank=True)

    # ── Parent link ───────────────────────────────────────────────────────────
    parent = models.ForeignKey(
        Parent,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='children'
    )

    # ── Status / leaving ──────────────────────────────────────────────────────
    LEAVING_REASON_CHOICES = (
        ('passout',    'Passed Out'),
        ('left',       'Left School'),
        ('expelled',   'Expelled'),
        ('transferred','Transferred'),
        ('other',      'Other'),
    )
    leaving_reason = models.CharField(max_length=20, choices=LEAVING_REASON_CHOICES, blank=True)
    leaving_note   = models.TextField(blank=True)
    leaving_date   = models.DateField(null=True, blank=True)

    # ── Meta ──────────────────────────────────────────────────────────────────
    enrollment_date = models.DateField(auto_now_add=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['admission_number']

    def save(self, *args, **kwargs):
        if not self.student_id:
            self.student_id = generate_student_id()
        if not self.admission_number:
            self.admission_number = generate_admission_number()
        super().save(*args, **kwargs)

    def current_enrollment(self):
        """Returns the latest active enrollment record."""
        return self.enrollments.filter(is_active=True).select_related(
            'session', 'course', 'class_section'
        ).order_by('-session__start_date').first()

    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.admission_number

    def __str__(self):
        return f"{self.full_name()} ({self.admission_number})"


class StudentEnrollment(models.Model):
    """
    Academic placement for one session.
    Created once per year — a new record is added when the student is promoted.
    """
    student    = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    session    = models.ForeignKey('courses.AcademicSession', on_delete=models.PROTECT, related_name='enrollments')
    course     = models.ForeignKey('courses.Course', on_delete=models.PROTECT, related_name='enrollments')
    class_section = models.ForeignKey(
        'courses.ClassSection',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='enrollments',
        help_text='Section within the class (optional)',
    )
    roll_number        = models.CharField(max_length=10, blank=True)
    transport_required = models.BooleanField(default=False)
    enrolled_at        = models.DateField(auto_now_add=True)
    is_active          = models.BooleanField(default=True)

    class Meta:
        ordering           = ['-session__start_date']
        unique_together    = ['student', 'session']   # one placement per student per year
        verbose_name       = 'Student Enrollment'
        verbose_name_plural = 'Student Enrollments'

    def save(self, *args, **kwargs):
        if not self.roll_number:
            self.roll_number = generate_roll_number(
                course=self.course,
                section=self.class_section,
                session=self.session,
            )
        super().save(*args, **kwargs)

    def __str__(self):
        section = f" – Section {self.class_section.name}" if self.class_section and self.class_section.name else ''
        return f"{self.student} | {self.course}{section} | {self.session}"


class StudentDocument(models.Model):
    DOC_TYPE_CHOICES = (
        ('admission_form',    'Admission Form'),
        ('birth_certificate', 'Birth Certificate'),
        ('transfer_cert',     'Transfer Certificate'),
        ('id_card',           'ID Card / CNIC'),
        ('photo',             'Passport Photo'),
        ('other',             'Other'),
    )
    student     = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='documents')
    doc_type    = models.CharField(max_length=30, choices=DOC_TYPE_CHOICES, default='other')
    title       = models.CharField(max_length=100)
    file        = models.FileField(upload_to='student_documents/')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    note        = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} – {self.student}"
