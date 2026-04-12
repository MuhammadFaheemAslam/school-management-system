from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.emails import send_welcome_email
from accounts.permissions import IsManagement, SALARY_FIELDS
from .models import Teacher, SalarySheet, SalaryComponent, SalaryPayment
from .serializers import (
    CreateTeacherSerializer, TeacherSerializer, UpdateTeacherSerializer,
    SalarySheetSerializer, SalaryComponentSerializer, SalaryPaymentSerializer,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_list(request):
    if request.user.role == 'teacher':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    if not (request.user.is_superuser or request.user.role in ('super_admin', 'school_admin', 'principal')):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    qs = Teacher.objects.select_related('user').prefetch_related('subjects', 'class_teacher_of__course', 'class_teacher_of__session').all()
    is_active = request.query_params.get('is_active')
    if is_active is not None:
        qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
    data = TeacherSerializer(qs, many=True).data
    if request.user.role == 'principal':
        for t in data:
            for f in SALARY_FIELDS:
                t.pop(f, None)
    return Response(data)


@api_view(['POST'])
@permission_classes([IsManagement])
def teacher_create(request):
    """
    Creates a User account (role=teacher) + Teacher profile atomically.
    Body: { first_name, last_name, middle_name?, username, email,
            designation, qualification, gender, date_of_birth?,
            cnic?, phone_number?, address?, date_of_joining?, subjects[] }
    """
    from django.contrib.auth import get_user_model
    from django.db import transaction
    import string, random

    User = get_user_model()

    first_name  = (request.data.get('first_name')  or '').strip()
    last_name   = (request.data.get('last_name')   or '').strip()
    middle_name = (request.data.get('middle_name') or '').strip()
    email       = (request.data.get('email')       or '').strip().lower()

    errors = {}
    if not first_name: errors['first_name'] = 'First name is required.'
    if not last_name:  errors['last_name']  = 'Last name is required.'
    if not email:
        errors['email'] = 'Email is required.'
    elif User.objects.filter(email__iexact=email).exists():
        errors['email'] = 'A user with this email already exists.'
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    # Use provided username or auto-generate a unique one
    def _unique_username(base):
        base = base.lower().replace(' ', '')
        candidate = base
        counter = 2
        while User.objects.filter(username__iexact=candidate).exists():
            candidate = f"{base}{counter}"
            counter += 1
        return candidate

    provided = (request.data.get('username') or '').strip()
    if provided:
        if User.objects.filter(username__iexact=provided).exists():
            return Response({'username': 'A user with this username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        username = provided
    else:
        username = _unique_username(f"{first_name}.{last_name}")

    def _gen_password(length=10):
        chars = string.ascii_letters + string.digits + '!@#$%'
        return ''.join(random.choices(chars, k=length))

    try:
        with transaction.atomic():
            temp_password = _gen_password()
            user = User.objects.create_user(
                username=username, email=email, password=temp_password,
                first_name=first_name, middle_name=middle_name, last_name=last_name,
                role='teacher', is_first_login=True,
            )

            cnic = (request.data.get('cnic') or '').strip() or None
            teacher_kwargs = dict(
                user            = user,
                designation     = request.data.get('designation', 'junior_teacher'),
                qualification   = request.data.get('qualification', ''),
                gender          = request.data.get('gender', ''),
                date_of_birth   = request.data.get('date_of_birth') or None,
                cnic            = cnic,
                phone_number    = request.data.get('phone_number', ''),
                address         = request.data.get('address', ''),
                date_of_joining = request.data.get('date_of_joining') or None,
            )
            # Salary fields are finance-only; principal cannot set them
            if request.user.role in ('super_admin', 'school_admin'):
                teacher_kwargs.update(
                    basic_salary        = request.data.get('basic_salary') or None,
                    payment_mode        = request.data.get('payment_mode', 'cash'),
                    bank_name           = request.data.get('bank_name', ''),
                    bank_account_number = request.data.get('bank_account_number', ''),
                )
            teacher = Teacher.objects.create(**teacher_kwargs)
            subject_ids = request.data.get('subjects', [])
            if subject_ids:
                teacher.subjects.set(subject_ids)

    except Exception as exc:
        from django.db import IntegrityError
        if isinstance(exc, IntegrityError):
            err = str(exc).lower()
            if 'cnic' in err:
                return Response({'cnic': 'A teacher with this CNIC already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    # Send welcome email — outside transaction so DB record is safe if email fails
    try:
        send_welcome_email(user, temp_password)
    except Exception:
        pass  # Email failure should not block the response

    data = TeacherSerializer(teacher).data
    data['temp_password'] = temp_password
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def teacher_detail(request, pk):
    try:
        teacher = Teacher.objects.select_related('user').prefetch_related(
            'subjects', 'class_teacher_of__course', 'class_teacher_of__session'
        ).get(pk=pk)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.role == 'teacher':
        if not hasattr(request.user, 'teacher_profile') or request.user.teacher_profile.id != teacher.id:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        data = TeacherSerializer(teacher).data
        # Principal cannot see salary details
        if request.user.role == 'principal':
            for f in SALARY_FIELDS:
                data.pop(f, None)
        return Response(data)

    if request.method == 'PUT':
        is_own_profile = (request.user.role == 'teacher' and
                          hasattr(request.user, 'teacher_profile') and
                          request.user.teacher_profile.id == teacher.id)
        is_management  = request.user.is_superuser or request.user.role in ('super_admin', 'school_admin', 'principal')

        if not is_own_profile and not is_management:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Update user account fields
        if is_management:
            user_fields_allowed = ['first_name', 'middle_name', 'last_name', 'email']
        else:
            user_fields_allowed = ['first_name', 'last_name', 'email']

        user_data = {k: request.data[k] for k in user_fields_allowed if k in request.data}
        if user_data:
            for field, value in user_data.items():
                setattr(teacher.user, field, value)
            teacher.user.save(update_fields=list(user_data.keys()))

        # Teacher editing own profile — only allow personal/contact fields
        if is_own_profile and not is_management:
            allowed = ['gender', 'date_of_birth', 'phone_number', 'address']
            limited_data = {k: request.data[k] for k in allowed if k in request.data}
            serializer = UpdateTeacherSerializer(teacher, data=limited_data, partial=True)
        elif request.user.role == 'principal':
            # Principal can edit everything except salary fields
            update_data = {k: v for k, v in request.data.items() if k not in SALARY_FIELDS}
            serializer = UpdateTeacherSerializer(teacher, data=update_data, partial=True)
        else:
            serializer = UpdateTeacherSerializer(teacher, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(TeacherSerializer(teacher).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE — super_admin only
    if not (request.user.is_superuser or request.user.role == 'super_admin'):
        return Response({'error': 'Only Super Admin can permanently delete teacher records.'}, status=status.HTTP_403_FORBIDDEN)
    teacher.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def my_teacher_profile(request):
    if request.user.role != 'teacher':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher_profile
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(TeacherSerializer(teacher).data)

    # PUT — teacher can only update personal/contact fields
    user_data = {k: request.data[k] for k in ['first_name', 'last_name', 'email'] if k in request.data}
    if user_data:
        for field, value in user_data.items():
            setattr(teacher.user, field, value)
        teacher.user.save(update_fields=list(user_data.keys()))

    allowed = ['gender', 'date_of_birth', 'phone_number', 'address']
    limited_data = {k: request.data[k] for k in allowed if k in request.data}
    serializer = UpdateTeacherSerializer(teacher, data=limited_data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(TeacherSerializer(teacher).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Salary Views ──────────────────────────────────────────────────────────────

def _is_finance(user):
    return user.is_superuser or user.role in ('super_admin', 'school_admin')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def salary_list(request):
    """
    GET /api/teachers/salaries/
    Finance-only. Filters: month, teacher_id, status
    """
    if not _is_finance(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    qs = SalarySheet.objects.select_related(
        'teacher__user', 'generated_by'
    ).prefetch_related('components', 'payments').all()

    month      = request.query_params.get('month')
    teacher_id = request.query_params.get('teacher')
    if month:
        qs = qs.filter(month=month)
    if teacher_id:
        qs = qs.filter(teacher_id=teacher_id)

    sheets = list(qs)
    # status filter (computed property — filter in Python)
    status_filter = request.query_params.get('status')
    if status_filter:
        sheets = [s for s in sheets if s.status == status_filter]

    return Response(SalarySheetSerializer(sheets, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_salary_sheets(request):
    """
    POST /api/teachers/salaries/generate/
    Body: { month: "YYYY-MM", components?: [{component_type, label, amount}] }
    Generates a SalarySheet for every active teacher with a basic_salary set.
    Skips teachers already having a sheet for that month.
    """
    if not _is_finance(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    month = (request.data.get('month') or '').strip()
    if not month or len(month) != 7 or month[4] != '-':
        return Response({'error': 'Provide month as YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)

    components_data = request.data.get('components', [])

    teachers = Teacher.objects.filter(is_active=True, basic_salary__isnull=False).select_related('user')
    created = 0
    skipped = 0
    for teacher in teachers:
        if SalarySheet.objects.filter(teacher=teacher, month=month).exists():
            skipped += 1
            continue
        sheet = SalarySheet.objects.create(
            teacher      = teacher,
            month        = month,
            basic_salary = teacher.basic_salary,
            generated_by = request.user,
        )
        for comp in components_data:
            SalaryComponent.objects.create(
                salary_sheet   = sheet,
                component_type = comp.get('component_type', 'allowance'),
                label          = comp.get('label', ''),
                amount         = comp.get('amount', 0),
            )
        created += 1

    return Response({
        'created': created,
        'skipped': skipped,
        'message': f'{created} salary sheet(s) generated, {skipped} skipped (already existed).',
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def salary_detail(request, pk):
    """
    GET/PUT/DELETE /api/teachers/salaries/<pk>/
    PUT allows updating note and components.
    DELETE — finance only, only if no payments recorded.
    """
    if not _is_finance(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        sheet = SalarySheet.objects.select_related(
            'teacher__user', 'generated_by'
        ).prefetch_related('components', 'payments').get(pk=pk)
    except SalarySheet.DoesNotExist:
        return Response({'error': 'Salary sheet not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(SalarySheetSerializer(sheet).data)

    if request.method == 'PUT':
        if 'note' in request.data:
            sheet.note = request.data['note']
        if 'basic_salary' in request.data:
            sheet.basic_salary = request.data['basic_salary']
        sheet.save()

        # Replace components if provided
        if 'components' in request.data:
            sheet.components.all().delete()
            for comp in request.data['components']:
                SalaryComponent.objects.create(
                    salary_sheet   = sheet,
                    component_type = comp.get('component_type', 'allowance'),
                    label          = comp.get('label', ''),
                    amount         = comp.get('amount', 0),
                )
        sheet.refresh_from_db()
        return Response(SalarySheetSerializer(
            SalarySheet.objects.prefetch_related('components', 'payments').get(pk=pk)
        ).data)

    # DELETE
    if sheet.payments.exists():
        return Response(
            {'error': 'Cannot delete a salary sheet that has recorded payments.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    sheet.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_salary_payment(request, pk):
    """
    POST /api/teachers/salaries/<pk>/pay/
    Body: { amount, payment_method, payment_date?, transaction_id?, note? }
    """
    if not _is_finance(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        sheet = SalarySheet.objects.prefetch_related('components', 'payments').get(pk=pk)
    except SalarySheet.DoesNotExist:
        return Response({'error': 'Salary sheet not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        amount = float(request.data.get('amount', 0))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount <= 0:
        return Response({'error': 'Amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

    if round(amount, 2) > round(sheet.balance, 2):
        return Response(
            {'error': f'Payment exceeds balance. Balance is PKR {sheet.balance}.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    payment = SalaryPayment.objects.create(
        salary_sheet   = sheet,
        amount         = amount,
        payment_method = request.data.get('payment_method', 'cash'),
        payment_date   = request.data.get('payment_date') or None,
        transaction_id = request.data.get('transaction_id', ''),
        paid_by        = request.user,
        note           = request.data.get('note', ''),
    )

    sheet.amount_paid = float(sheet.amount_paid) + amount
    sheet.save(update_fields=['amount_paid'])

    return Response(SalarySheetSerializer(
        SalarySheet.objects.prefetch_related('components', 'payments').get(pk=pk)
    ).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_salary(request):
    """
    GET /api/teachers/my-salary/
    Teacher sees their own salary sheets.
    """
    if request.user.role != 'teacher':
        return Response({'error': 'Teachers only.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher_profile
    except Exception:
        return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    sheets = list(
        SalarySheet.objects.filter(teacher=teacher)
        .prefetch_related('components', 'payments')
        .order_by('-month')
    )
    total_net    = sum(s.net_salary for s in sheets)
    total_paid   = sum(float(s.amount_paid) for s in sheets)
    total_balance = round(total_net - total_paid, 2)

    return Response({
        'sheets': SalarySheetSerializer(sheets, many=True).data,
        'summary': {
            'total_net':     round(total_net, 2),
            'total_paid':    round(total_paid, 2),
            'total_balance': total_balance,
            'paid_count':    sum(1 for s in sheets if s.status == 'paid'),
            'pending_count': sum(1 for s in sheets if s.status == 'pending'),
            'partial_count': sum(1 for s in sheets if s.status == 'partial'),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def salary_autogenerate_status(request):
    """GET /api/teachers/salaries/autogenerate/status/"""
    if not _is_finance(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    from . import scheduler
    from .models import SalaryAutoGenerateLog

    sched = scheduler.get_status()
    logs  = SalaryAutoGenerateLog.objects.all()[:10]
    logs_data = [
        {
            'month':   l.month,
            'created': l.created,
            'skipped': l.skipped,
            'success': l.success,
            'error':   l.error,
            'ran_at':  l.ran_at.isoformat(),
        }
        for l in logs
    ]
    return Response({'scheduler': sched, 'recent_logs': logs_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def salary_autogenerate_trigger(request):
    """
    POST /api/teachers/salaries/autogenerate/trigger/
    Body (optional): { month: "YYYY-MM" }
    Manually triggers salary sheet auto-generation for the given (or current) month.
    """
    if not _is_finance(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    from datetime import date as _date
    from .models import SalaryAutoGenerateLog
    from .scheduler import auto_generate_salary_sheets

    today = _date.today()
    month = (request.data.get('month') or f'{today.year}-{today.month:02d}').strip()

    try:
        created, skipped = auto_generate_salary_sheets(month)
        SalaryAutoGenerateLog.objects.create(
            month=month, created=created, skipped=skipped, success=True
        )
        return Response({
            'month':   month,
            'created': created,
            'skipped': skipped,
            'success': True,
            'message': f'{created} salary sheet(s) generated, {skipped} skipped.',
        })
    except Exception as exc:
        SalaryAutoGenerateLog.objects.create(
            month=month, created=0, skipped=0, success=False, error=str(exc)
        )
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
