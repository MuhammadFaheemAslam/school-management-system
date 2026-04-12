from datetime import date, timedelta

from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Notification
from .serializers import NotificationSerializer


MANAGEMENT = ('super_admin', 'school_admin', 'principal')


def _bulk_notify(users, title, message, notif_type, send_email=True):
    """Create DB notifications and optionally email each user."""
    created = 0
    for user in users:
        Notification.objects.create(
            recipient=user, title=title, message=message, notif_type=notif_type
        )
        if send_email and user.email:
            try:
                send_mail(
                    subject=title,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:
                pass
        created += 1
    return created


# ── My notifications ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_notifications(request):
    qs = Notification.objects.filter(recipient=request.user)[:30]
    unread = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({
        'unread': unread,
        'notifications': NotificationSerializer(qs, many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'ok'})


# ── Send triggers (management only) ──────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_fee_reminders(request):
    """
    Notify students whose fees are overdue or due within `days` days (default 7).
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from fees.models import FeeVoucher
    days = int(request.data.get('days', 7))
    today_date = date.today()
    deadline = today_date + timedelta(days=days)

    vouchers = list(
        FeeVoucher.objects.select_related('student__user')
        .prefetch_related('line_items')
        .filter(due_date__lte=deadline)
    )
    sent = 0

    for v in vouchers:
        vstatus = v.status
        user = v.student.user
        period = v.month or (str(v.year) if v.year else v.voucher_number)

        if vstatus == 'overdue':
            title = f"OVERDUE: Fee voucher {v.voucher_number}"
            msg = (
                f"Dear {user.get_full_name() or user.username},\n\n"
                f"Your fee voucher '{v.voucher_number}' (Period: {period}) of PKR {v.total_amount:.2f} "
                f"was due on {v.due_date} and remains unpaid "
                f"(Balance: PKR {v.balance:.2f}).\n\n"
                f"Please clear your dues immediately.\n\nSchool Management"
            )
            sent += _bulk_notify([user], title, msg, 'fee_reminder')

        elif vstatus in ('pending', 'partial') and v.due_date >= today_date:
            title = f"Fee Due Soon: Voucher {v.voucher_number}"
            msg = (
                f"Dear {user.get_full_name() or user.username},\n\n"
                f"Your fee voucher '{v.voucher_number}' (Period: {period}) of PKR {v.total_amount:.2f} "
                f"is due on {v.due_date}.\n"
                f"Amount paid so far: PKR {float(v.amount_paid):.2f}. "
                f"Balance: PKR {v.balance:.2f}.\n\n"
                f"Please arrange payment before the due date.\n\nSchool Management"
            )
            sent += _bulk_notify([user], title, msg, 'fee_reminder')

    return Response({'sent': sent, 'message': f'{sent} fee reminder(s) sent.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_exam_alerts(request):
    """
    Notify students about exams scheduled in the next `days` days (default 7).
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from exams.models import Exam
    from students.models import Student

    days = int(request.data.get('days', 7))
    deadline = date.today() + timedelta(days=days)

    upcoming = Exam.objects.filter(
        date__gte=date.today(), date__lte=deadline
    ).select_related('class_section', 'subject')

    sent = 0
    for exam in upcoming:
        students = Student.objects.filter(
            class_section=exam.class_section, is_active=True
        ).select_related('user')
        users = [s.user for s in students]
        title = f"Upcoming Exam: {exam.name}"
        msg = (
            f"This is a reminder that you have an upcoming exam:\n\n"
            f"Exam:    {exam.name}\n"
            f"Subject: {exam.subject.name}\n"
            f"Date:    {exam.date}\n"
            f"Total Marks:   {exam.total_marks}\n"
            f"Passing Marks: {exam.passing_marks}\n\n"
            f"Best of luck!\n\nSchool Management"
        )
        sent += _bulk_notify(users, title, msg, 'exam_alert')

    return Response({'sent': sent, 'message': f'{sent} exam alert(s) sent.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_attendance_warnings(request):
    """
    Warn students whose attendance is below `threshold` % (default 75).
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from attendance.models import Attendance
    from students.models import Student
    from django.db.models import Count, Q

    threshold = int(request.data.get('threshold', 75))

    students = Student.objects.filter(is_active=True).select_related('user')
    sent = 0
    for student in students:
        total = Attendance.objects.filter(student=student).count()
        if total == 0:
            continue
        present = Attendance.objects.filter(student=student, status='present').count()
        pct = round((present / total) * 100, 1)
        if pct < threshold:
            user = student.user
            title = f"Low Attendance Warning – {pct}%"
            msg = (
                f"Dear {user.get_full_name() or user.username},\n\n"
                f"Your current attendance is {pct}% ({present}/{total} classes), "
                f"which is below the required {threshold}%.\n\n"
                f"Please improve your attendance to avoid academic consequences.\n\n"
                f"School Management"
            )
            sent += _bulk_notify([user], title, msg, 'attendance_warning')

    return Response({'sent': sent, 'message': f'{sent} attendance warning(s) sent.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_general(request):
    """
    Send a custom notification to all students, all teachers, or everyone.
    Body: { target: 'all'|'students'|'teachers', title, message }
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from django.contrib.auth import get_user_model
    User = get_user_model()

    target  = request.data.get('target', 'all')
    title   = request.data.get('title', '').strip()
    message = request.data.get('message', '').strip()

    if not title or not message:
        return Response({'error': 'title and message are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if target == 'students':
        users = User.objects.filter(role='student', is_active=True)
    elif target == 'teachers':
        users = User.objects.filter(role='teacher', is_active=True)
    else:
        users = User.objects.filter(is_active=True).exclude(is_superuser=True)

    sent = _bulk_notify(list(users), title, message, 'general')
    return Response({'sent': sent, 'message': f'{sent} notification(s) sent.'})
