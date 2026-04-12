import secrets
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'),
        ('school_admin', 'School Admin'),
        ('principal', 'Principal'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('parent', 'Parent'),
    )

    email          = models.EmailField(unique=True)
    middle_name    = models.CharField(max_length=50, blank=True)
    role           = models.CharField(max_length=20, choices=ROLE_CHOICES, blank=True)
    is_first_login = models.BooleanField(default=True)
    profile_photo  = models.ImageField(upload_to='profile_photos/', null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"



class PasswordResetToken(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_tokens')
    token      = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used    = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        """Token expires after 1 hour."""
        age = timezone.now() - self.created_at
        return not self.is_used and age.total_seconds() < 3600

    @classmethod
    def make(cls, user):
        """Invalidate old tokens and create a fresh one."""
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        return cls.objects.create(user=user, token=secrets.token_urlsafe(32))
