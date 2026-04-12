from django.contrib import admin

from .models import Teacher


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'employee_id', 'phone_number', 'date_of_joining']
    search_fields = ['user__first_name', 'user__last_name', 'employee_id']
    filter_horizontal = ['subjects']
