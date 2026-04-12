import calendar
from collections import defaultdict
from datetime import date

from django.db.models import Count, Q, Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from students.models import Student
from .models import AutoGenerateLog, ClassFeeStructure, EnrollmentFeePackage, FeeRevisionLog, FeeVoucher, VoucherLineItem, VoucherPayment
from .serializers import ClassFeeStructureSerializer, EnrollmentFeePackageSerializer, FeeRevisionLogSerializer, FeeVoucherSerializer

MANAGEMENT = ('super_admin', 'school_admin', 'principal')
FINANCE    = ('super_admin', 'school_admin')   # write-access to fees/payments


def has_management_access(user):
    """Allow superuser accounts (created via createsuperuser) as well as role-based management."""
    return user.is_superuser or user.role in MANAGEMENT


def has_finance_access(user):
    """Allow superuser accounts as well as finance roles."""
    return user.is_superuser or user.role in FINANCE


def is_super_admin(user):
    """True for Django superusers and users with super_admin role."""
    return user.is_superuser or user.role == 'super_admin'


# ── Class Fee Structures ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def class_fee_structure_list(request):
    """GET /fees/class-structures/?session=<id>"""
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    qs = ClassFeeStructure.objects.select_related('course', 'session').all()
    session_id = request.query_params.get('session')
    if session_id:
        qs = qs.filter(session_id=session_id)
    return Response(ClassFeeStructureSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def class_fee_structure_create(request):
    """POST /fees/class-structures/create/"""
    if not has_finance_access(request.user):
        return Response({'error': 'Only Admin can create fee structures.'}, status=status.HTTP_403_FORBIDDEN)
    serializer = ClassFeeStructureSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def class_fee_structure_detail(request, pk):
    """GET/PUT/DELETE /fees/class-structures/<pk>/"""
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        obj = ClassFeeStructure.objects.get(pk=pk)
    except ClassFeeStructure.DoesNotExist:
        return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ClassFeeStructureSerializer(obj).data)

    if request.method == 'PUT':
        if not has_finance_access(request.user):
            return Response({'error': 'Only Admin can edit fee structures.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ClassFeeStructureSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not has_finance_access(request.user):
        return Response({'error': 'Only Admin can delete fee structures.'}, status=status.HTTP_403_FORBIDDEN)
    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def class_fee_bulk_revise(request):
    """
    POST /fees/class-structures/revise/
    Applies a % or fixed increase to selected fee fields across selected classes.

    Body:
    {
      session:        <id>,
      revision_type:  'percentage' | 'fixed',
      fee_field:      'tuition_fee' | 'transport_fee' | 'all_monthly' | 'all',
      amount:         <number>,
      applied_to_all: true | false,
      course_ids:     [1, 2, 3],   (ignored if applied_to_all=true)
      note:           ''
    }
    """
    if not has_finance_access(request.user):
        return Response({'error': 'Only Admin can revise fees.'}, status=status.HTTP_403_FORBIDDEN)

    session_id     = request.data.get('session')
    revision_type  = request.data.get('revision_type', '').strip()
    fee_field      = request.data.get('fee_field', '').strip()
    applied_to_all = request.data.get('applied_to_all', True)
    course_ids     = request.data.get('course_ids', [])
    note           = request.data.get('note', '').strip()

    try:
        amount = float(request.data.get('amount', 0))
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'amount': 'Amount must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

    if revision_type not in ('percentage', 'fixed'):
        return Response({'revision_type': 'Must be "percentage" or "fixed".'}, status=status.HTTP_400_BAD_REQUEST)

    valid_fields = ('tuition_fee', 'transport_fee', 'all_monthly', 'all')
    if fee_field not in valid_fields:
        return Response({'fee_field': f'Must be one of: {", ".join(valid_fields)}.'}, status=status.HTTP_400_BAD_REQUEST)

    # Which ClassFeeStructure records to update
    qs = ClassFeeStructure.objects.filter(session_id=session_id) if session_id else ClassFeeStructure.objects.all()
    if not applied_to_all and course_ids:
        qs = qs.filter(course_id__in=course_ids)

    # Which decimal fields to touch
    FIELD_MAP = {
        'tuition_fee':   ['tuition_fee'],
        'transport_fee': ['transport_fee'],
        'all_monthly':   ['tuition_fee', 'transport_fee'],
        'all':           ['tuition_fee', 'transport_fee', 'registration_fee', 'books_fee', 'exam_fee'],
    }
    fields_to_update = FIELD_MAP[fee_field]

    structures = list(qs)
    for struct in structures:
        for field in fields_to_update:
            current = float(getattr(struct, field))
            if revision_type == 'percentage':
                setattr(struct, field, round(current * (1 + amount / 100), 2))
            else:  # fixed
                setattr(struct, field, round(current + amount, 2))

    ClassFeeStructure.objects.bulk_update(structures, fields_to_update)

    # Log the revision
    log = FeeRevisionLog.objects.create(
        session_id     = session_id,
        revision_type  = revision_type,
        fee_field      = fee_field,
        amount         = amount,
        applied_to_all = applied_to_all,
        note           = note,
        applied_by     = request.user,
        affected_count = len(structures),
    )
    if not applied_to_all and course_ids:
        log.courses.set(course_ids)

    return Response({
        'message':  f'Fee revision applied to {len(structures)} class(es).',
        'affected': len(structures),
        'log':      FeeRevisionLogSerializer(log).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fee_revision_log(request):
    """GET /fees/revisions/"""
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    logs = FeeRevisionLog.objects.select_related('session', 'applied_by').prefetch_related('courses').all()[:50]
    return Response(FeeRevisionLogSerializer(logs, many=True).data)


# ── Student's own vouchers ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_vouchers(request):
    """
    GET /fees/my-vouchers/
    Returns the authenticated student's own fee vouchers with summary.
    """
    if request.user.role != 'student':
        return Response({'error': 'Students only.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student_profile
    except Exception:
        return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    vouchers = FeeVoucher.objects.filter(student=student).prefetch_related(
        'line_items', 'payments'
    ).order_by('-created_at')

    voucher_list = list(vouchers)
    total_billed = sum(v.total_amount for v in voucher_list)
    total_paid   = sum(float(v.amount_paid) for v in voucher_list)
    summary = {
        'total_billed':  round(total_billed, 2),
        'total_paid':    round(total_paid, 2),
        'balance':       round(total_billed - total_paid, 2),
        'paid_count':    sum(1 for v in voucher_list if v.status == 'paid'),
        'pending_count': sum(1 for v in voucher_list if v.status == 'pending'),
        'overdue_count': sum(1 for v in voucher_list if v.status == 'overdue'),
        'partial_count': sum(1 for v in voucher_list if v.status == 'partial'),
    }

    return Response({
        'vouchers': FeeVoucherSerializer(vouchers, many=True).data,
        'summary':  summary,
    })


# ── Enrollment Fee Packages ───────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def enrollment_fee_package_list(request):
    """
    GET /fees/enrollment-packages/
    List all students with their enrollment fee packages.
    Filters: section=<id>, search=<name>
    """
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    qs = EnrollmentFeePackage.objects.select_related(
        'student__user',
    ).prefetch_related(
        'student__enrollments__course',
        'student__enrollments__class_section',
    ).all()

    section_id = request.query_params.get('section')
    search = request.query_params.get('search', '').strip()

    if section_id:
        qs = qs.filter(student__enrollments__class_section_id=section_id, student__enrollments__is_active=True)

    if search:
        qs = qs.filter(
            Q(student__user__first_name__icontains=search) |
            Q(student__user__last_name__icontains=search) |
            Q(student__admission_number__icontains=search) |
            Q(student__enrollments__roll_number__icontains=search)
        )

    return Response(EnrollmentFeePackageSerializer(qs.distinct(), many=True).data)


# ── Fee Vouchers ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def voucher_list(request):
    """
    GET /fees/vouchers/
    Filters: type=admission|monthly|annual, month=YYYY-MM, year=YYYY,
             section=<id>, status=pending|partial|paid|overdue, student=<id>, search=<q>
    """
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    qs = FeeVoucher.objects.select_related('student__user').prefetch_related(
        'line_items', 'payments',
        'student__enrollments__course',
        'student__enrollments__class_section',
    ).all()

    vtype = request.query_params.get('type')
    if vtype:
        qs = qs.filter(voucher_type=vtype)

    month = request.query_params.get('month')
    if month:
        qs = qs.filter(month=month)

    year = request.query_params.get('year')
    if year:
        qs = qs.filter(year=year)

    student_id = request.query_params.get('student')
    if student_id:
        qs = qs.filter(student_id=student_id)

    section_id = request.query_params.get('section')
    if section_id:
        qs = qs.filter(
            student__enrollments__class_section_id=section_id,
            student__enrollments__is_active=True,
        )

    search = request.query_params.get('search', '').strip()
    if search:
        qs = qs.filter(
            Q(student__first_name__icontains=search) |
            Q(student__last_name__icontains=search) |
            Q(student__admission_number__icontains=search) |
            Q(voucher_number__icontains=search)
        )

    # Status filter — computed property, so filter Python-side after serialization
    # But first narrow down by date to reduce queryset size for overdue/pending
    status_filter = request.query_params.get('status')

    if status_filter == 'overdue':
        # Overdue = not fully paid AND past due date
        qs = qs.filter(due_date__lt=date.today())
    elif status_filter == 'paid':
        # Paid vouchers have amount_paid >= sum of line items (approximate: exclude zero-paid)
        pass  # still need Python-side check for exact match

    data = FeeVoucherSerializer(qs.distinct(), many=True).data

    if status_filter:
        data = [d for d in data if d['status'] == status_filter]

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def voucher_detail(request, pk):
    """GET /fees/vouchers/<pk>/"""
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        v = FeeVoucher.objects.prefetch_related('line_items', 'payments').get(pk=pk)
    except FeeVoucher.DoesNotExist:
        return Response({'error': 'Voucher not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(FeeVoucherSerializer(v).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def voucher_pay(request, pk):
    """
    POST /fees/vouchers/<pk>/pay/
    Body: { amount, payment_method, transaction_id, note }
    """
    if not has_finance_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        voucher = FeeVoucher.objects.prefetch_related('line_items', 'payments').get(pk=pk)
    except FeeVoucher.DoesNotExist:
        return Response({'error': 'Voucher not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        amount = float(request.data.get('amount', 0))
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Amount must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

    balance = voucher.balance
    if amount > balance + 0.01:
        return Response(
            {'error': f'Amount exceeds outstanding balance (PKR {balance:.2f}).'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    VoucherPayment.objects.create(
        voucher        = voucher,
        amount         = amount,
        payment_method = request.data.get('payment_method', 'cash'),
        transaction_id = request.data.get('transaction_id', ''),
        note           = request.data.get('note', ''),
        received_by    = request.user,
    )

    voucher.amount_paid = float(voucher.amount_paid) + amount
    voucher.save(update_fields=['amount_paid'])
    voucher.refresh_from_db()

    return Response(FeeVoucherSerializer(voucher).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def voucher_generate_monthly(request):
    """
    POST /fees/vouchers/generate-monthly/
    Body: { month: "2025-04", section_id: <id> (optional) }
    """
    if not has_finance_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    today = date.today()
    month = (request.data.get('month') or f'{today.year}-{today.month:02d}').strip()
    section_id = request.data.get('section_id')

    try:
        from .utils import generate_monthly_vouchers
        created, skipped = generate_monthly_vouchers(month, section_id=section_id, created_by=request.user)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'month': month, 'created': created, 'skipped': skipped}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def voucher_delete(request, pk):
    """DELETE /fees/vouchers/<pk>/ — super_admin only"""
    if not is_super_admin(request.user):
        return Response({'error': 'Only Super Admin can delete vouchers.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        FeeVoucher.objects.get(pk=pk).delete()
    except FeeVoucher.DoesNotExist:
        return Response({'error': 'Voucher not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def voucher_payment_delete(request, voucher_pk, payment_pk):
    """DELETE /fees/vouchers/<voucher_pk>/payments/<payment_pk>/ — super_admin only"""
    if not is_super_admin(request.user):
        return Response({'error': 'Only Super Admin can delete payments.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        voucher = FeeVoucher.objects.get(pk=voucher_pk)
        payment = VoucherPayment.objects.get(pk=payment_pk, voucher=voucher)
    except FeeVoucher.DoesNotExist:
        return Response({'error': 'Voucher not found.'}, status=status.HTTP_404_NOT_FOUND)
    except VoucherPayment.DoesNotExist:
        return Response({'error': 'Payment not found.'}, status=status.HTTP_404_NOT_FOUND)

    amount = float(payment.amount)
    payment.delete()

    # Recalculate voucher amount_paid
    voucher.amount_paid = max(0, float(voucher.amount_paid) - amount)
    voucher.save(update_fields=['amount_paid'])

    voucher.refresh_from_db()
    return Response(FeeVoucherSerializer(voucher).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def voucher_delete_month(request):
    """DELETE /fees/vouchers/delete-month/?month=YYYY-MM — super_admin only"""
    if not is_super_admin(request.user):
        return Response({'error': 'Only Super Admin can delete vouchers.'}, status=status.HTTP_403_FORBIDDEN)
    month = request.query_params.get('month', '').strip()
    if not month:
        return Response({'error': 'month parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
    deleted, _ = FeeVoucher.objects.filter(voucher_type='monthly', month=month).delete()
    return Response({'deleted': deleted, 'month': month})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def enrollment_package_delete(request, pk):
    """DELETE /fees/enrollment-packages/<pk>/ — super_admin only"""
    if not is_super_admin(request.user):
        return Response({'error': 'Only Super Admin can delete enrollment fee packages.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        EnrollmentFeePackage.objects.get(pk=pk).delete()
    except EnrollmentFeePackage.DoesNotExist:
        return Response({'error': 'Fee package not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def voucher_months(request):
    """GET /fees/vouchers/months/ — list of months that have monthly vouchers"""
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    months = list(
        FeeVoucher.objects.filter(voucher_type='monthly')
        .values_list('month', flat=True).distinct().order_by('-month')
    )
    return Response(months)


# ── Arrears Detail ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def voucher_arrears_detail(request, pk):
    """
    GET /fees/vouchers/<pk>/arrears-detail/
    Returns a breakdown of which previous vouchers contributed to the arrears
    on this voucher, with per-month fee details (tuition, transport, etc.)
    """
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        voucher = FeeVoucher.objects.prefetch_related('line_items').get(pk=pk)
    except FeeVoucher.DoesNotExist:
        return Response({'error': 'Voucher not found.'}, status=status.HTTP_404_NOT_FOUND)

    if float(voucher.arrears) <= 0:
        return Response({'total_arrears': 0, 'sources': []})

    # Find all previous unpaid vouchers for this student
    prev_vouchers = FeeVoucher.objects.filter(
        student=voucher.student,
    ).exclude(voucher_type='annual').prefetch_related('line_items', 'payments')

    sources = []
    for v in prev_vouchers:
        is_prev_monthly = (
            v.voucher_type == 'monthly' and v.month and
            voucher.voucher_type == 'monthly' and v.month < voucher.month
        )
        is_unpaid_admission = v.voucher_type == 'admission' and v.status != 'paid'
        if not (is_prev_monthly or is_unpaid_admission):
            continue

        own_total = sum(float(item.amount) for item in v.line_items.all())
        own_unpaid = round(max(0, own_total - float(v.amount_paid)), 2)

        if own_unpaid <= 0:
            continue  # fully paid, not contributing to arrears

        sources.append({
            'voucher_id':     v.id,
            'voucher_number': v.voucher_number,
            'voucher_type':   v.voucher_type,
            'month':          v.month,
            'due_date':       str(v.due_date),
            'line_items': [
                {'label': item.label, 'amount': float(item.amount)}
                for item in v.line_items.all()
            ],
            'own_total':    own_total,
            'amount_paid':  float(v.amount_paid),
            'own_unpaid':   own_unpaid,
        })

    # Sort by month ascending so oldest appears first
    sources.sort(key=lambda x: (x['month'] or ''))

    return Response({
        'total_arrears': float(voucher.arrears),
        'sources': sources,
    })


# ── Student Fee Ledger ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_fee_ledger(request, student_id):
    """
    GET /fees/student-ledger/<student_id>/
    Returns all vouchers + payments for one student with running balance.
    """
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = Student.objects.select_related('user').get(pk=student_id)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    vouchers = FeeVoucher.objects.filter(student=student).prefetch_related(
        'line_items', 'payments__received_by'
    ).order_by('created_at')

    running_balance = 0.0
    entries = []
    for v in vouchers:
        running_balance += v.total_amount
        payments_data = []
        for p in sorted(v.payments.all(), key=lambda x: (x.payment_date, x.id)):
            running_balance -= float(p.amount)
            payments_data.append({
                'date':            str(p.payment_date),
                'amount':          float(p.amount),
                'method':          p.payment_method,
                'transaction_id':  p.transaction_id,
                'received_by':     p.received_by.get_full_name() if p.received_by else '',
                'note':            p.note,
                'running_balance': round(running_balance, 2),
            })
        entries.append({
            'id':             v.id,
            'voucher_number': v.voucher_number,
            'type':           v.voucher_type,
            'month':          v.month,
            'year':           v.year,
            'due_date':       str(v.due_date),
            'line_items':     [{'label': li.label, 'amount': float(li.amount)} for li in v.line_items.all()],
            'arrears':        float(v.arrears),
            'total_amount':   v.total_amount,
            'amount_paid':    float(v.amount_paid),
            'balance':        v.balance,
            'status':         v.status,
            'created_at':     v.created_at.date().isoformat(),
            'payments':       payments_data,
        })

    voucher_list_data = list(vouchers)
    total_billed = sum(v.total_amount for v in voucher_list_data)
    total_paid   = sum(float(v.amount_paid) for v in voucher_list_data)

    enrollment = student.enrollments.filter(is_active=True).select_related('course', 'class_section').first()

    student_name = ' '.join(filter(None, [student.first_name, student.middle_name, student.last_name]))
    if not student_name and student.user:
        student_name = student.user.get_full_name() or student.user.username
    if not student_name:
        student_name = student.admission_number or f'Student #{student.id}'

    return Response({
        'student': {
            'id':               student.id,
            'name':             student_name,
            'admission_number': student.admission_number,
            'class_name':       enrollment.course.name if enrollment else '',
            'section_name':     (enrollment.class_section.name if enrollment and enrollment.class_section else ''),
            'roll_number':      enrollment.roll_number if enrollment else '',
        },
        'summary': {
            'total_billed':  round(total_billed, 2),
            'total_paid':    round(total_paid, 2),
            'total_balance': round(total_billed - total_paid, 2),
            'voucher_count': len(voucher_list_data),
            'paid_count':    sum(1 for v in voucher_list_data if v.status == 'paid'),
            'unpaid_count':  sum(1 for v in voucher_list_data if v.status != 'paid'),
        },
        'entries': entries,
    })


# ── Fee Collection Report ─────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def collection_report(request):
    """
    GET /fees/collection-report/?mode=daily&date=YYYY-MM-DD
    GET /fees/collection-report/?mode=monthly&month=YYYY-MM
    GET /fees/collection-report/?mode=yearly&year=YYYY
    """
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    mode  = request.query_params.get('mode', 'daily')
    today = date.today()

    if mode == 'daily':
        date_str = request.query_params.get('date', today.isoformat())
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            d = today
        date_from = date_to = d
        label = d.strftime('%B %d, %Y')
    elif mode == 'monthly':
        month_str = request.query_params.get('month', f'{today.year}-{today.month:02d}')
        try:
            year, mon = map(int, month_str.split('-'))
        except (ValueError, AttributeError):
            year, mon = today.year, today.month
        last_day  = calendar.monthrange(year, mon)[1]
        date_from = date(year, mon, 1)
        date_to   = date(year, mon, last_day)
        label     = date(year, mon, 1).strftime('%B %Y')
    else:  # yearly
        year_str = request.query_params.get('year', str(today.year))
        try:
            year = int(year_str)
        except ValueError:
            year = today.year
        date_from = date(year, 1, 1)
        date_to   = date(year, 12, 31)
        label     = str(year)

    vp_qs = VoucherPayment.objects.filter(
        payment_date__gte=date_from,
        payment_date__lte=date_to,
    ).select_related('voucher__student__user', 'received_by')\
     .prefetch_related('voucher__student__enrollments__course',
                       'voucher__student__enrollments__class_section')

    total = float(vp_qs.aggregate(t=Sum('amount'))['t'] or 0)

    by_method = {}
    for row in vp_qs.values('payment_method').annotate(total=Sum('amount'), count=Count('id')):
        by_method[row['payment_method']] = {
            'total': float(row['total']),
            'count': row['count'],
        }

    by_type = {}
    for row in vp_qs.values('voucher__voucher_type').annotate(total=Sum('amount'), count=Count('id')):
        vtype = row['voucher__voucher_type'] or 'other'
        by_type[vtype] = {
            'total': float(row['total']),
            'count': row['count'],
        }

    # Breakdown: per-day for monthly mode, per-month for yearly mode
    breakdown = {}
    if mode == 'monthly':
        for row in vp_qs.values('payment_date').annotate(total=Sum('amount'), count=Count('id')):
            breakdown[str(row['payment_date'])] = {'total': float(row['total']), 'count': row['count']}
    elif mode == 'yearly':
        agg = defaultdict(lambda: {'total': 0.0, 'count': 0})
        for p in vp_qs:
            key = p.payment_date.strftime('%Y-%m')
            agg[key]['total'] += float(p.amount)
            agg[key]['count'] += 1
        breakdown = dict(agg)

    # Recent transactions (up to 500)
    recent = []
    for p in vp_qs.order_by('-payment_date', '-id')[:500]:
        try:
            enr = p.voucher.student.enrollments.filter(is_active=True).select_related('course', 'class_section').first()
            cs  = enr.course.name if enr else ''
            if enr and enr.class_section:
                cs += f' – {enr.class_section.name}'
        except Exception:
            cs = ''
        recent.append({
            'id':               p.id,
            'date':             p.payment_date.isoformat(),
            'student_name':     (p.voucher.student.user.get_full_name() if p.voucher.student.user else None) or ' '.join(filter(None, [p.voucher.student.first_name, p.voucher.student.last_name])) or p.voucher.student.admission_number,
            'admission_number': p.voucher.student.admission_number,
            'class_section':    cs,
            'voucher_number':   p.voucher.voucher_number,
            'voucher_type':     p.voucher.voucher_type,
            'amount':           float(p.amount),
            'method':           p.payment_method,
            'transaction_id':   p.transaction_id,
            'received_by':      p.received_by.get_full_name() if p.received_by else '',
            'note':             p.note,
        })

    return Response({
        'mode':               mode,
        'label':              label,
        'date_from':          date_from.isoformat(),
        'date_to':            date_to.isoformat(),
        'total_collected':    round(total, 2),
        'by_method':          by_method,
        'by_type':            by_type,
        'breakdown':          breakdown,
        'recent_transactions': recent,
    })


# ── Auto-Generate Schedule ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def autogenerate_status(request):
    """GET /fees/autogenerate/status/ — scheduler status + recent logs"""
    if not has_management_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    from . import scheduler
    sched = scheduler.get_status()

    logs = AutoGenerateLog.objects.all()[:10]
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

    return Response({**sched, 'logs': logs_data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def autogenerate_trigger(request):
    """
    POST /fees/autogenerate/trigger/
    Manually trigger auto-generation for a specific month (or current month).
    """
    if not has_finance_access(request.user):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    from . import scheduler

    today = date.today()
    month = (request.data.get('month') or f'{today.year}-{today.month:02d}').strip()

    # Run synchronously and return result
    from .utils import generate_monthly_vouchers
    try:
        created, skipped = generate_monthly_vouchers(month)
        log = AutoGenerateLog.objects.create(
            month=month, created=created, skipped=skipped, success=True
        )
        return Response({'month': month, 'created': created, 'skipped': skipped, 'success': True})
    except Exception as exc:
        AutoGenerateLog.objects.create(month=month, created=0, skipped=0, success=False, error=str(exc))
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
