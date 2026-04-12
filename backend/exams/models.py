from django.conf import settings
from django.db import models


def calculate_grade(marks, total):
    if total == 0:
        return 'N/A'
    pct = (marks / total) * 100
    if pct >= 90: return 'A+'
    if pct >= 80: return 'A'
    if pct >= 70: return 'B'
    if pct >= 60: return 'C'
    if pct >= 50: return 'D'
    return 'F'


class Exam(models.Model):
    EXAM_TYPE_CHOICES = (
        ('quiz',      'Quiz'),
        ('midterm',   'Mid-Term'),
        ('final',     'Final'),
        ('assignment','Assignment'),
        ('other',     'Other'),
    )

    name          = models.CharField(max_length=200)
    exam_type     = models.CharField(max_length=20, choices=EXAM_TYPE_CHOICES, default='other')
    class_section = models.ForeignKey('courses.ClassSection', on_delete=models.CASCADE, related_name='exams')
    subject       = models.ForeignKey('courses.Subject', on_delete=models.CASCADE, related_name='exams')
    date          = models.DateField()
    total_marks   = models.PositiveIntegerField()
    passing_marks = models.PositiveIntegerField()
    created_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='exams_created')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.name} — {self.class_section} — {self.subject}"


class Result(models.Model):
    exam          = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    student       = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='results')
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2)
    grade         = models.CharField(max_length=5, blank=True)
    remarks       = models.CharField(max_length=200, blank=True)
    entered_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='results_entered')
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['exam', 'student']
        ordering = ['student__user__last_name']

    def save(self, *args, **kwargs):
        self.grade = calculate_grade(float(self.marks_obtained), self.exam.total_marks)
        super().save(*args, **kwargs)

    @property
    def percentage(self):
        if self.exam.total_marks == 0:
            return 0
        return round((float(self.marks_obtained) / self.exam.total_marks) * 100, 1)

    @property
    def passed(self):
        return float(self.marks_obtained) >= self.exam.passing_marks

    def __str__(self):
        return f"{self.student} — {self.exam} — {self.grade}"
