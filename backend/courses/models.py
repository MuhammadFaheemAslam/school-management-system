from django.db import models


class SchoolSettings(models.Model):
    """
    Singleton — always pk=1.
    Stores school identity (name, logo) and school-wide default timings.
    Per-section timings on ClassSection override these when set.
    """
    # Identity
    name = models.CharField(max_length=200, default='My School')
    logo = models.ImageField(upload_to='school/', null=True, blank=True)
    # Timings
    school_start_time = models.TimeField(default='08:00', help_text='Default school start time')
    school_end_time   = models.TimeField(null=True, blank=True, help_text='Default school end time')
    break_start_time  = models.TimeField(null=True, blank=True, help_text='Default break start time')
    break_end_time    = models.TimeField(null=True, blank=True, help_text='Default break end time')
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'School Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.name


class AcademicSession(models.Model):
    """School year — e.g. 2024-2025 (Apr 2024 – Mar 2025)"""
    name       = models.CharField(max_length=20, unique=True)   # "2024-2025"
    start_date = models.DateField()
    end_date   = models.DateField()
    is_active  = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']

    def save(self, *args, **kwargs):
        # Only one session can be active at a time
        if self.is_active:
            AcademicSession.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Course(models.Model):
    """Class level — e.g. Class 6, Class 7, Class 8"""
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Subject(models.Model):
    """A subject taught within a class — e.g. Math (Class 7)"""
    name   = models.CharField(max_length=100)
    code   = models.CharField(max_length=20, unique=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='subjects')

    class Meta:
        ordering = ['course', 'name']
        unique_together = ['name', 'course']

    def __str__(self):
        return f"{self.name} ({self.course})"


class ClassSection(models.Model):
    """
    A section within a class for a given session.
    name is optional — blank means the whole class is one group (no split).

    Examples:
      Class 7, Session 2024-2025, name=""   → "Class 7"  (no sections)
      Class 7, Session 2024-2025, name="A"  → "Class 7 – Section A"
      Class 7, Session 2024-2025, name="B"  → "Class 7 – Section B"
    """
    course   = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sections')
    session  = models.ForeignKey(
        AcademicSession,
        on_delete=models.PROTECT,   # prevent deleting a session that has sections
        related_name='sections',
        null=True, blank=True,      # null only allowed at DB level; form enforces required
    )
    name     = models.CharField(max_length=10, default='A')   # A, B, C — defaults to A
    school_start_time = models.TimeField(
        null=True, blank=True,
        help_text='Override start time for this section (leave blank to use school-wide setting)'
    )
    school_end_time = models.TimeField(
        null=True, blank=True,
        help_text='Override end time for this section (leave blank to use school-wide setting)'
    )
    break_start_time = models.TimeField(
        null=True, blank=True,
        help_text='Override break start for this section (leave blank to use school-wide setting)'
    )
    break_end_time = models.TimeField(
        null=True, blank=True,
        help_text='Override break end for this section (leave blank to use school-wide setting)'
    )
    class_teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='class_teacher_of'
    )

    class Meta:
        ordering = ['course', 'name']
        unique_together = ['course', 'session', 'name']

    def __str__(self):
        session_label = f" ({self.session})" if self.session else ""
        if self.name:
            return f"{self.course} – Section {self.name}{session_label}"
        return f"{self.course}{session_label}"
