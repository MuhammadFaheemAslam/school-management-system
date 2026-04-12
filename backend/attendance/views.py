from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _minutes_late(arrival_time, school_start_time=None):
    """Return how many minutes past school_start_time the student arrived, or None if no time recorded."""
    if not arrival_time:
        return None
    if school_start_time:
        start_minutes = school_start_time.hour * 60 + school_start_time.minute
    else:
        start_minutes = 8 * 60  # fallback: 08:00
    arrived_minutes = arrival_time.hour * 60 + arrival_time.minute
    return max(0, arrived_minutes - start_minutes)


def _get_start_time(section):
    """Section override → school-wide setting → hardcoded 08:00."""
    if section and section.school_start_time:
        return section.school_start_time
    try:
        from courses.models import SchoolSettings
        school = SchoolSettings.get()
        if school.school_start_time:
            return school.school_start_time
    except Exception:
        pass  # SchoolSettings may not exist yet; fall back to hardcoded 08:00 in _minutes_late
    return None  # _minutes_late will use 08:00 fallback


def _late_summary(late_records):
    """Break late records into full / half / absent buckets using each record's section start time."""
    late_full = late_half = late_absent = 0
    for rec in late_records:
        start_time = _get_start_time(rec.class_section)
        mins = _minutes_late(rec.arrival_time, start_time)
        if mins is None or mins <= 30:
            late_full += 1
        elif mins <= 120:
            late_half += 1
        else:
            late_absent += 1
    return late_full, late_half, late_absent

from accounts.permissions import IsManagement, IsManagementOrTeacher
from courses.models import ClassSection
from students.models import Student, StudentEnrollment
from .models import Attendance, TeacherAttendance
from .serializers import AttendanceSerializer, BulkAttendanceSerializer


@api_view(['POST'])
@permission_classes([IsManagementOrTeacher])
def mark_attendance(request):
    """
    POST /api/attendance/mark/
    Bulk-mark attendance for all students in a section on a given date.
    Teacher can only mark for their own sections.
    Creates or updates records (idempotent).
    """
    serializer = BulkAttendanceSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    section_id = data['class_section']
    date = data['date']
    records = data['records']

    # Teachers can only mark their own sections
    if request.user.role == 'teacher':
        try:
            teacher = request.user.teacher_profile
            if not teacher.class_teacher_of.filter(id=section_id).exists():
                return Response(
                    {'error': 'You can only mark attendance for your own sections.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except Exception:
            return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        section = ClassSection.objects.get(pk=section_id)
    except ClassSection.DoesNotExist:
        return Response({'error': 'Section not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Get students enrolled in this section (active enrollments)
    enrolled_ids = set(
        StudentEnrollment.objects.filter(class_section=section, is_active=True)
        .values_list('student_id', flat=True)
    )

    saved = []
    with transaction.atomic():
        for record in records:
            student_id = record['student']
            if student_id not in enrolled_ids:
                continue
            try:
                student = Student.objects.get(pk=student_id)
            except Student.DoesNotExist:
                continue

            obj, _ = Attendance.objects.update_or_create(
                student=student,
                date=date,
                defaults={
                    'class_section': section,
                    'status': record['status'],
                    'arrival_time': record.get('arrival_time') or None,
                    'note': record.get('note', ''),
                    'marked_by': request.user,
                }
            )
            saved.append(obj)

    return Response(
        AttendanceSerializer(saved, many=True).data,
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([IsManagementOrTeacher])
def attendance_by_section(request):
    """
    GET /api/attendance/?section=<id>&date=<YYYY-MM-DD>
    Returns attendance for a section on a given date.
    Also returns students without a record (not yet marked).
    """
    section_id = request.query_params.get('section')
    date = request.query_params.get('date')

    if not section_id or not date:
        return Response({'error': 'section and date query params are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        section = ClassSection.objects.get(pk=section_id)
    except ClassSection.DoesNotExist:
        return Response({'error': 'Section not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Teachers can only view their own sections
    if request.user.role == 'teacher':
        try:
            if not request.user.teacher_profile.class_teacher_of.filter(id=section_id).exists():
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_403_FORBIDDEN)

    enrollments = StudentEnrollment.objects.filter(
        class_section=section, is_active=True
    ).select_related('student__user')
    roll_map = {e.student_id: e.roll_number for e in enrollments}
    student_ids = list(roll_map.keys())
    students = Student.objects.filter(id__in=student_ids, is_active=True).select_related('user')
    records = Attendance.objects.filter(class_section=section, date=date).select_related('student__user', 'marked_by')
    records_map = {r.student_id: r for r in records}

    result = []
    for student in students:
        if student.id in records_map:
            rec = AttendanceSerializer(records_map[student.id]).data
            rec['roll_number'] = roll_map.get(student.id, '')
            result.append(rec)
        else:
            name = ' '.join(filter(None, [student.first_name, student.middle_name, student.last_name])) \
                   or (student.user.get_full_name() or student.user.username if student.user else 'Unknown')
            result.append({
                'id': None,
                'student': student.id,
                'student_name': name,
                'roll_number': roll_map.get(student.id, ''),
                'class_section': section.id,
                'date': date,
                'father_name': student.father_name or '',
                'status': None,
                'arrival_time': None,
                'note': '',
                'marked_by': None,
                'marked_by_name': None,
            })

    return Response({'section': str(section), 'date': date, 'records': result})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_attendance(request):
    """
    GET /api/attendance/me/
    Student views their own attendance records.
    """
    if request.user.role != 'student':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = request.user.student_profile
    except Exception:
        return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    records = Attendance.objects.filter(student=student).select_related('class_section').order_by('-date')

    total   = records.count()
    present = records.filter(status='present').count()
    absent  = records.filter(status='absent').count()
    leave   = records.filter(status='leave').count()

    late_records             = records.filter(status='late')
    late_full, late_half, late_absent = _late_summary(late_records)
    late_total               = late_records.count()

    # Excused leave does not count against percentage
    total_counted = total - leave
    effective     = present + late_full + (late_half * 0.5)
    percentage    = round((effective / total_counted * 100), 1) if total_counted > 0 else 0

    return Response({
        'summary': {
            'total': total,
            'present': present,
            'absent': absent,
            'late': late_total,
            'late_full': late_full,
            'late_half': late_half,
            'late_absent': late_absent,
            'leave': leave,
            'percentage': percentage,
            'policy': 'Late ≤30 min = Present · Late 30–120 min = Half-day · Late >120 min = Absent · Leave excluded',
        },
        'records': AttendanceSerializer(records, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_attendance(request, student_id):
    """
    GET /api/attendance/student/<id>/
    Admin/Principal/Teacher/Parent views a specific student's attendance.
    """
    role = request.user.role

    try:
        student = Student.objects.get(pk=student_id)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Parent can only see their own child
    if role == 'parent':
        try:
            if student.parent != request.user.parent_profile:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    elif role not in ('super_admin', 'school_admin', 'principal', 'teacher'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    records = Attendance.objects.filter(student=student).select_related('class_section').order_by('-date')

    total   = records.count()
    present = records.filter(status='present').count()
    absent  = records.filter(status='absent').count()
    leave   = records.filter(status='leave').count()

    late_records             = records.filter(status='late')
    late_full, late_half, late_absent = _late_summary(late_records)
    late_total               = late_records.count()

    total_counted = total - leave
    effective     = present + late_full + (late_half * 0.5)
    percentage    = round((effective / total_counted * 100), 1) if total_counted > 0 else 0

    student_display = (
        ' '.join(filter(None, [student.first_name, student.middle_name, student.last_name]))
        or (student.user.get_full_name() or student.user.username if student.user else None)
        or student.admission_number
        or 'Unknown'
    )
    return Response({
        'student': student_display,
        'admission_number': student.admission_number,
        'summary': {
            'total': total,
            'present': present,
            'absent': absent,
            'late': late_total,
            'late_full': late_full,
            'late_half': late_half,
            'late_absent': late_absent,
            'leave': leave,
            'percentage': percentage,
            'policy': 'Late ≤30 min = Present · Late 30–120 min = Half-day · Late >120 min = Absent · Leave excluded',
        },
        'records': AttendanceSerializer(records, many=True).data,
    })


# ── Teacher Attendance ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsManagement])
def teacher_attendance_list(request):
    from teachers.models import Teacher
    from datetime import date as dt
    date_str = request.query_params.get('date') or str(dt.today())

    teachers = Teacher.objects.select_related('user').order_by('user__last_name', 'user__first_name')
    records  = {r.teacher_id: r for r in TeacherAttendance.objects.filter(date=date_str)}

    result = []
    for t in teachers:
        rec = records.get(t.id)
        result.append({
            'teacher_id':   t.id,
            'name':         t.user.get_full_name() or t.user.username,
            'designation':  t.designation or '',
            'employee_id':  t.employee_id or '',
            'status':       rec.status if rec else None,
            'arrival_time': str(rec.arrival_time)[:5] if rec and rec.arrival_time else None,
            'note':         rec.note if rec else '',
            'record_id':    rec.id if rec else None,
            'marked_by':    (rec.marked_by.get_full_name() or rec.marked_by.username) if rec and rec.marked_by else None,
        })

    total    = len(result)
    present  = sum(1 for r in result if r['status'] == 'present')
    absent   = sum(1 for r in result if r['status'] == 'absent')
    late     = sum(1 for r in result if r['status'] == 'late')
    on_leave = sum(1 for r in result if r['status'] == 'leave')
    unmarked = sum(1 for r in result if r['status'] is None)

    return Response({
        'date':    date_str,
        'summary': {'total': total, 'present': present, 'absent': absent,
                    'late': late, 'on_leave': on_leave, 'unmarked': unmarked},
        'teachers': result,
    })


@api_view(['POST'])
@permission_classes([IsManagement])
def teacher_attendance_mark(request):
    from teachers.models import Teacher
    date_str = request.data.get('date')
    records  = request.data.get('records', [])
    if not date_str:
        return Response({'error': 'date is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not records:
        return Response({'error': 'records list is required.'}, status=status.HTTP_400_BAD_REQUEST)

    saved = []
    with transaction.atomic():
        for rec in records:
            try:
                teacher = Teacher.objects.get(pk=rec['teacher_id'])
            except Teacher.DoesNotExist:
                continue
            obj, _ = TeacherAttendance.objects.update_or_create(
                teacher=teacher,
                date=date_str,
                defaults={
                    'status':       rec.get('status', 'absent'),
                    'arrival_time': rec.get('arrival_time') or None,
                    'note':         rec.get('note', ''),
                    'marked_by':    request.user,
                }
            )
            saved.append(obj.id)

    return Response({'saved': len(saved), 'date': date_str}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_teacher_attendance(request):
    if request.user.role != 'teacher':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = request.user.teacher_profile
    except Exception:
        return Response({'error': 'Teacher profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    month = request.query_params.get('month')
    qs = TeacherAttendance.objects.filter(teacher=teacher).order_by('-date')
    if month:
        try:
            year, mo = month.split('-')
            qs = qs.filter(date__year=int(year), date__month=int(mo))
        except Exception:
            pass

    total    = qs.count()
    present  = qs.filter(status='present').count()
    absent   = qs.filter(status='absent').count()
    late     = qs.filter(status='late').count()
    on_leave = qs.filter(status='leave').count()
    # Leave days are excused — exclude from denominator, same policy as students
    total_counted = total - on_leave
    pct      = round((present + late) / total_counted * 100, 1) if total_counted > 0 else 0

    records = [{'id': r.id, 'date': str(r.date), 'status': r.status,
                'arrival_time': str(r.arrival_time)[:5] if r.arrival_time else None,
                'note': r.note,
                'marked_by': (r.marked_by.get_full_name() or r.marked_by.username) if r.marked_by else None}
               for r in qs]

    return Response({'summary': {'total': total, 'present': present, 'absent': absent,
                                 'late': late, 'on_leave': on_leave, 'percentage': pct},
                     'records': records})


@api_view(['GET'])
@permission_classes([IsManagement])
def teacher_attendance_detail(request, teacher_id):
    from teachers.models import Teacher
    try:
        teacher = Teacher.objects.select_related('user').get(pk=teacher_id)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher not found.'}, status=status.HTTP_404_NOT_FOUND)

    month = request.query_params.get('month')
    qs = TeacherAttendance.objects.filter(teacher=teacher).order_by('-date')
    if month:
        try:
            year, mo = month.split('-')
            qs = qs.filter(date__year=int(year), date__month=int(mo))
        except Exception:
            pass

    total    = qs.count()
    present  = qs.filter(status='present').count()
    absent   = qs.filter(status='absent').count()
    late     = qs.filter(status='late').count()
    on_leave = qs.filter(status='leave').count()
    total_counted = total - on_leave
    pct      = round((present + late) / total_counted * 100, 1) if total_counted > 0 else 0

    records = [{'id': r.id, 'date': str(r.date), 'status': r.status,
                'arrival_time': str(r.arrival_time)[:5] if r.arrival_time else None,
                'note': r.note,
                'marked_by': (r.marked_by.get_full_name() or r.marked_by.username) if r.marked_by else None}
               for r in qs]

    return Response({'teacher': teacher.user.get_full_name() or teacher.user.username,
                     'employee_id': teacher.employee_id or '',
                     'designation': teacher.designation or '',
                     'summary': {'total': total, 'present': present, 'absent': absent,
                                 'late': late, 'on_leave': on_leave, 'percentage': pct},
                     'records': records})
