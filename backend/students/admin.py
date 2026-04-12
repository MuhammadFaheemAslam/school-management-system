from django.contrib import admin

from .models import Parent, Student, StudentDocument, StudentEnrollment


class StudentDocumentInline(admin.TabularInline):
    model           = StudentDocument
    extra           = 0
    fields          = ('doc_type', 'title', 'file', 'note', 'uploaded_by', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


class StudentEnrollmentInline(admin.TabularInline):
    model           = StudentEnrollment
    extra           = 0
    fields          = ('session', 'course', 'class_section', 'roll_number', 'transport_required', 'is_active', 'enrolled_at')
    readonly_fields = ('roll_number', 'enrolled_at')


@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):
    list_display  = ('__str__', 'phone_number', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'user__email', 'phone_number')
    raw_id_fields = ('user',)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display  = ('__str__', 'admission_number', 'student_id', 'gender', 'parent', 'is_active', 'enrollment_date')
    list_filter   = ('is_active', 'gender', 'admission_type')
    search_fields = ('user__first_name', 'user__last_name', 'admission_number', 'student_id', 'cnic')
    raw_id_fields = ('user', 'parent')
    inlines       = [StudentEnrollmentInline, StudentDocumentInline]


@admin.register(StudentEnrollment)
class StudentEnrollmentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'session', 'course', 'class_section', 'roll_number', 'transport_required', 'is_active', 'enrolled_at')
    list_filter   = ('session', 'course', 'is_active', 'transport_required')
    search_fields = ('student__admission_number', 'student__user__first_name', 'student__user__last_name', 'roll_number')
    readonly_fields = ('roll_number', 'enrolled_at')


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display    = ('title', 'student', 'doc_type', 'uploaded_by', 'uploaded_at')
    list_filter     = ('doc_type',)
    search_fields   = ('title', 'student__user__first_name', 'student__user__last_name', 'student__admission_number')
    readonly_fields = ('uploaded_at',)
    ordering        = ('-uploaded_at',)
