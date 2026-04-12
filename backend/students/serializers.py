from rest_framework import serializers

from .models import Parent, Student, StudentEnrollment


def _fee_package(obj):
    try:
        pkg = obj.fee_package
        return {
            'tuition_fee':      str(pkg.tuition_fee),
            'transport_fee':    str(pkg.transport_fee),
            'registration_fee': str(pkg.registration_fee),
            'books_fee':        str(pkg.books_fee),
            'exam_fee':         str(pkg.exam_fee),
            'note':             pkg.note,
            'total_monthly':    pkg.total_monthly,
            'total_onetime':    pkg.total_onetime,
        }
    except Exception:
        return None


class ParentSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email     = serializers.CharField(source='user.email',    read_only=True)
    username  = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model  = Parent
        fields = ['id', 'user', 'username', 'full_name', 'email', 'phone_number', 'address', 'created_at']
        read_only_fields = ['created_at']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class CreateParentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Parent
        fields = ['user', 'phone_number', 'address']

    def validate_user(self, value):
        if value.role != 'parent':
            raise serializers.ValidationError("Selected user does not have the 'parent' role.")
        if hasattr(value, 'parent_profile'):
            raise serializers.ValidationError("This user already has a parent profile.")
        return value


# ── Enrollment ────────────────────────────────────────────────────────────────

class StudentEnrollmentSerializer(serializers.ModelSerializer):
    session_name       = serializers.CharField(source='session.name',    read_only=True)
    course_name        = serializers.CharField(source='course.name',     read_only=True)
    section_name       = serializers.SerializerMethodField()
    class_teacher_name = serializers.SerializerMethodField()
    is_current_session = serializers.SerializerMethodField()

    class Meta:
        model  = StudentEnrollment
        fields = [
            'id', 'student',
            'session', 'session_name',
            'course',  'course_name',
            'class_section', 'section_name',
            'roll_number', 'transport_required',
            'enrolled_at', 'is_active',
            'class_teacher_name', 'is_current_session',
        ]
        read_only_fields = ['roll_number', 'enrolled_at']

    def get_section_name(self, obj):
        if obj.class_section and obj.class_section.name:
            return f"Section {obj.class_section.name}"
        return None

    def get_class_teacher_name(self, obj):
        if obj.class_section and obj.class_section.class_teacher:
            t = obj.class_section.class_teacher
            return t.user.get_full_name() or t.user.username
        return None

    def get_is_current_session(self, obj):
        return obj.session.is_active


class CreateEnrollmentSerializer(serializers.ModelSerializer):
    """Used internally to create a new enrollment record."""
    class Meta:
        model  = StudentEnrollment
        fields = ['session', 'course', 'class_section', 'transport_required']


# ── Student ───────────────────────────────────────────────────────────────────

class StudentSerializer(serializers.ModelSerializer):
    # Name fields are now on the Student model directly
    full_name   = serializers.SerializerMethodField()
    # User-sourced fields (null when no login account)
    email             = serializers.SerializerMethodField()
    username          = serializers.SerializerMethodField()
    has_login_account = serializers.SerializerMethodField()

    # Parent
    parent_name = serializers.SerializerMethodField()

    # Current enrollment (the active session placement)
    current_enrollment = serializers.SerializerMethodField()

    # Fee package
    fee_package = serializers.SerializerMethodField()

    class Meta:
        model  = Student
        fields = [
            # Identity
            'id', 'user', 'username', 'full_name', 'email',
            'first_name', 'middle_name', 'last_name',   # stored on Student model
            'has_login_account',
            'student_id', 'admission_number',
            'date_of_birth', 'gender', 'blood_group', 'cnic',
            # Contact
            'phone_number', 'address',
            # Father
            'father_name', 'father_cnic', 'father_phone',
            # Mother
            'mother_name', 'mother_cnic', 'mother_phone',
            # Guardian
            'guardian_name', 'guardian_relation', 'guardian_phone',
            # Emergency
            'emergency_contact_name', 'emergency_contact_phone',
            # Admission background
            'admission_type', 'previous_school', 'previous_class',
            'slc_status', 'slc_submitted_date',
            # Parent link
            'parent', 'parent_name',
            # Current academic placement
            'current_enrollment',
            # Status
            'leaving_reason', 'leaving_note', 'leaving_date',
            # Meta
            'enrollment_date', 'is_active', 'created_at',
            # Fee package
            'fee_package',
        ]
        read_only_fields = ['student_id', 'admission_number', 'enrollment_date', 'created_at']

    def get_full_name(self, obj):
        return ' '.join(filter(None, [obj.first_name, obj.middle_name, obj.last_name])) or None

    def get_email(self, obj):
        return obj.user.email if obj.user else None

    def get_username(self, obj):
        return obj.user.username if obj.user else None

    def get_has_login_account(self, obj):
        return obj.user_id is not None

    def get_parent_name(self, obj):
        if obj.parent:
            return obj.parent.user.get_full_name() or obj.parent.user.username
        return None

    def get_current_enrollment(self, obj):
        enr = obj.current_enrollment()
        if enr:
            return StudentEnrollmentSerializer(enr).data
        return None

    def get_fee_package(self, obj):
        return _fee_package(obj)


class UpdateStudentSerializer(serializers.ModelSerializer):
    """Used for PUT on student profile — only personal/contact fields, not enrollment."""
    class Meta:
        model  = Student
        fields = [
            'first_name', 'middle_name', 'last_name',
            'date_of_birth', 'gender', 'blood_group', 'cnic',
            'phone_number', 'address',
            'father_name', 'father_cnic', 'father_phone',
            'mother_name', 'mother_cnic', 'mother_phone',
            'guardian_name', 'guardian_relation', 'guardian_phone',
            'emergency_contact_name', 'emergency_contact_phone',
            'admission_type', 'previous_school', 'previous_class',
            'slc_status', 'slc_submitted_date',
            'parent', 'is_active',
        ]

    def validate_cnic(self, value):
        if not value:
            return None
        return value.strip() or None
