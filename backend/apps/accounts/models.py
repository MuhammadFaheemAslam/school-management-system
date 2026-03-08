from django.db import models
from core.constants import USER_ROLES
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    
    role = models.CharField(max_length=20, choices=USER_ROLES)
    
    def __str__(self):
        return f"{self.username} - {self.role}"