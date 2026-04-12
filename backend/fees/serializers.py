from rest_framework import serializers
from .models import ClassFeeStructure, EnrollmentFeePackage, FeeRevisionLog, FeeVoucher, VoucherLineItem, VoucherPayment


class ClassFeeStructureSerializer(serializers.ModelSerializer):
    course_name  = serializers.CharField(source='course.name',   read_only=True)
    session_name = serializers.CharField(source='session.name',  read_only=True)
    total_monthly = serializers.ReadOnlyField()
    total_onetime = serializers.ReadOnlyField()

    class Meta:
        model  = ClassFeeStructure
        fields = [
            'id', 'course', 'course_name', 'session', 'session_name',
            'tuition_fee', 'transport_fee',
            'registration_fee', 'books_fee', 'exam_fee',
            'note', 'total_monthly', 'total_onetime',
            'is_custom',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    # expose is_custom on read (not a model field here but useful for context)
    is_custom = serializers.SerializerMethodField()
    def get_is_custom(self, obj): return False  # class structure is never custom


class FeeRevisionLogSerializer(serializers.ModelSerializer):
    applied_by_name = serializers.SerializerMethodField()
    session_name    = serializers.CharField(source='session.name', read_only=True)
    course_names    = serializers.SerializerMethodField()

    class Meta:
        model  = FeeRevisionLog
        fields = [
            'id', 'session', 'session_name',
            'revision_type', 'fee_field', 'amount',
            'applied_to_all', 'course_names',
            'note', 'applied_by', 'applied_by_name',
            'applied_at', 'affected_count',
        ]

    def get_applied_by_name(self, obj):
        if obj.applied_by:
            return obj.applied_by.get_full_name() or obj.applied_by.username
        return None

    def get_course_names(self, obj):
        return list(obj.courses.values_list('name', flat=True))


class EnrollmentFeePackageSerializer(serializers.ModelSerializer):
    total_monthly    = serializers.ReadOnlyField()
    total_onetime    = serializers.ReadOnlyField()
    total_fees       = serializers.ReadOnlyField()
    student_name     = serializers.SerializerMethodField()
    admission_number = serializers.SerializerMethodField()
    class_name       = serializers.SerializerMethodField()
    section_name     = serializers.SerializerMethodField()
    roll_number      = serializers.SerializerMethodField()

    class Meta:
        model  = EnrollmentFeePackage
        fields = [
            'id', 'student', 'student_name', 'admission_number', 'roll_number',
            'class_name', 'section_name',
            'tuition_fee', 'transport_fee',
            'registration_fee', 'books_fee', 'exam_fee',
            'note', 'is_custom',
            'total_monthly', 'total_onetime', 'total_fees',
            'assigned_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['assigned_by', 'created_at', 'updated_at']

    def get_admission_number(self, obj):
        try:
            return obj.student.admission_number
        except Exception:
            return ''

    def get_student_name(self, obj):
        try:
            user = obj.student.user
            if not user:
                return f'Student #{obj.student.id}'
            return user.get_full_name() or user.username
        except Exception:
            return f'Student #{obj.student_id}'

    def get_roll_number(self, obj):
        try:
            enr = obj.student.enrollments.filter(is_active=True).first()
            return enr.roll_number if enr else None
        except Exception:
            return None

    def get_class_name(self, obj):
        try:
            enr = obj.student.enrollments.filter(is_active=True).select_related('course').first()
            return enr.course.name if enr else None
        except Exception:
            return None

    def get_section_name(self, obj):
        try:
            enr = obj.student.enrollments.filter(is_active=True).select_related('class_section').first()
            return enr.class_section.name if enr and enr.class_section else None
        except Exception:
            return None


class VoucherLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VoucherLineItem
        fields = ['id', 'label', 'amount']


class VoucherPaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = VoucherPayment
        fields = ['id', 'amount', 'payment_date', 'payment_method',
                  'transaction_id', 'received_by', 'received_by_name', 'note']

    def get_received_by_name(self, obj):
        if obj.received_by:
            return obj.received_by.get_full_name() or obj.received_by.username
        return None


class FeeVoucherSerializer(serializers.ModelSerializer):
    line_items       = VoucherLineItemSerializer(many=True, read_only=True)
    payments         = VoucherPaymentSerializer(many=True, read_only=True)
    total_amount     = serializers.ReadOnlyField()
    balance          = serializers.ReadOnlyField()
    status           = serializers.ReadOnlyField()
    student_name     = serializers.SerializerMethodField()
    admission_number = serializers.SerializerMethodField()
    roll_number      = serializers.SerializerMethodField()
    class_name       = serializers.SerializerMethodField()
    section_name     = serializers.SerializerMethodField()

    class Meta:
        model  = FeeVoucher
        fields = [
            'id', 'voucher_number', 'student', 'student_name', 'admission_number',
            'roll_number', 'class_name', 'section_name',
            'voucher_type', 'month', 'year', 'due_date',
            'line_items', 'arrears', 'total_amount', 'amount_paid', 'balance', 'status',
            'payments', 'created_at',
        ]

    def get_student_name(self, obj):
        try:
            return obj.student.full_name() or obj.student.admission_number
        except Exception:
            return f'Student #{obj.student_id}'

    def get_admission_number(self, obj):
        try:
            return obj.student.admission_number
        except Exception:
            return ''

    def get_roll_number(self, obj):
        try:
            enr = obj.student.enrollments.filter(is_active=True).first()
            return enr.roll_number if enr else None
        except Exception:
            return None

    def get_class_name(self, obj):
        try:
            enr = obj.student.enrollments.filter(is_active=True).select_related('course').first()
            return enr.course.name if enr else None
        except Exception:
            return None

    def get_section_name(self, obj):
        try:
            enr = obj.student.enrollments.filter(is_active=True).select_related('class_section').first()
            return enr.class_section.name if enr and enr.class_section else None
        except Exception:
            return None
