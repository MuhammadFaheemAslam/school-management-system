from django.contrib import admin

from .models import AcademicSession, ClassSection, Course, Subject


class SubjectInline(admin.TabularInline):
    model  = Subject
    extra  = 1
    fields = ('name', 'code')


class ClassSectionInline(admin.TabularInline):
    model  = ClassSection
    extra  = 1
    fields = ('name', 'session', 'class_teacher')


@admin.register(AcademicSession)
class AcademicSessionAdmin(admin.ModelAdmin):
    list_display  = ('name', 'start_date', 'end_date', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    search_fields = ('name',)
    ordering      = ('-start_date',)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display  = ('name', 'description', 'created_at')
    search_fields = ('name',)
    ordering      = ('name',)
    inlines       = [SubjectInline, ClassSectionInline]


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code', 'course')
    list_filter   = ('course',)
    search_fields = ('name', 'code')
    ordering      = ('course', 'name')


@admin.register(ClassSection)
class ClassSectionAdmin(admin.ModelAdmin):
    list_display  = ('__str__', 'course', 'session', 'name', 'class_teacher')
    list_filter   = ('course', 'session')
    search_fields = ('name', 'course__name', 'session__name')
    ordering      = ('course', 'name')
