from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsManagement, IsManagementOrTeacher, IsAcademicOrTeacher
from students.models import Student
from .models import Exam, Result
from .serializers import BulkResultSerializer, ExamSerializer, ResultSerializer


# ── Exams ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_list(request):
    role = request.user.role
    exams = Exam.objects.select_related('class_section', 'subject', 'created_by').all()

    section = request.query_params.get('section')
    subject = request.query_params.get('subject')
    if section: exams = exams.filter(class_section_id=section)
    if subject: exams = exams.filter(subject_id=subject)

    if role == 'teacher':
        try:
            teacher_sections = request.user.teacher_profile.class_teacher_of.values_list('id', flat=True)
            exams = exams.filter(class_section_id__in=teacher_sections)
        except Exception:
            return Response([], status=status.HTTP_200_OK)

    elif role == 'student':
        try:
            exams = exams.filter(class_section=request.user.student_profile.class_section)
        except Exception:
            return Response([], status=status.HTTP_200_OK)

    elif role == 'parent':
        try:
            children_sections = request.user.parent_profile.children.values_list('class_section_id', flat=True)
            exams = exams.filter(class_section_id__in=children_sections)
        except Exception:
            return Response([], status=status.HTTP_200_OK)

    return Response(ExamSerializer(exams, many=True).data)


@api_view(['POST'])
@permission_classes([IsAcademicOrTeacher])
def exam_create(request):
    serializer = ExamSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    exam = serializer.save(created_by=request.user)
    return Response(ExamSerializer(exam).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def exam_detail(request, pk):
    try:
        exam = Exam.objects.get(pk=pk)
    except Exam.DoesNotExist:
        return Response({'error': 'Exam not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ExamSerializer(exam).data)

    if not (request.user.is_superuser or request.user.role in ('super_admin', 'school_admin', 'principal', 'teacher')):
        return Response({'error': 'Only Principal or Teacher can edit exams.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        serializer = ExamSerializer(exam, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    exam.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Results ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAcademicOrTeacher])
def enter_marks(request):
    """
    POST /api/exams/marks/
    Bulk enter or update marks for all students in an exam.
    """
    serializer = BulkResultSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data    = serializer.validated_data
    exam_id = data['exam']
    records = data['results']

    try:
        exam = Exam.objects.get(pk=exam_id)
    except Exam.DoesNotExist:
        return Response({'error': 'Exam not found.'}, status=status.HTTP_404_NOT_FOUND)

    saved = []
    with transaction.atomic():
        for record in records:
            try:
                student = Student.objects.get(pk=record['student'])
            except Student.DoesNotExist:
                continue
            marks = float(record['marks_obtained'])
            if marks > exam.total_marks:
                continue  # silently skip invalid marks
            obj, _ = Result.objects.update_or_create(
                exam=exam, student=student,
                defaults={
                    'marks_obtained': marks,
                    'remarks': record.get('remarks', ''),
                    'entered_by': request.user,
                }
            )
            saved.append(obj)

    return Response(ResultSerializer(saved, many=True).data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_results(request, exam_id):
    """
    GET /api/exams/<id>/results/
    View all results for an exam with class summary stats.
    """
    try:
        exam = Exam.objects.get(pk=exam_id)
    except Exam.DoesNotExist:
        return Response({'error': 'Exam not found.'}, status=status.HTTP_404_NOT_FOUND)

    role = request.user.role
    if role == 'student':
        # Student only sees their own result
        try:
            result = Result.objects.get(exam=exam, student=request.user.student_profile)
            return Response({'exam': ExamSerializer(exam).data, 'results': [ResultSerializer(result).data]})
        except Result.DoesNotExist:
            return Response({'exam': ExamSerializer(exam).data, 'results': []})

    if role not in ('super_admin', 'school_admin', 'principal', 'teacher'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    results = Result.objects.filter(exam=exam).select_related('student__user', 'entered_by')

    # Class summary
    total_students = results.count()
    passed = sum(1 for r in results if r.passed)
    avg = round(sum(float(r.marks_obtained) for r in results) / total_students, 1) if total_students else 0
    highest = max((float(r.marks_obtained) for r in results), default=0)
    lowest  = min((float(r.marks_obtained) for r in results), default=0)

    return Response({
        'exam': ExamSerializer(exam).data,
        'summary': {
            'total_students': total_students,
            'passed': passed,
            'failed': total_students - passed,
            'pass_rate': round(passed / total_students * 100, 1) if total_students else 0,
            'average': avg,
            'highest': highest,
            'lowest': lowest,
        },
        'results': ResultSerializer(results, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_results(request):
    """
    GET /api/exams/my-results/
    Student views all their own results across all exams.
    """
    if request.user.role != 'student':
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        student = request.user.student_profile
    except Exception:
        return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    results = Result.objects.filter(student=student).select_related('exam__subject', 'exam__class_section').order_by('-exam__date')
    return Response(ResultSerializer(results, many=True).data)
