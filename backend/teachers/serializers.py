from django.contrib.auth import get_user_model
from rest_framework import serializers

from courses.serializers import SubjectSerializer
from .models import Teacher, SalarySheet, SalaryComponent, SalaryPayment

User = get_user_model()


class TeacherSerializer(serializers.ModelSerializer):
    full_name        = serializers.SerializerMethodField()
    email            = serializers.CharField(source='user.email',    read_only=True)
    username         = serializers.CharField(source='user.username', read_only=True)
    subjects_detail  = SubjectSerializer(source='subjects', many=True, read_only=True)
    class_teacher_of = serializers.SerializerMethodField()

    class Meta:
        model  = Teacher
        fields = [
            'id', 'user', 'username', 'full_name', 'email',
            'employee_id', 'designation', 'qualification',
            'gender', 'date_of_birth', 'cnic',
            'phone_number', 'address', 'date_of_joining',
            'is_active',
            'basic_salary', 'payment_mode', 'bank_name', 'bank_account_number',
            'subjects', 'subjects_detail',
            'class_teacher_of',
            'created_at',
        ]
        read_only_fields = ['created_at', 'employee_id']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_class_teacher_of(self, obj):
        sections = obj.class_teacher_of.select_related('course', 'session').all()
        return [
            {
                'id':                s.id,
                'name':              s.name,
                'course_name':       s.course.name if s.course else '',
                'session_name':      s.session.name if s.session else '',
                'school_start_time': s.school_start_time.strftime('%H:%M') if s.school_start_time else '08:00',
                'school_end_time':   s.school_end_time.strftime('%H:%M')   if s.school_end_time   else None,
                'break_start_time':  s.break_start_time.strftime('%H:%M')  if s.break_start_time  else None,
                'break_end_time':    s.break_end_time.strftime('%H:%M')    if s.break_end_time    else None,
            }
            for s in sections
        ]


class CreateTeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Teacher
        fields = [
            'user', 'designation', 'qualification',
            'gender', 'date_of_birth', 'cnic',
            'phone_number', 'address', 'date_of_joining',
            'subjects',
        ]

    def validate_user(self, value):
        if value.role != 'teacher':
            raise serializers.ValidationError("Selected user does not have the 'teacher' role.")
        if hasattr(value, 'teacher_profile'):
            raise serializers.ValidationError("This user already has a teacher profile.")
        return value

    def validate_cnic(self, value):
        if not value:
            return None
        return value.strip() or None


class UpdateTeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Teacher
        fields = [
            'designation', 'qualification',
            'gender', 'date_of_birth', 'cnic',
            'phone_number', 'address', 'date_of_joining',
            'is_active', 'subjects',
            'basic_salary', 'payment_mode', 'bank_name', 'bank_account_number',
        ]

    def validate_cnic(self, value):
        if not value:
            return None
        return value.strip() or None


class SalaryComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SalaryComponent
        fields = ['id', 'component_type', 'label', 'amount']


class SalaryPaymentSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = SalaryPayment
        fields = ['id', 'amount', 'payment_date', 'payment_method', 'transaction_id', 'paid_by_name', 'note']

    def get_paid_by_name(self, obj):
        if obj.paid_by:
            return obj.paid_by.get_full_name() or obj.paid_by.username
        return ''


class SalarySheetSerializer(serializers.ModelSerializer):
    teacher_name      = serializers.SerializerMethodField()
    employee_id       = serializers.CharField(source='teacher.employee_id', read_only=True)
    designation       = serializers.CharField(source='teacher.designation', read_only=True)
    components        = SalaryComponentSerializer(many=True, read_only=True)
    payments          = SalaryPaymentSerializer(many=True, read_only=True)
    total_allowances  = serializers.SerializerMethodField()
    total_deductions  = serializers.SerializerMethodField()
    net_salary        = serializers.SerializerMethodField()
    balance           = serializers.SerializerMethodField()
    status            = serializers.SerializerMethodField()
    generated_by_name    = serializers.SerializerMethodField()
    teacher_payment_mode = serializers.CharField(source='teacher.payment_mode', read_only=True)

    class Meta:
        model  = SalarySheet
        fields = [
            'id', 'teacher', 'teacher_name', 'employee_id', 'designation',
            'teacher_payment_mode',
            'month', 'basic_salary', 'amount_paid',
            'total_allowances', 'total_deductions', 'net_salary', 'balance', 'status',
            'components', 'payments',
            'note', 'generated_by_name', 'generated_at',
        ]
        read_only_fields = ['generated_at', 'amount_paid']

    def get_teacher_name(self, obj):
        return obj.teacher.user.get_full_name() or obj.teacher.user.username

    def get_total_allowances(self, obj):
        return obj.total_allowances

    def get_total_deductions(self, obj):
        return obj.total_deductions

    def get_net_salary(self, obj):
        return obj.net_salary

    def get_balance(self, obj):
        return obj.balance

    def get_status(self, obj):
        return obj.status

    def get_generated_by_name(self, obj):
        if obj.generated_by:
            return obj.generated_by.get_full_name() or obj.generated_by.username
        return ''
