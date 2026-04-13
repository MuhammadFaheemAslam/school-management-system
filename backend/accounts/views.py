import random
import string
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Count, Q, Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from attendance.models import Attendance, TeacherAttendance
from courses.models import ClassSection, Course, SchoolSettings
from exams.models import Exam, Result
from fees.models import EnrollmentFeePackage, FeeVoucher, VoucherPayment
from students.models import Student, StudentEnrollment
from teachers.models import SalarySheet, Teacher

from .emails import send_welcome_email
from .permissions import get_effective_role
from .serializers import (
    ChangePasswordSerializer,
    CreateUserSerializer,
    CustomTokenObtainPairSerializer,
    UserSerializer,
)

User = get_user_model()


def generate_temp_password(length=10):
    chars = string.ascii_letters + string.digits + string.punctuation
    return ''.join(random.choices(chars, k=length))


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Returns access + refresh tokens, user data, and first_login flag.
    Checks username existence and password separately for clear error messages.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get('username', '').strip()
        if not User.objects.filter(username=username).exists():
            return Response(
                {'username': 'No account found with this username.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().post(request, *args, **kwargs)



# Roles each caller is allowed to assign when creating a user
CREATABLE_ROLES = {
    'super_admin':  ['school_admin', 'principal', 'teacher', 'student', 'parent'],
    'school_admin': ['teacher', 'student', 'parent'],
    'principal':    ['teacher', 'student', 'parent'],
}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    """
    POST /api/auth/users/create/
    super_admin, school_admin, principal can create users.
    school_admin and principal can only assign teacher/student/parent roles.
    """
    caller_role = get_effective_role(request.user)
    if caller_role not in CREATABLE_ROLES:
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    requested_role = request.data.get('role', '')
    allowed_roles  = CREATABLE_ROLES[caller_role]
    if requested_role not in allowed_roles:
        return Response(
            {'role': f'You can only create users with these roles: {", ".join(allowed_roles)}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = CreateUserSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    temp_password = generate_temp_password()
    user = serializer.save()
    user.set_password(temp_password)
    user.is_first_login = True
    user.save()

    # Send credentials to user's email
    email_sent = True
    try:
        send_welcome_email(user, temp_password)
    except Exception:
        email_sent = False

    return Response(
        {
            "message": "User created successfully.",
            "user": UserSerializer(user).data,
            "email_sent": email_sent,
            # Shown in response so admin can manually share if email fails
            "temporary_password": temp_password,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_users(request):
    """
    GET /api/auth/users/
    super_admin → all users.
    school_admin / principal → all users except super_admin.
    """
    role = get_effective_role(request.user)
    if role not in ('super_admin', 'school_admin', 'principal'):
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    if role == 'super_admin':
        users = User.objects.all()
    else:
        users = User.objects.exclude(is_superuser=True).exclude(role='super_admin')

    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    """
    GET    /api/auth/users/<id>/  — fetch user
    PATCH  /api/auth/users/<id>/  — edit first_name, last_name, email, role, is_active
    DELETE /api/auth/users/<id>/  — delete user
    """
    caller = request.user
    caller_role = get_effective_role(caller)
    if caller_role not in ('super_admin', 'school_admin', 'principal'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    # non-super_admin cannot touch super_admin accounts (role-based or is_superuser)
    target_is_super = target.is_superuser or target.role == 'super_admin'
    if target_is_super and caller_role != 'super_admin':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(UserSerializer(target).data)

    if request.method == 'PATCH':
        if target.pk == caller.pk:
            # Allow self-edit of personal fields only; block role/is_active changes on self
            blocked = {k for k in request.data if k in ('role', 'is_active')}
            if blocked:
                return Response({'error': 'You cannot change your own role or active status.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed_fields = {'first_name', 'last_name', 'email', 'role', 'is_active'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        # role change: caller can only assign roles they're allowed to assign
        if 'role' in data:
            allowed_roles = CREATABLE_ROLES.get(caller_role, [])
            if data['role'] not in allowed_roles:
                return Response({'role': f'You cannot assign the role "{data["role"]}".'}, status=status.HTTP_400_BAD_REQUEST)

        if 'email' in data:
            email = data['email'].strip().lower()
            if User.objects.filter(email__iexact=email).exclude(pk=target.pk).exists():
                return Response({'email': 'A user with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            data['email'] = email

        for field, value in data.items():
            setattr(target, field, value)
        target.save()
        return Response(UserSerializer(target).data)

    # DELETE — super_admin only
    if caller_role != 'super_admin':
        return Response({'error': 'Only Super Admin can permanently delete user accounts.'}, status=status.HTTP_403_FORBIDDEN)
    if target.pk == caller.pk:
        return Response({'error': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
    target.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    POST /api/auth/change-password/
    Any authenticated user. Forces is_first_login = False after reset.
    """
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    user.set_password(serializer.validated_data['new_password'])
    user.is_first_login = False
    user.save()

    return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    GET /api/auth/me/
    Returns current authenticated user's profile.
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """
    PATCH /api/auth/update-profile/
    Allows any authenticated user to update their own first_name, last_name, email.
    Username is read-only after creation.
    """
    user = request.user
    allowed = ('first_name', 'last_name', 'middle_name', 'email')
    data = {k: v for k, v in request.data.items() if k in allowed}

    if 'email' in data:
        email = data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            return Response({'email': 'A user with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        data['email'] = email

    for field, value in data.items():
        setattr(user, field, value)
    user.save()

    # Refresh localStorage token data on frontend
    serializer = UserSerializer(user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_profile_photo(request):
    """
    POST /api/auth/upload-photo/
    Multipart upload. Replaces the current user's profile photo.
    """
    photo = request.FILES.get('photo')
    if not photo:
        return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    allowed = ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
    if photo.content_type not in allowed:
        return Response({'error': 'Only JPEG, PNG, WebP or GIF images are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

    if photo.size > 5 * 1024 * 1024:
        return Response({'error': 'File size must be under 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if user.profile_photo:
        user.profile_photo.delete(save=False)   # remove old file from disk

    user.profile_photo = photo
    user.save()
    return Response({'profile_photo': request.build_absolute_uri(user.profile_photo.url)})


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """
    POST /api/auth/forgot-password/
    Public. Sends a password-reset link to the given email.
    Always returns 200 so email enumeration is not possible.
    """
    from .models import PasswordResetToken

    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email)
        token_obj = PasswordResetToken.make(user)
        reset_url = f"{settings.FRONTEND_URL}/reset-password-confirm?token={token_obj.token}"
        send_mail(
            subject='Password Reset Request – School Management System',
            message=(
                f"Hello {user.get_full_name() or user.username},\n\n"
                f"We received a request to reset your password.\n\n"
                f"Click the link below to set a new password (valid for 1 hour):\n\n"
                f"{reset_url}\n\n"
                f"If you did not request this, you can safely ignore this email.\n\n"
                f"School Management System"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except User.DoesNotExist:
        pass  # don't reveal whether the email exists

    return Response({'message': 'If that email is registered, a reset link has been sent.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_via_token(request):
    """
    POST /api/auth/reset-via-token/
    Public. Validates the token and sets the new password.
    Body: { token, new_password, confirm_password }
    """
    from .models import PasswordResetToken

    token_str        = request.data.get('token', '').strip()
    new_password     = request.data.get('new_password', '')
    confirm_password = request.data.get('confirm_password', '')

    if not token_str:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({'error': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        token_obj = PasswordResetToken.objects.select_related('user').get(token=token_str)
    except PasswordResetToken.DoesNotExist:
        return Response({'error': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    if not token_obj.is_valid():
        return Response({'error': 'This reset link has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    user = token_obj.user
    user.set_password(new_password)
    user.is_first_login = False
    user.save()
    token_obj.is_used = True
    token_obj.save()

    return Response({'message': 'Password reset successfully. You can now log in.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reset_password(request, user_id):
    """
    POST /api/auth/admin-reset/<user_id>/
    Admin only. Generates a new temp password, emails the user, forces first-login reset.
    """
    caller_role = get_effective_role(request.user)
    if caller_role not in ('super_admin', 'school_admin', 'principal'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        target_user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Only super_admin can reset another super_admin's password
    if (target_user.is_superuser or target_user.role == 'super_admin') and caller_role != 'super_admin':
        return Response({'error': 'You cannot reset a Super Admin password.'}, status=status.HTTP_403_FORBIDDEN)

    temp_password = generate_temp_password()
    target_user.set_password(temp_password)
    target_user.is_first_login = True
    target_user.save()

    email_sent = True
    try:
        send_mail(
            subject='Your Password Has Been Reset – School Management System',
            message=(
                f"Hello {target_user.get_full_name() or target_user.username},\n\n"
                f"Your password has been reset by an administrator.\n\n"
                f"Username:          {target_user.username}\n"
                f"Temporary Password: {temp_password}\n\n"
                f"Please log in and change your password immediately.\n\n"
                f"School Management System"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[target_user.email],
            fail_silently=True,
        )
    except Exception:
        email_sent = False

    return Response({
        'message': f"Password reset for {target_user.username}.",
        'temporary_password': temp_password,
        'email_sent': email_sent,
    })


def _section_attendance_block(today):
    """Shared helper: returns section attendance data used by super_admin, principal, school_admin."""
    all_sections    = list(ClassSection.objects.select_related('course', 'class_teacher__user').all())
    marked          = [s for s in all_sections if Attendance.objects.filter(class_section=s, date=today).exists()]
    unmarked        = [s for s in all_sections if s not in marked]
    no_teacher      = [s for s in all_sections if s.class_teacher_id is None]
    unmarked_list   = [
        {
            'id':      sec.id,
            'name':    f"{sec.course.name}{' \u2013 ' + sec.name if sec.name else ''}",
            'teacher': (
                sec.class_teacher.user.get_full_name() or sec.class_teacher.user.username
            ) if sec.class_teacher else None,
        }
        for sec in unmarked[:10]
    ]
    return marked, unmarked, no_teacher, unmarked_list


def _teacher_attendance_block(today, total_teachers):
    """Shared helper: teacher attendance counts for today."""
    records           = list(TeacherAttendance.objects.filter(date=today))
    teachers_present  = sum(1 for r in records if r.status == 'present')
    teachers_absent   = sum(1 for r in records if r.status == 'absent')
    teachers_late     = sum(1 for r in records if r.status == 'late')
    teachers_leave    = sum(1 for r in records if r.status == 'leave')
    teachers_unmarked = total_teachers - len(records)
    return teachers_present, teachers_absent, teachers_late, teachers_leave, teachers_unmarked


def _fee_by_class_block(all_vouchers):
    """Shared helper: fee collection breakdown per course."""
    vouchers_by_student = {}
    for v in all_vouchers:
        vouchers_by_student.setdefault(v.student_id, []).append(v)

    fee_by_class = []
    for course in Course.objects.order_by('name'):
        student_ids = set(
            StudentEnrollment.objects.filter(course=course, is_active=True)
            .values_list('student_id', flat=True)
        )
        if not student_ids:
            continue
        course_vouchers = [v for sid in student_ids for v in vouchers_by_student.get(sid, [])]
        if not course_vouchers:
            continue
        c_due  = sum(v.total_amount for v in course_vouchers)
        c_paid = sum(float(v.amount_paid) for v in course_vouchers)
        if c_due == 0:
            continue
        fee_by_class.append({
            'course':        course.name,
            'total_due':     round(c_due, 2),
            'total_paid':    round(c_paid, 2),
            'rate':          round(c_paid / c_due * 100, 1),
            'student_count': len(student_ids),
        })
    fee_by_class.sort(key=lambda x: x['rate'])
    return fee_by_class


def _monthly_collection(today):
    """Shared helper: this month vs last month fee collection totals."""
    this_month_paid = float(
        VoucherPayment.objects.filter(
            payment_date__year=today.year, payment_date__month=today.month,
        ).aggregate(t=Sum('amount'))['t'] or 0
    )
    last_month      = today.month - 1 or 12
    last_month_year = today.year if today.month > 1 else today.year - 1
    last_month_paid = float(
        VoucherPayment.objects.filter(
            payment_date__year=last_month_year, payment_date__month=last_month,
        ).aggregate(t=Sum('amount'))['t'] or 0
    )
    return this_month_paid, last_month_paid


def _dashboard_super_admin(user, today, next_week):
    total_students = Student.objects.filter(is_active=True).count()
    total_teachers = Teacher.objects.count()
    total_courses  = Course.objects.count()
    total_sections = ClassSection.objects.count()

    total_enrolled = StudentEnrollment.objects.filter(is_active=True).count()
    present_today  = Attendance.objects.filter(date=today, status='present').count()
    absent_today   = Attendance.objects.filter(date=today, status='absent').count()
    att_rate = round(present_today / total_enrolled * 100, 1) if total_enrolled else None

    sections_marked, sections_unmarked, no_teacher_secs, unmarked_list = _section_attendance_block(today)
    t_present, t_absent, t_late, t_leave, t_unmarked = _teacher_attendance_block(today, total_teachers)

    all_vouchers     = list(FeeVoucher.objects.prefetch_related('line_items').all())
    total_due        = sum(v.total_amount for v in all_vouchers)
    total_paid       = sum(float(v.amount_paid) for v in all_vouchers)
    collection_rate  = round(total_paid / total_due * 100, 1) if total_due else 0
    overdue_count    = sum(1 for v in all_vouchers if v.status == 'overdue')
    pending_count    = sum(1 for v in all_vouchers if v.status == 'pending')
    defaulter_count  = len({v.student_id for v in all_vouchers if v.status == 'overdue'})
    no_fee_count     = Student.objects.filter(is_active=True, fee_package__isnull=True).count()

    this_month_paid, last_month_paid = _monthly_collection(today)
    fee_by_class = _fee_by_class_block(all_vouchers)

    recent_payments = [
        {
            'student': p.voucher.student.full_name(),
            'amount':  float(p.amount),
            'method':  p.payment_method,
            'date':    str(p.payment_date),
        }
        for p in VoucherPayment.objects.select_related(
            'voucher__student', 'received_by'
        ).order_by('-payment_date', '-id')[:5]
    ]

    today_new              = list(Student.objects.filter(enrollment_date=today).order_by('-created_at')[:5])
    today_admissions_list  = [{'name': s.full_name(), 'admission_number': s.admission_number} for s in today_new]
    today_admissions_count = Student.objects.filter(enrollment_date=today).count()

    students_by_class = [
        {'course': c.name, 'count': cnt}
        for c in Course.objects.order_by('name')
        if (cnt := StudentEnrollment.objects.filter(course=c, is_active=True).count())
    ]

    gender_dist = {'male': 0, 'female': 0, 'other': 0}
    for row in Student.objects.filter(is_active=True).values('gender').annotate(count=Count('id')):
        key = row['gender'] if row['gender'] in ('male', 'female') else 'other'
        gender_dist[key] += row['count']

    User = get_user_model()
    role_counts = {r['role']: r['c'] for r in User.objects.filter(is_active=True).values('role').annotate(c=Count('id'))}

    upcoming_list = [
        {'id': e.id, 'name': e.name, 'date': str(e.date),
         'subject': e.subject.name, 'section': e.class_section.name}
        for e in Exam.objects.filter(date__gte=today, date__lte=next_week)
                             .select_related('class_section', 'subject').order_by('date')[:5]
    ]

    return Response({
        'role': 'super_admin',
        'stats': {
            'total_students':        total_students,
            'total_teachers':        total_teachers,
            'total_courses':         total_courses,
            'total_sections':        total_sections,
            'total_exams':           Exam.objects.count(),
            'today_admissions':      today_admissions_count,
            'att_rate_today':        att_rate,
            'students_absent_today': absent_today,
            'sections_marked':       len(sections_marked),
            'sections_unmarked':     len(sections_unmarked),
            'no_teacher_sections':   len(no_teacher_secs),
            'teachers_present':      t_present,
            'teachers_absent':       t_absent,
            'teachers_late':         t_late,
            'teachers_leave':        t_leave,
            'teachers_unmarked':     t_unmarked,
            'fee_total_due':         round(total_due, 2),
            'fee_total_paid':        round(total_paid, 2),
            'fee_collection_rate':   collection_rate,
            'overdue_fees':          overdue_count,
            'pending_fees':          pending_count,
            'fee_defaulters':        defaulter_count,
            'no_fee_package':        no_fee_count,
            'this_month_paid':       round(this_month_paid, 2),
            'last_month_paid':       round(last_month_paid, 2),
            'total_principals':      role_counts.get('principal', 0),
            'total_school_admins':   role_counts.get('school_admin', 0),
        },
        'upcoming_exams':     upcoming_list,
        'fee_by_class':       fee_by_class,
        'recent_payments':    recent_payments,
        'today_new_students': today_admissions_list,
        'students_by_class':  students_by_class,
        'gender_dist':        gender_dist,
        'unmarked_sections':  unmarked_list,
    })


def _dashboard_principal(user, today, next_week):
    total_students = Student.objects.filter(is_active=True).count()
    total_teachers = Teacher.objects.count()
    total_courses  = Course.objects.count()
    total_sections = ClassSection.objects.count()

    total_enrolled = StudentEnrollment.objects.filter(is_active=True).count()
    present_today  = Attendance.objects.filter(date=today, status='present').count()
    absent_today   = Attendance.objects.filter(date=today, status='absent').count()
    att_rate = round(present_today / total_enrolled * 100, 1) if total_enrolled else None

    sections_marked, sections_unmarked, no_teacher_secs, unmarked_list = _section_attendance_block(today)
    t_present, t_absent, t_late, t_leave, t_unmarked = _teacher_attendance_block(today, total_teachers)

    upcoming_list = [
        {'id': e.id, 'name': e.name, 'date': str(e.date),
         'subject': e.subject.name, 'section': e.class_section.name}
        for e in Exam.objects.filter(date__gte=today, date__lte=next_week)
                             .select_related('class_section', 'subject').order_by('date')[:5]
    ]

    students_by_class = [
        {'course': c.name, 'count': cnt}
        for c in Course.objects.order_by('name')
        if (cnt := StudentEnrollment.objects.filter(course=c, is_active=True).count())
    ]

    gender_dist = {'male': 0, 'female': 0, 'other': 0}
    for row in Student.objects.filter(is_active=True).values('gender').annotate(count=Count('id')):
        key = row['gender'] if row['gender'] in ('male', 'female') else 'other'
        gender_dist[key] += row['count']

    gender_by_class = []
    for course in Course.objects.order_by('name'):
        student_ids = StudentEnrollment.objects.filter(course=course, is_active=True).values_list('student_id', flat=True)
        entry = {'course': course.name, 'male': 0, 'female': 0, 'other': 0}
        for row in Student.objects.filter(id__in=student_ids).values('gender').annotate(count=Count('id')):
            key = row['gender'] if row['gender'] in ('male', 'female') else 'other'
            entry[key] += row['count']
        if any(entry[k] for k in ('male', 'female', 'other')):
            gender_by_class.append(entry)

    return Response({
        'role': 'principal',
        'stats': {
            'total_students':        total_students,
            'total_teachers':        total_teachers,
            'total_courses':         total_courses,
            'total_sections':        total_sections,
            'today_attendance':      att_rate,
            'students_absent_today': absent_today,
            'total_exams':           Exam.objects.count(),
            'sections_marked':       len(sections_marked),
            'sections_unmarked':     len(sections_unmarked),
            'no_teacher_sections':   len(no_teacher_secs),
            'teachers_present':      t_present,
            'teachers_absent':       t_absent,
            'teachers_late':         t_late,
            'teachers_leave':        t_leave,
            'teachers_unmarked':     t_unmarked,
        },
        'upcoming_exams':    upcoming_list,
        'students_by_class': students_by_class,
        'gender_dist':       gender_dist,
        'gender_by_class':   gender_by_class,
        'unmarked_sections': unmarked_list,
    })


def _dashboard_school_admin(user, today, next_week):
    total_students = Student.objects.filter(is_active=True).count()
    total_teachers = Teacher.objects.count()
    total_sections = ClassSection.objects.count()

    all_vouchers    = list(FeeVoucher.objects.prefetch_related('line_items').all())
    total_due       = sum(v.total_amount for v in all_vouchers)
    total_paid      = sum(float(v.amount_paid) for v in all_vouchers)
    collection_rate = round(total_paid / total_due * 100, 1) if total_due else 0
    overdue_count   = sum(1 for v in all_vouchers if v.status == 'overdue')
    pending_count   = sum(1 for v in all_vouchers if v.status == 'pending')
    defaulter_count = len({v.student_id for v in all_vouchers if v.status == 'overdue'})
    no_fee_count    = Student.objects.filter(is_active=True, fee_package__isnull=True).count()

    this_month_paid, last_month_paid = _monthly_collection(today)
    fee_by_class = _fee_by_class_block(all_vouchers)

    recent_payments = [
        {
            'student':     p.voucher.student.full_name(),
            'amount':      float(p.amount),
            'method':      p.payment_method,
            'date':        str(p.payment_date),
            'received_by': (p.received_by.get_full_name() or p.received_by.username) if p.received_by else '',
        }
        for p in VoucherPayment.objects.select_related('voucher__student', 'received_by')
                                       .order_by('-payment_date', '-id')[:5]
    ]

    today_admissions = list(Student.objects.filter(enrollment_date=today).order_by('-created_at')[:5])
    today_admissions_list  = [{'name': s.full_name(), 'admission_number': s.admission_number} for s in today_admissions]
    today_admissions_count = Student.objects.filter(enrollment_date=today).count()

    students_by_class = [
        {'course': c.name, 'count': cnt}
        for c in Course.objects.order_by('name')
        if (cnt := StudentEnrollment.objects.filter(course=c, is_active=True).count())
    ]

    gender_dist = {'male': 0, 'female': 0, 'other': 0}
    for row in Student.objects.filter(is_active=True).values('gender').annotate(count=Count('id')):
        key = row['gender'] if row['gender'] in ('male', 'female') else 'other'
        gender_dist[key] += row['count']

    total_enrolled = StudentEnrollment.objects.filter(is_active=True).count()
    present_today  = Attendance.objects.filter(date=today, status='present').count()
    att_rate_today = round(present_today / total_enrolled * 100, 1) if total_enrolled else 0

    sections_marked, sections_unmarked, no_teacher_secs, unmarked_list = _section_attendance_block(today)
    t_present, t_absent, t_late, t_leave, t_unmarked = _teacher_attendance_block(today, total_teachers)

    return Response({
        'role': 'school_admin',
        'stats': {
            'total_students':      total_students,
            'total_teachers':      total_teachers,
            'total_sections':      total_sections,
            'fee_total_due':       round(total_due, 2),
            'fee_total_paid':      round(total_paid, 2),
            'fee_collection_rate': collection_rate,
            'overdue_fees':        overdue_count,
            'pending_fees':        pending_count,
            'fee_defaulters':      defaulter_count,
            'no_fee_package':      no_fee_count,
            'this_month_paid':     round(this_month_paid, 2),
            'last_month_paid':     round(last_month_paid, 2),
            'today_admissions':    today_admissions_count,
            'att_rate_today':      att_rate_today,
            'sections_marked':     len(sections_marked),
            'sections_unmarked':   len(sections_unmarked),
            'no_teacher_sections': len(no_teacher_secs),
            'teachers_present':    t_present,
            'teachers_absent':     t_absent,
            'teachers_late':       t_late,
            'teachers_leave':      t_leave,
            'teachers_unmarked':   t_unmarked,
        },
        'fee_by_class':       fee_by_class,
        'recent_payments':    recent_payments,
        'today_new_students': today_admissions_list,
        'students_by_class':  students_by_class,
        'gender_dist':        gender_dist,
        'unmarked_sections':  unmarked_list,
    })


def _dashboard_teacher(user, today, next_week):
    try:
        teacher = user.teacher_profile
    except Exception:
        return Response({'role': 'teacher', 'stats': {'total_students': 0, 'total_sections': 0, 'total_subjects': 0, 'pending_attendance': 0},
                         'sections': [], 'subjects': [], 'upcoming_exams': [], 'salary': None})

    subject_course_ids = list(teacher.subjects.values_list('course_id', flat=True))
    my_sections = ClassSection.objects.filter(
        Q(class_teacher=teacher) | Q(course_id__in=subject_course_ids)
    ).distinct().select_related('course', 'session').prefetch_related('enrollments')

    school = SchoolSettings.get()

    def resolve_time(section_val, school_val):
        t = section_val or school_val
        return t.strftime('%H:%M') if t else None

    section_data = [
        {
            'id':                sec.id,
            'name':              sec.name,
            'course':            sec.course.name if sec.course else '',
            'academic_year':     sec.session.name if sec.session else '',
            'students':          sec.enrollments.filter(is_active=True).count(),
            'marked_today':      Attendance.objects.filter(class_section=sec, date=today).exists(),
            'is_class_teacher':  sec.class_teacher_id == teacher.id,
            'school_start_time': resolve_time(sec.school_start_time, school.school_start_time),
            'school_end_time':   resolve_time(sec.school_end_time,   school.school_end_time),
            'break_start_time':  resolve_time(sec.break_start_time,  school.break_start_time),
            'break_end_time':    resolve_time(sec.break_end_time,    school.break_end_time),
        }
        for sec in my_sections
    ]

    my_section_ids = [s['id'] for s in section_data]
    upcoming_list = [
        {'id': e.id, 'name': e.name, 'date': str(e.date),
         'subject': e.subject.name, 'section': e.class_section.name}
        for e in Exam.objects.filter(
            class_section_id__in=my_section_ids, date__gte=today, date__lte=next_week
        ).select_related('subject', 'class_section').order_by('date')[:5]
    ]

    total_students = StudentEnrollment.objects.filter(
        class_section_id__in=my_section_ids, is_active=True
    ).values('student_id').distinct().count()

    my_subjects   = list(teacher.subjects.values('id', 'name', 'course__name'))
    curr_month    = today.strftime('%Y-%m')
    salary_data   = None
    try:
        sheet = SalarySheet.objects.prefetch_related('components', 'payments').get(teacher=teacher, month=curr_month)
        salary_data = {
            'month':       sheet.month,
            'net_salary':  float(sheet.net_salary),
            'amount_paid': float(sheet.amount_paid),
            'balance':     float(sheet.balance),
            'status':      sheet.status,
        }
    except SalarySheet.DoesNotExist:
        pass

    attendance_sections = [s for s in section_data if s['is_class_teacher']]
    pending_attendance  = sum(1 for s in attendance_sections if not s['marked_today'])

    return Response({
        'role': 'teacher',
        'stats': {
            'total_students':     total_students,
            'total_sections':     len(section_data),
            'total_subjects':     len(my_subjects),
            'pending_attendance': pending_attendance,
        },
        'sections':       section_data,
        'subjects':       my_subjects,
        'upcoming_exams': upcoming_list,
        'salary':         salary_data,
    })


def _dashboard_student(user, today, next_week):
    try:
        student = user.student_profile
    except Exception:
        return Response({'role': 'student', 'stats': {}})

    att_qs      = Attendance.objects.filter(student=student)
    total_att   = att_qs.count()
    present_att = att_qs.filter(status='present').count()
    absent_att  = att_qs.filter(status='absent').count()
    late_att    = att_qs.filter(status='late').count()
    att_pct     = round(present_att / total_att * 100, 1) if total_att else 0
    today_att   = att_qs.filter(date=today).first()

    upcoming_list = [
        {'id': e.id, 'name': e.name, 'date': str(e.date), 'subject': e.subject.name}
        for e in Exam.objects.filter(
            class_section=student.class_section, date__gte=today, date__lte=next_week
        ).select_related('subject').order_by('date')[:5]
    ]

    results_list = [
        {'exam': r.exam.name, 'subject': r.exam.subject.name,
         'marks': f"{r.marks_obtained}/{r.exam.total_marks}",
         'grade': r.grade, 'passed': r.passed}
        for r in Result.objects.filter(student=student).select_related('exam__subject').order_by('-exam__date')[:5]
    ]

    student_vouchers = list(FeeVoucher.objects.filter(student=student).prefetch_related('line_items'))
    fee_due     = sum(v.total_amount for v in student_vouchers)
    fee_paid    = sum(float(v.amount_paid) for v in student_vouchers)
    overdue_count = sum(1 for v in student_vouchers if v.status == 'overdue')

    return Response({
        'role': 'student',
        'stats': {
            'attendance_percentage': att_pct,
            'total_classes': total_att,
            'present':       present_att,
            'absent':        absent_att,
            'late':          late_att,
            'today_status':  today_att.status if today_att else None,
            'fee_balance':   round(fee_due - fee_paid, 2),
            'overdue_fees':  overdue_count,
        },
        'upcoming_exams': upcoming_list,
        'recent_results': results_list,
    })


def _dashboard_parent(user, today, next_week):
    children = Student.objects.filter(parent__user=user, is_active=True).select_related('user', 'class_section')
    children_data = []
    for child in children:
        att_qs    = Attendance.objects.filter(student=child)
        total_att = att_qs.count()
        present   = att_qs.filter(status='present').count()
        att_pct   = round(present / total_att * 100, 1) if total_att else 0

        child_vouchers = list(FeeVoucher.objects.filter(student=child).prefetch_related('line_items'))
        fee_due  = sum(v.total_amount for v in child_vouchers)
        fee_paid = sum(float(v.amount_paid) for v in child_vouchers)

        last_result = Result.objects.filter(student=child).select_related('exam__subject').order_by('-exam__date').first()

        children_data.append({
            'name':           child.user.get_full_name() or child.user.username,
            'section':        f"{child.class_section.course.name} \u2013 {child.class_section.name}",
            'attendance_pct': att_pct,
            'fee_balance':    round(fee_due - fee_paid, 2),
            'last_result': {
                'exam':    last_result.exam.name,
                'subject': last_result.exam.subject.name,
                'grade':   last_result.grade,
                'passed':  last_result.passed,
            } if last_result else None,
        })

    return Response({'role': 'parent', 'children': children_data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    GET /api/auth/dashboard-stats/
    Returns role-specific statistics for the dashboard.
    """
    user = request.user
    role = get_effective_role(user)
    today = date.today()
    next_week = today + timedelta(days=7)

    _handlers = {
        'super_admin':  _dashboard_super_admin,
        'school_admin': _dashboard_school_admin,
        'principal':    _dashboard_principal,
        'teacher':      _dashboard_teacher,
        'student':      _dashboard_student,
        'parent':       _dashboard_parent,
    }
    handler = _handlers.get(role)
    if handler:
        return handler(user, today, next_week)
    return Response({'role': role, 'stats': {}})


# ── School Settings ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def public_school_info(request):
    """Public endpoint — returns school name and logo for the login page (no auth required)."""
    obj = SchoolSettings.get()
    logo_url = request.build_absolute_uri(obj.logo.url) if obj.logo else None
    return Response({'name': obj.name, 'logo': logo_url})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def school_settings(request):
    obj = SchoolSettings.get()
    logo_url = request.build_absolute_uri(obj.logo.url) if obj.logo else None
    return Response({'name': obj.name, 'logo': logo_url})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_school_settings(request):
    role = getattr(request.user, 'role', '')
    if not request.user.is_superuser and role not in ('super_admin', 'school_admin'):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    obj = SchoolSettings.get()

    name = request.data.get('name', '').strip()
    if name:
        obj.name = name

    logo = request.FILES.get('logo')
    if logo:
        obj.logo = logo

    obj.save()
    logo_url = request.build_absolute_uri(obj.logo.url) if obj.logo else None
    return Response({'name': obj.name, 'logo': logo_url})
