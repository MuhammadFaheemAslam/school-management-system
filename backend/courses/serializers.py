from rest_framework import serializers

from .models import AcademicSession, ClassSection, Course, SchoolSettings, Subject


class SchoolSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SchoolSettings
        fields = ['name', 'logo', 'school_start_time', 'school_end_time', 'break_start_time', 'break_end_time', 'updated_at']
        read_only_fields = ['updated_at']


class AcademicSessionSerializer(serializers.ModelSerializer):
    section_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicSession
        fields = ['id', 'name', 'start_date', 'end_date', 'is_active', 'section_count', 'student_count', 'created_at']
        read_only_fields = ['created_at']

    def get_section_count(self, obj):
        # Uses annotated value from session_list view; falls back to DB query for detail views.
        if hasattr(obj, 'section_count'):
            return obj.section_count
        return obj.sections.count()

    def get_student_count(self, obj):
        # Uses annotated value from session_list view; falls back to DB query for detail views.
        if hasattr(obj, 'student_count'):
            return obj.student_count
        from students.models import StudentEnrollment
        return StudentEnrollment.objects.filter(
            class_section__session=obj, is_active=True
        ).values('student').distinct().count()


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'course']


class CourseSerializer(serializers.ModelSerializer):
    subjects      = SubjectSerializer(many=True, read_only=True)
    section_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ['id', 'name', 'description', 'subjects', 'section_count', 'created_at']

    def get_section_count(self, obj):
        # Uses annotated value from course_list view; falls back to DB query for detail views.
        if hasattr(obj, 'section_count'):
            return obj.section_count
        return obj.sections.count()


class ClassSectionSerializer(serializers.ModelSerializer):
    course_name          = serializers.CharField(source='course.name', read_only=True)
    session_name         = serializers.CharField(source='session.name', read_only=True)
    class_teacher_name   = serializers.SerializerMethodField()
    student_count        = serializers.SerializerMethodField()
    display_name         = serializers.SerializerMethodField()

    class Meta:
        model = ClassSection
        fields = [
            'id', 'course', 'course_name',
            'session', 'session_name',
            'name', 'display_name',
            'class_teacher', 'class_teacher_name',
            'student_count',
            'school_start_time',
            'school_end_time',
            'break_start_time',
            'break_end_time',
        ]

    def get_class_teacher_name(self, obj):
        if obj.class_teacher:
            return obj.class_teacher.user.get_full_name() or obj.class_teacher.user.username
        return None

    def get_student_count(self, obj):
        # Uses annotated value from section_list view; falls back to DB query for detail views.
        if hasattr(obj, 'student_count'):
            return obj.student_count
        return obj.enrollments.filter(is_active=True).count()

    def get_display_name(self, obj):
        """Human-readable label: 'Class 7 – Section A' or just 'Class 7'"""
        if obj.name:
            return f"{obj.course.name} – Section {obj.name}"
        return obj.course.name
