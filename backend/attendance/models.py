from django.conf import settings
from django.db import models


class Attendance(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
    )

    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    class_section = models.ForeignKey(
        'courses.ClassSection',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent', blank=True, null=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendance_marked'
    )
    arrival_time = models.TimeField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'date']
        ordering = ['-date', 'student__user__last_name']

    def __str__(self):
        return f"{self.student} — {self.date} — {self.status}"


class TeacherAttendance(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent',  'Absent'),
        ('late',    'Late'),
        ('leave',   'Leave'),
    )

    teacher    = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date       = models.DateField()
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES)
    arrival_time = models.TimeField(null=True, blank=True)
    note       = models.CharField(max_length=200, blank=True)
    marked_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='teacher_attendance_marked'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['teacher', 'date']
        ordering = ['-date', 'teacher__user__last_name']

    def __str__(self):
        return f"{self.teacher} — {self.date} — {self.status}"
