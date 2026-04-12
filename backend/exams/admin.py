from django.contrib import admin
from .models import Exam, Result


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ['name', 'exam_type', 'class_section', 'subject', 'date', 'total_marks', 'passing_marks']
    list_filter  = ['exam_type', 'class_section__course', 'date']
    search_fields = ['name', 'subject__name']
    date_hierarchy = 'date'


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ['student', 'exam', 'marks_obtained', 'grade', 'entered_by']
    list_filter  = ['grade', 'exam__class_section__course']
    search_fields = ['student__user__first_name', 'student__user__last_name', 'exam__name']
