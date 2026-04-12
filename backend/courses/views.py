from django.db.models import Count, ProtectedError, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsManagement, IsManagementOrTeacher
from .models import AcademicSession, ClassSection, Course, SchoolSettings, Subject
from .serializers import AcademicSessionSerializer, ClassSectionSerializer, CourseSerializer, SchoolSettingsSerializer, SubjectSerializer


# ── School Settings ───────────────────────────────────────────────────────────

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def school_settings(request):
    """
    GET  /api/courses/school-settings/  — retrieve school-wide timings
    PUT  /api/courses/school-settings/  — update (school_admin, principal, super_admin only)
    """
    obj = SchoolSettings.get()

    if request.method == 'GET':
        return Response(SchoolSettingsSerializer(obj).data)

    if not IsManagement().has_permission(request, None):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = SchoolSettingsSerializer(obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsManagement])
def school_settings_apply_all(request):
    """
    POST /api/courses/school-settings/apply-all/
    Copies school-wide timings to every section (overwriting per-section values).
    school_admin / principal / super_admin only.
    """

    obj = SchoolSettings.get()
    ClassSection.objects.all().update(
        school_start_time=obj.school_start_time,
        school_end_time=obj.school_end_time,
        break_start_time=obj.break_start_time,
        break_end_time=obj.break_end_time,
    )
    count = ClassSection.objects.count()
    return Response({'detail': f'Timings applied to {count} section(s).'})


# ── Academic Sessions ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def session_list(request):
    sessions = AcademicSession.objects.annotate(
        section_count=Count('sections', distinct=True),
        student_count=Count(
            'sections__enrollments',
            filter=Q(sections__enrollments__is_active=True),
            distinct=True,
        ),
    )
    return Response(AcademicSessionSerializer(sessions, many=True).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def session_create(request):
    serializer = AcademicSessionSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def session_detail(request, pk):
    try:
        session = AcademicSession.objects.get(pk=pk)
    except AcademicSession.DoesNotExist:
        return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(AcademicSessionSerializer(session).data)

    if not IsManagement().has_permission(request, None):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = AcademicSessionSerializer(session, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        session.delete()
    except ProtectedError:
        return Response(
            {'error': 'Cannot delete this session — it has classes or student enrollments linked to it. Remove them first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsManagement])
def session_activate(request, pk):
    """Set this session as the active one (deactivates all others)."""
    try:
        session = AcademicSession.objects.get(pk=pk)
    except AcademicSession.DoesNotExist:
        return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)
    session.is_active = True
    session.save()   # model.save() handles deactivating others
    return Response(AcademicSessionSerializer(session).data)


# ── Courses / Classes ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def course_list(request):
    courses = Course.objects.annotate(section_count=Count('sections', distinct=True))
    return Response(CourseSerializer(courses, many=True).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def course_create(request):
    serializer = CourseSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def course_detail(request, pk):
    try:
        course = Course.objects.get(pk=pk)
    except Course.DoesNotExist:
        return Response({'error': 'Course not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(CourseSerializer(course).data)

    if not IsManagement().has_permission(request, None):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = CourseSerializer(course, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        course.delete()
    except ProtectedError:
        student_count = course.enrollments.count()
        return Response(
            {'error': f'Cannot delete this class because {student_count} student enrollment(s) are linked to it. Remove or transfer the students first.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Subjects ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def subject_list(request):
    course_id = request.query_params.get('course')
    subjects = Subject.objects.all()
    if course_id:
        subjects = subjects.filter(course_id=course_id)
    return Response(SubjectSerializer(subjects, many=True).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def subject_create(request):
    serializer = SubjectSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def subject_detail(request, pk):
    try:
        subject = Subject.objects.get(pk=pk)
    except Subject.DoesNotExist:
        return Response({'error': 'Subject not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(SubjectSerializer(subject).data)

    if not IsManagement().has_permission(request, None):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = SubjectSerializer(subject, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    subject.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Class Sections ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def section_list(request):
    qs = ClassSection.objects.select_related('course', 'session', 'class_teacher__user').annotate(
        student_count=Count('enrollments', filter=Q(enrollments__is_active=True), distinct=True)
    )
    course_id  = request.query_params.get('course')
    session_id = request.query_params.get('session')
    if course_id:
        qs = qs.filter(course_id=course_id)
    if session_id:
        qs = qs.filter(session_id=session_id)
    return Response(ClassSectionSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsManagement])
def section_create(request):
    serializer = ClassSectionSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def section_detail(request, pk):
    try:
        section = ClassSection.objects.get(pk=pk)
    except ClassSection.DoesNotExist:
        return Response({'error': 'Section not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ClassSectionSerializer(section).data)

    if not IsManagement().has_permission(request, None):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = ClassSectionSerializer(section, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        section.delete()
    except ProtectedError:
        student_count = section.enrollments.count()
        return Response(
            {'error': f'Cannot delete this section because {student_count} student enrollment(s) are linked to it. Remove or transfer the students first.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    return Response(status=status.HTTP_204_NO_CONTENT)
