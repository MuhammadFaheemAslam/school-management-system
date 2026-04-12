from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsManagement
from fees.models import EnrollmentFeePackage
from fees.serializers import EnrollmentFeePackageSerializer
from .models import Parent, Student, StudentDocument, StudentEnrollment
from .serializers import (
    CreateEnrollmentSerializer,
    CreateParentSerializer,
    ParentSerializer,
    StudentEnrollmentSerializer,
    StudentSerializer,
    UpdateStudentSerializer,
)


# ── Parents ───────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsManagement])
def parent_list(request):
    parents = Parent.objects.select_related('user').all()
    return Response(ParentSerializer(parents, many=True).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def parent_create(request):
    serializer = CreateParentSerializer(data=request.data)
    if serializer.is_valid():
        parent = serializer.save()
        return Response(ParentSerializer(parent).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def parent_detail(request, pk):
    try:
        parent = Parent.objects.get(pk=pk)
    except Parent.DoesNotExist:
        return Response({'error': 'Parent not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.role == 'parent':
        if not hasattr(request.user, 'parent_profile') or request.user.parent_profile.id != parent.id:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(ParentSerializer(parent).data)

    if not (request.user.is_superuser or request.user.role in ('super_admin', 'school_admin', 'principal')):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = CreateParentSerializer(parent, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(ParentSerializer(parent).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    parent.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Students ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_list(request):
    role = request.user.role

    if role in ('super_admin', 'school_admin', 'principal'):
        students = Student.objects.select_related('user', 'parent__user').prefetch_related('enrollments__session', 'enrollments__course', 'enrollments__class_section').all()

    elif role == 'teacher':
        try:
            teacher = request.user.teacher_profile
            assigned_section_ids = teacher.class_teacher_of.values_list('id', flat=True)
            student_ids = StudentEnrollment.objects.filter(
                class_section_id__in=assigned_section_ids, is_active=True
            ).values_list('student_id', flat=True)
            students = Student.objects.filter(id__in=student_ids).select_related('user', 'parent__user').prefetch_related('enrollments__session', 'enrollments__course', 'enrollments__class_section')
        except Exception:
            return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    elif role == 'parent':
        try:
            students = request.user.parent_profile.children.select_related('user', 'parent__user').prefetch_related('enrollments__session', 'enrollments__course', 'enrollments__class_section')
        except Exception:
            return Response({'error': 'Parent profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    else:
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    # Optional filter by session or course
    session_id = request.query_params.get('session')
    course_id  = request.query_params.get('course')
    section_id = request.query_params.get('section')
    if any([session_id, course_id, section_id]):
        enrollment_filter = StudentEnrollment.objects.filter(is_active=True)
        if session_id:  enrollment_filter = enrollment_filter.filter(session_id=session_id)
        if course_id:   enrollment_filter = enrollment_filter.filter(course_id=course_id)
        if section_id:  enrollment_filter = enrollment_filter.filter(class_section_id=section_id)
        student_ids = enrollment_filter.values_list('student_id', flat=True)
        students = students.filter(id__in=student_ids)

    # Search by name or admission number
    search = request.query_params.get('search', '').strip()
    if search:
        from django.db.models import Q
        students = students.filter(
            Q(first_name__icontains=search) |
            Q(middle_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(admission_number__icontains=search)
        )

    return Response(StudentSerializer(students, many=True).data)


FEE_FIELDS  = ['tuition_fee', 'transport_fee', 'registration_fee', 'books_fee', 'exam_fee', 'fee_note']
NAME_FIELDS = ['first_name', 'middle_name', 'last_name']
USER_FIELDS = ['username', 'email'] + NAME_FIELDS
ENROLLMENT_FIELDS = ['session', 'course', 'class_section', 'transport_required']


@api_view(['POST'])
@permission_classes([IsManagement])
def student_enroll(request):
    """
    Creates a Student record + StudentEnrollment atomically.
    create_account=true  → also creates a login User account.
    """
    from django.contrib.auth import get_user_model
    from django.db import transaction

    User = get_user_model()

    create_account = str(request.data.get('create_account', 'true')).lower() in ('true', '1', 'yes')

    first_name  = (request.data.get('first_name')  or '').strip()
    last_name   = (request.data.get('last_name')   or '').strip()
    middle_name = (request.data.get('middle_name') or '').strip()
    username    = (request.data.get('username')    or '').strip()
    email       = (request.data.get('email')       or '').strip().lower()

    errors = {}
    if not first_name: errors['first_name'] = 'First name is required.'
    if not last_name:  errors['last_name']  = 'Last name is required.'

    if create_account:
        if not username:
            errors['username'] = 'Username is required.'
        elif User.objects.filter(username__iexact=username).exists():
            errors['username'] = 'A user with this username already exists.'
        if not email:
            errors['email'] = 'Email is required.'
        elif User.objects.filter(email__iexact=email).exists():
            errors['email'] = 'A user with this email already exists.'

    # Validate enrollment fields
    course_id = request.data.get('course') or request.data.get('class_enrolled')
    if not course_id:
        errors['course'] = 'Class is required.'

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    # Separate data buckets
    SKIP = set(FEE_FIELDS + USER_FIELDS + ENROLLMENT_FIELDS + ['create_account', 'class_enrolled'])
    student_data    = {k: v for k, v in request.data.items() if k not in SKIP}
    # Convert empty unique-nullable fields to None so blank values don't violate UNIQUE constraint
    NULLABLE_UNIQUE = ('cnic',)
    for field in NULLABLE_UNIQUE:
        if field in student_data and student_data[field] == '':
            student_data[field] = None
    fee_data        = {k: v for k, v in request.data.items() if k in FEE_FIELDS}
    enrollment_data = {k: v for k, v in request.data.items() if k in ENROLLMENT_FIELDS}
    # Map class_enrolled → course if sent under old key
    if 'class_enrolled' in request.data and 'course' not in enrollment_data:
        enrollment_data['course'] = request.data['class_enrolled']

    import string, random
    def _gen_password(length=10):
        chars = string.ascii_letters + string.digits + '!@#$%'
        return ''.join(random.choices(chars, k=length))

    temp_password = None
    enrollment_serializer = None

    try:
        with transaction.atomic():
            # 1. Create login account (optional)
            user = None
            if create_account:
                temp_password = _gen_password()
                user = User.objects.create_user(
                    username=username, email=email, password=temp_password,
                    first_name=first_name, middle_name=middle_name, last_name=last_name,
                    role='student', is_first_login=True,
                )

            # 2. Create Student record
            clean_student_data = {k: v for k, v in student_data.items()
                                  if k not in ('class_section', 'class_enrolled', 'roll_number')}
            student = Student.objects.create(
                user=user,
                first_name=first_name,
                middle_name=middle_name,
                last_name=last_name,
                **{k: v for k, v in clean_student_data.items()
                   if hasattr(Student, k) and k not in ('id', 'student_id', 'admission_number', 'enrollment_date', 'created_at', 'first_name', 'middle_name', 'last_name')}
            )

            # 3. Create StudentEnrollment record
            enrollment_serializer = CreateEnrollmentSerializer(data=enrollment_data)
            if not enrollment_serializer.is_valid():
                raise Exception('__enrollment_error__')
            enrollment_serializer.save(student=student)

    except Exception as exc:
        from django.db import IntegrityError
        if enrollment_serializer is not None and str(exc) == '__enrollment_error__':
            return Response(enrollment_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, IntegrityError):
            err_str = str(exc).lower()
            if 'cnic' in err_str:
                return Response({'cnic': 'A student with this CNIC already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            if 'admission_number' in err_str:
                return Response({'admission_number': 'This admission number is already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            if 'username' in err_str:
                return Response({'username': 'A user with this username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            if 'email' in err_str:
                return Response({'email': 'A user with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': 'A duplicate record was detected. Please check all unique fields.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    # 4. Create fee package if any amounts provided
    has_fees = any(
        fee_data.get(f) not in (None, '', '0', 0)
        for f in ['tuition_fee', 'transport_fee', 'registration_fee', 'books_fee', 'exam_fee']
    )
    if has_fees:
        fee_package = EnrollmentFeePackage.objects.create(
            student          = student,
            tuition_fee      = fee_data.get('tuition_fee')      or 0,
            transport_fee    = fee_data.get('transport_fee')     or 0,
            registration_fee = fee_data.get('registration_fee') or 0,
            books_fee        = fee_data.get('books_fee')         or 0,
            exam_fee         = fee_data.get('exam_fee')          or 0,
            note             = fee_data.get('fee_note', ''),
            assigned_by      = request.user,
        )
        # Auto-generate admission voucher
        try:
            from fees.utils import generate_admission_voucher
            generate_admission_voucher(student, fee_package, created_by=request.user)
        except Exception:
            pass  # Voucher failure should not block enrollment

    response_data = StudentSerializer(student).data
    # Patch name fields into response when no login account
    if not create_account:
        response_data['first_name']  = first_name
        response_data['middle_name'] = middle_name
        response_data['last_name']   = last_name
        response_data['full_name']   = ' '.join(filter(None, [first_name, middle_name, last_name]))
    if temp_password:
        response_data['temp_password'] = temp_password
    return Response(response_data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def student_detail(request, pk):
    try:
        student = Student.objects.select_related('user', 'parent__user').prefetch_related(
            'enrollments__session', 'enrollments__course', 'enrollments__class_section'
        ).get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    role = request.user.role

    if role == 'student':
        if not hasattr(request.user, 'student_profile') or request.user.student_profile.id != student.id:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    elif role == 'parent':
        try:
            if student.parent != request.user.parent_profile:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(StudentSerializer(student).data)

    if role not in ('super_admin', 'school_admin', 'principal'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        # Update name/email on linked user account
        updatable_user_fields = NAME_FIELDS + ['email']
        name_data = {k: request.data[k] for k in updatable_user_fields if k in request.data}
        if name_data and student.user:
            for field, value in name_data.items():
                setattr(student.user, field, value)
            student.user.save(update_fields=list(name_data.keys()))

        serializer = UpdateStudentSerializer(student, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(StudentSerializer(student).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE — super_admin only
    if role != 'super_admin':
        return Response({'error': 'Only Super Admin can permanently delete student records.'}, status=status.HTTP_403_FORBIDDEN)
    student.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsManagement])
def student_deactivate(request, pk):
    """
    POST /students/<pk>/deactivate/
    school_admin / principal can mark a student inactive with a reason.
    super_admin can also use this endpoint.
    Body: { leaving_reason, leaving_note (optional), leaving_date (optional) }
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not student.is_active:
        return Response({'error': 'Student is already inactive.'}, status=status.HTTP_400_BAD_REQUEST)

    leaving_reason = request.data.get('leaving_reason', '').strip()
    if not leaving_reason:
        return Response({'leaving_reason': 'A leaving reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = [r[0] for r in Student.LEAVING_REASON_CHOICES]
    if leaving_reason not in valid_reasons:
        return Response({'leaving_reason': f'Invalid reason. Choose from: {", ".join(valid_reasons)}'}, status=status.HTTP_400_BAD_REQUEST)

    from datetime import date as today_date
    student.is_active      = False
    student.leaving_reason = leaving_reason
    student.leaving_note   = request.data.get('leaving_note', '').strip()
    student.leaving_date   = request.data.get('leaving_date') or str(today_date.today())
    student.save()

    # Also deactivate all active enrollments
    student.enrollments.filter(is_active=True).update(is_active=False)

    return Response(StudentSerializer(student).data)


@api_view(['PATCH'])
@permission_classes([IsManagement])
def student_slc(request, pk):
    """
    PATCH /students/<pk>/slc/
    Update SLC (School Leaving Certificate) status for a transfer student.
    Body: { slc_status: 'pending' | 'submitted', slc_submitted_date: 'YYYY-MM-DD' (optional) }
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    if student.admission_type != 'transfer':
        return Response({'error': 'SLC only applies to transfer students.'}, status=status.HTTP_400_BAD_REQUEST)

    slc_status = request.data.get('slc_status', '').strip()
    valid = ('pending', 'submitted')
    if slc_status not in valid:
        return Response({'slc_status': f'Must be one of: {", ".join(valid)}.'}, status=status.HTTP_400_BAD_REQUEST)

    student.slc_status = slc_status
    if slc_status == 'submitted':
        from datetime import date as today_date
        student.slc_submitted_date = request.data.get('slc_submitted_date') or str(today_date.today())
    else:
        student.slc_submitted_date = None
    student.save(update_fields=['slc_status', 'slc_submitted_date'])

    return Response(StudentSerializer(student).data)


@api_view(['PATCH'])
@permission_classes([IsManagement])
def student_change_section(request, pk):
    """
    PATCH /students/<pk>/section/
    Change the class_section of a student's active enrollment.
    Body: { class_section: <id> }   (null to unassign)
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    enrollment = student.enrollments.filter(is_active=True).first()
    if not enrollment:
        return Response({'error': 'Student has no active enrollment.'}, status=status.HTTP_400_BAD_REQUEST)

    section_id = request.data.get('class_section')
    if section_id:
        from courses.models import ClassSection
        try:
            section = ClassSection.objects.get(pk=section_id)
        except ClassSection.DoesNotExist:
            return Response({'class_section': 'Section not found.'}, status=status.HTTP_400_BAD_REQUEST)
        # Validate section belongs to the same course
        if section.course_id != enrollment.course_id:
            return Response({'class_section': 'Section does not belong to the enrolled course.'}, status=status.HTTP_400_BAD_REQUEST)
        enrollment.class_section = section
    else:
        enrollment.class_section = None

    enrollment.save(update_fields=['class_section'])
    return Response(StudentSerializer(student).data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsManagement])
def student_transport(request, pk):
    """
    GET  /students/<pk>/transport/
         Returns current transport status + suggested fee from ClassFeeStructure.

    PATCH /students/<pk>/transport/
         Enable or disable transport; also updates the fee package.
         Body: { transport_required: bool, transport_fee: decimal (required when enabling) }
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    enrollment = student.current_enrollment()
    if not enrollment:
        return Response({'error': 'This student has no active enrollment.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        from fees.models import ClassFeeStructure
        suggested_fee = 0
        try:
            cfs = ClassFeeStructure.objects.get(
                course=enrollment.course,
                session=enrollment.session,
            )
            suggested_fee = float(cfs.transport_fee)
        except ClassFeeStructure.DoesNotExist:
            pass

        return Response({
            'transport_required': enrollment.transport_required,
            'suggested_fee':      suggested_fee,
            'current_fee':        float(student.fee_package.transport_fee) if hasattr(student, 'fee_package') else 0,
        })

    # PATCH
    value = request.data.get('transport_required')
    if value is None:
        return Response({'error': 'transport_required is required.'}, status=status.HTTP_400_BAD_REQUEST)

    enable = bool(value)
    enrollment.transport_required = enable
    enrollment.save(update_fields=['transport_required'])

    # Update fee package
    from fees.models import EnrollmentFeePackage
    fee_package, _ = EnrollmentFeePackage.objects.get_or_create(
        student=student,
        defaults={'assigned_by': request.user},
    )
    if enable:
        try:
            transport_fee = float(request.data.get('transport_fee', 0))
            if transport_fee < 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'transport_fee': 'Enter a valid transport fee amount.'}, status=status.HTTP_400_BAD_REQUEST)
        fee_package.transport_fee = transport_fee
    else:
        fee_package.transport_fee = 0

    fee_package.save(update_fields=['transport_fee'])

    return Response(StudentSerializer(student).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_student_profile(request):
    if request.user.role != 'student':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student_profile
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(StudentSerializer(student).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def student_readmit(request, pk):
    """
    POST /students/<pk>/readmit/
    Re-activates an inactive student and creates a new enrollment.
    Body: { session, course, class_section (optional), transport_required }
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    if student.is_active:
        return Response({'error': 'Student is already active.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = CreateEnrollmentSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Reactivate student and clear leaving info
    student.is_active      = True
    student.leaving_reason = ''
    student.leaving_note   = ''
    student.leaving_date   = None
    student.save()

    # Create new enrollment for the new session
    enrollment = serializer.save(student=student, is_active=True)
    return Response(StudentSerializer(student).data, status=status.HTTP_200_OK)


# ── Enrollment history & promotion ────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_enrollment_history(request, pk):
    """Full enrollment history for a student (all sessions)."""
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    enrollments = student.enrollments.select_related('session', 'course', 'class_section').order_by('-session__start_date')
    return Response(StudentEnrollmentSerializer(enrollments, many=True).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def student_promote(request, pk):
    """
    Promote a student to a new class in a new session.
    Deactivates current enrollment and creates a new one.
    Body: { session, course, class_section (optional), transport_required }
    """
    try:
        student = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = CreateEnrollmentSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Deactivate current enrollment
    student.enrollments.filter(is_active=True).update(is_active=False)

    # Create new enrollment
    enrollment = serializer.save(student=student, is_active=True)
    return Response(StudentEnrollmentSerializer(enrollment).data, status=status.HTTP_201_CREATED)


# ── Student Documents ─────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def student_documents(request, student_id):
    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    role    = request.user.role
    is_own  = role == 'student' and hasattr(request.user, 'student_profile') and request.user.student_profile.id == student.id
    is_parent_of = (
        role == 'parent'
        and hasattr(request.user, 'parent_profile')
        and student.parent == request.user.parent_profile
    )

    if role not in ('super_admin', 'school_admin', 'principal', 'teacher') and not is_own and not is_parent_of:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        docs = StudentDocument.objects.filter(student=student)
        data = [
            {
                'id':          d.id,
                'title':       d.title,
                'doc_type':    d.doc_type,
                'file':        request.build_absolute_uri(d.file.url),
                'note':        d.note,
                'uploaded_by': d.uploaded_by.get_full_name() if d.uploaded_by else None,
                'uploaded_at': d.uploaded_at.strftime('%Y-%m-%d %H:%M'),
            }
            for d in docs
        ]
        return Response(data)

    if role not in ('super_admin', 'school_admin', 'principal'):
        return Response({'error': 'Only management can upload documents.'}, status=status.HTTP_403_FORBIDDEN)

    file     = request.FILES.get('file')
    title    = request.data.get('title', '').strip()
    doc_type = request.data.get('doc_type', 'other')
    note     = request.data.get('note', '')

    if not file:  return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
    if not title: return Response({'error': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if file.size > 10 * 1024 * 1024:
        return Response({'error': 'File size must be under 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)

    doc = StudentDocument.objects.create(
        student=student, doc_type=doc_type, title=title,
        file=file, uploaded_by=request.user, note=note
    )
    return Response({
        'id':          doc.id,
        'title':       doc.title,
        'doc_type':    doc.doc_type,
        'file':        request.build_absolute_uri(doc.file.url),
        'note':        doc.note,
        'uploaded_by': request.user.get_full_name() or request.user.username,
        'uploaded_at': doc.uploaded_at.strftime('%Y-%m-%d %H:%M'),
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def student_document_delete(request, student_id, doc_id):
    if not (request.user.is_superuser or request.user.role in ('super_admin', 'school_admin', 'principal')):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        doc = StudentDocument.objects.get(pk=doc_id, student_id=student_id)
    except StudentDocument.DoesNotExist:
        return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)
    doc.file.delete(save=False)
    doc.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
