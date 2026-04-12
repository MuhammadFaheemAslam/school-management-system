from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.core.exceptions import ValidationError

from .models import PasswordResetToken, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display    = ('username', 'email', 'first_name', 'last_name', 'role', 'is_first_login', 'is_active', 'is_staff', 'date_joined')
    list_filter     = ('role', 'is_first_login', 'is_active', 'is_staff', 'is_superuser')
    search_fields   = ('username', 'email', 'first_name', 'last_name')
    ordering        = ('-date_joined',)
    fieldsets       = UserAdmin.fieldsets + (
        ('School Info', {'fields': ('role', 'is_first_login', 'profile_photo')}),
    )
    add_fieldsets   = UserAdmin.add_fieldsets + (
        ('School Info', {'fields': ('email', 'first_name', 'last_name', 'role')}),
    )

    def save_model(self, request, obj, form, change):
        if obj.role == 'super_admin':
            existing = User.objects.filter(role='super_admin').exclude(pk=obj.pk)
            if existing.exists():
                self.message_user(
                    request,
                    "Cannot assign super_admin role — a super admin already exists.",
                    level='error',
                )
                return  # abort save
        super().save_model(request, obj, form, change)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display    = ('user', 'token', 'created_at', 'is_used')
    list_filter     = ('is_used',)
    search_fields   = ('user__username', 'user__email', 'token')
    readonly_fields = ('token', 'created_at')
    ordering        = ('-created_at',)
