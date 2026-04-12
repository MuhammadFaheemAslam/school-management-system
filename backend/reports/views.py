import csv
from datetime import date

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .pdf_utils import build_pdf

MANAGEMENT = ('super_admin', 'school_admin', 'principal')


def _csv_response(filename, headers, rows):
    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(resp)
    writer.writerow(headers)
    writer.writerows(rows)
    return resp


def _pdf_response(filename, title, subtitle, headers, rows, col_widths=None, landscape_mode=False):
    pdf_bytes = build_pdf(title, subtitle, headers, rows, col_widths, landscape_mode)
    resp = HttpResponse(pdf_bytes, content_type='application/pdf')
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    return resp


# ── Attendance Report ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_report(request):
    """
    Query params: section (required), date_from, date_to, fmt (csv|pdf)
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from attendance.models import Attendance
    from courses.models import ClassSection

    section_id = request.query_params.get('section')
    date_from  = request.query_params.get('date_from')
    date_to    = request.query_params.get('date_to')
    fmt        = request.query_params.get('fmt', 'csv')

    if not section_id:
        return Response({'error': 'section is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        section = ClassSection.objects.select_related('course').get(pk=section_id)
    except ClassSection.DoesNotExist:
        return Response({'error': 'Section not found.'}, status=status.HTTP_404_NOT_FOUND)

    qs = Attendance.objects.filter(class_section=section).select_related('student__user').order_by('date', 'student__user__last_name')
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)

    headers = ['#', 'Student Name', 'Admission No.', 'Date', 'Status', 'Note']
    rows = [
        [i + 1, att.student.user.get_full_name() or att.student.user.username,
         att.student.admission_number, str(att.date), att.status.capitalize(), att.note or '']
        for i, att in enumerate(qs)
    ]

    session_label = section.session.name if section.session else ''
    subtitle = f"Section: {section.course.name} – {section.name} ({session_label})"
    if date_from or date_to:
        subtitle += f" | Period: {date_from or '—'} to {date_to or str(date.today())}"

    if fmt == 'pdf':
        return _pdf_response(
            f"attendance_{section.name}.pdf",
            "Attendance Report", subtitle, headers, rows,
            col_widths=[1, 5, 3, 2.5, 2, 4], landscape_mode=False
        )
    return _csv_response(f"attendance_{section.name}.csv", headers, rows)


# ── Exam Results Report ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def results_report(request):
    """
    Query params: exam (required), fmt (csv|pdf)
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from exams.models import Exam, Result

    exam_id = request.query_params.get('exam')
    fmt     = request.query_params.get('fmt', 'csv')

    if not exam_id:
        return Response({'error': 'exam is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        exam = Exam.objects.select_related('class_section', 'subject').get(pk=exam_id)
    except Exam.DoesNotExist:
        return Response({'error': 'Exam not found.'}, status=status.HTTP_404_NOT_FOUND)

    results = Result.objects.filter(exam=exam).select_related('student__user').order_by('student__user__last_name')

    headers = ['#', 'Student Name', 'Adm. No.', f'Marks / {exam.total_marks}', '%', 'Grade', 'Status', 'Remarks']
    rows = [
        [i + 1,
         r.student.user.get_full_name() or r.student.user.username,
         r.student.admission_number,
         str(r.marks_obtained),
         f"{r.percentage}%",
         r.grade,
         'Pass' if r.passed else 'Fail',
         r.remarks or '']
        for i, r in enumerate(results)
    ]

    subtitle = (
        f"Exam: {exam.name} | Subject: {exam.subject.name} | "
        f"Section: {exam.class_section.name} | Date: {exam.date} | "
        f"Total: {exam.total_marks} | Pass: {exam.passing_marks}"
    )

    if fmt == 'pdf':
        return _pdf_response(
            f"results_{exam.name.replace(' ', '_')}.pdf",
            "Exam Results Report", subtitle, headers, rows,
            col_widths=[1, 4.5, 2.5, 2.5, 1.5, 1.5, 1.5, 3.5], landscape_mode=True
        )
    return _csv_response(f"results_{exam.name.replace(' ', '_')}.csv", headers, rows)


# ── Fee Collection Report ─────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fees_report(request):
    """
    Query params: section (optional), year (optional), fmt (csv|pdf)
    """
    if not (request.user.is_superuser or request.user.role in MANAGEMENT):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from fees.models import FeeVoucher

    section_id = request.query_params.get('section')
    fmt        = request.query_params.get('fmt', 'csv')

    qs = FeeVoucher.objects.select_related('student__user').prefetch_related(
        'line_items', 'payments',
        'student__enrollments__course',
        'student__enrollments__class_section',
    ).order_by('student__user__last_name')

    if section_id:
        qs = qs.filter(
            student__enrollments__class_section_id=section_id,
            student__enrollments__is_active=True,
        ).distinct()

    def _section_label(student):
        enr = next((e for e in student.enrollments.all() if e.is_active), None)
        if not enr:
            return ''
        name = enr.course.name if enr.course else ''
        if enr.class_section:
            name += f' \u2013 {enr.class_section.name}'
        return name

    vouchers = list(qs)
    headers = ['#', 'Student Name', 'Adm. No.', 'Section', 'Voucher No.', 'Type',
               'Month/Period', 'Due Date', 'Total Amount', 'Amount Paid', 'Balance', 'Status']
    rows = [
        [i + 1,
         v.student.user.get_full_name() or v.student.user.username,
         v.student.admission_number,
         _section_label(v.student),
         v.voucher_number,
         v.voucher_type.capitalize(),
         v.month or (str(v.year) if v.year else ''),
         str(v.due_date),
         f"{v.total_amount:.2f}",
         f"{float(v.amount_paid):.2f}",
         f"{v.balance:.2f}",
         v.status.capitalize()]
        for i, v in enumerate(vouchers)
    ]

    subtitle = "Fee Voucher Report"

    total_due  = sum(v.total_amount for v in vouchers)
    total_paid = sum(float(v.amount_paid) for v in vouchers)
    rows.append(['', '', '', '', '', '', '', 'TOTAL', f"{total_due:.2f}", f"{total_paid:.2f}",
                 f"{total_due - total_paid:.2f}", ''])

    if fmt == 'pdf':
        return _pdf_response(
            "fees_report.pdf",
            "Fee Collection Report", subtitle, headers, rows,
            col_widths=[0.8, 4, 2, 3, 3.5, 2, 2, 2, 2, 2, 2], landscape_mode=True
        )
    return _csv_response("fees_report.csv", headers, rows)


# ── Student Report Card ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_report_card(request):
    """
    Single student full report: attendance + results + fees.
    Query params: student (required for management), fmt (pdf|csv)
    Students can access their own card without the student param.
    """
    from students.models import Student
    from attendance.models import Attendance
    from exams.models import Result
    from fees.models import FeeVoucher

    role = request.user.role

    if role == 'student':
        try:
            student = request.user.student_profile
        except Exception:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    elif role in MANAGEMENT:
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'student param required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = Student.objects.select_related('user', 'class_section__course').get(pk=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    fmt = request.query_params.get('fmt', 'pdf')

    name    = student.user.get_full_name() or student.user.username
    section = f"{student.class_section.course.name} – {student.class_section.name}"

    # Attendance
    att_qs   = Attendance.objects.filter(student=student).order_by('date')
    total    = att_qs.count()
    present  = att_qs.filter(status='present').count()
    absent   = att_qs.filter(status='absent').count()
    late     = att_qs.filter(status='late').count()
    att_pct  = round((present / total * 100), 1) if total else 0

    # Results
    results = Result.objects.filter(student=student).select_related('exam__subject').order_by('-exam__date')

    # Fees
    student_vouchers = list(FeeVoucher.objects.filter(student=student).prefetch_related('line_items'))
    fee_due  = sum(v.total_amount for v in student_vouchers)
    fee_paid = sum(float(v.amount_paid) for v in student_vouchers)

    if fmt == 'csv':
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = f'attachment; filename="report_card_{student.admission_number}.csv"'
        w = csv.writer(resp)
        w.writerow(['STUDENT REPORT CARD'])
        w.writerow(['Name', name, 'Admission No.', student.admission_number])
        w.writerow(['Section', section])
        w.writerow([])
        w.writerow(['ATTENDANCE SUMMARY'])
        w.writerow(['Total Classes', 'Present', 'Absent', 'Late', 'Attendance %'])
        w.writerow([total, present, absent, late, f"{att_pct}%"])
        w.writerow([])
        w.writerow(['EXAM RESULTS'])
        w.writerow(['Exam', 'Subject', 'Date', 'Marks Obtained', 'Total Marks', '%', 'Grade', 'Status'])
        for r in results:
            w.writerow([r.exam.name, r.exam.subject.name, str(r.exam.date),
                        r.marks_obtained, r.exam.total_marks, f"{r.percentage}%",
                        r.grade, 'Pass' if r.passed else 'Fail'])
        w.writerow([])
        w.writerow(['FEE SUMMARY'])
        w.writerow(['Voucher No.', 'Type', 'Period', 'Due Date', 'Total Amount', 'Amount Paid', 'Balance', 'Status'])
        for v in student_vouchers:
            w.writerow([v.voucher_number, v.voucher_type.capitalize(),
                        v.month or (str(v.year) if v.year else ''),
                        str(v.due_date), f"{v.total_amount:.2f}", f"{float(v.amount_paid):.2f}",
                        f"{v.balance:.2f}", v.status.capitalize()])
        w.writerow(['', '', '', 'TOTAL', f"{fee_due:.2f}", f"{fee_paid:.2f}", f"{fee_due - fee_paid:.2f}", ''])
        return resp

    # PDF report card
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from .pdf_utils import PRIMARY, ACCENT, GREEN, RED, LIGHT_BG, HEADER_BG

    buf  = BytesIO()
    doc  = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                             topMargin=2*cm, bottomMargin=2*cm)
    ss   = getSampleStyleSheet()
    elems = []

    h1  = ParagraphStyle('h1',  parent=ss['Title'],  textColor=PRIMARY, fontSize=18, spaceAfter=2)
    h2  = ParagraphStyle('h2',  parent=ss['Heading2'], textColor=ACCENT, fontSize=11, spaceBefore=14, spaceAfter=4)
    sub = ParagraphStyle('sub', parent=ss['Normal'], textColor=colors.HexColor('#718096'), fontSize=9, spaceAfter=10)
    bod = ParagraphStyle('bod', parent=ss['Normal'], fontSize=9)

    # Header
    elems += [
        Paragraph("Student Report Card", h1),
        Paragraph(f"<b>{name}</b> &nbsp;·&nbsp; Adm# {student.admission_number} &nbsp;·&nbsp; {section}", sub),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')),
    ]

    # Attendance summary
    elems.append(Paragraph("Attendance Summary", h2))
    att_table = Table(
        [['Total Classes', 'Present', 'Absent', 'Late', 'Attendance %'],
         [total, present, absent, late, f"{att_pct}%"]],
        colWidths=[3.4*cm]*5
    )
    att_table.setStyle(TableStyle([
        ('BACKGROUND',  (0, 0), (-1, 0), HEADER_BG),
        ('TEXTCOLOR',   (0, 0), (-1, 0), ACCENT),
        ('FONTNAME',    (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',    (0, 0), (-1, -1), 9),
        ('GRID',        (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN',       (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING',  (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TEXTCOLOR',   (4, 1), (4, 1), GREEN if att_pct >= 75 else RED),
        ('FONTNAME',    (4, 1), (4, 1), 'Helvetica-Bold'),
    ]))
    elems.append(att_table)

    # Exam results
    elems.append(Paragraph("Exam Results", h2))
    if results:
        r_headers = ['Exam', 'Subject', 'Date', 'Marks', '%', 'Grade', 'Status']
        r_rows = [
            [r.exam.name, r.exam.subject.name, str(r.exam.date),
             f"{r.marks_obtained}/{r.exam.total_marks}", f"{r.percentage}%",
             r.grade, 'Pass' if r.passed else 'Fail']
            for r in results
        ]
        r_tbl = Table([r_headers] + r_rows, colWidths=[5*cm, 3.5*cm, 2*cm, 2*cm, 1.5*cm, 1.5*cm, 1.5*cm], repeatRows=1)
        r_tbl.setStyle(TableStyle([
            ('BACKGROUND',  (0, 0), (-1, 0), HEADER_BG),
            ('TEXTCOLOR',   (0, 0), (-1, 0), ACCENT),
            ('FONTNAME',    (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME',    (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE',    (0, 0), (-1, -1), 8),
            ('GRID',        (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
            ('TOPPADDING',  (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elems.append(r_tbl)
    else:
        elems.append(Paragraph("No exam results recorded.", bod))

    # Fees
    elems.append(Paragraph("Fee Summary", h2))
    if student_vouchers:
        f_headers = ['Voucher No.', 'Type', 'Period', 'Due Date', 'Total', 'Paid', 'Balance', 'Status']
        f_rows = [
            [v.voucher_number, v.voucher_type.capitalize(),
             v.month or (str(v.year) if v.year else ''),
             str(v.due_date),
             f"PKR {v.total_amount:.2f}", f"PKR {float(v.amount_paid):.2f}",
             f"PKR {v.balance:.2f}", v.status.capitalize()]
            for v in student_vouchers
        ]
        f_rows.append(['', '', '', 'TOTAL', f"PKR {fee_due:.2f}", f"PKR {fee_paid:.2f}", f"PKR {fee_due - fee_paid:.2f}", ''])
        f_tbl = Table([f_headers] + f_rows, colWidths=[3*cm, 1.5*cm, 2*cm, 2.2*cm, 2.2*cm, 2.2*cm, 2.2*cm, 2*cm], repeatRows=1)
        f_tbl.setStyle(TableStyle([
            ('BACKGROUND',  (0, 0), (-1, 0), HEADER_BG),
            ('TEXTCOLOR',   (0, 0), (-1, 0), ACCENT),
            ('FONTNAME',    (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME',    (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE',    (0, 0), (-1, -1), 8),
            ('GRID',        (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, LIGHT_BG]),
            ('BACKGROUND',  (0, -1), (-1, -1), colors.HexColor('#f0fff4')),
            ('FONTNAME',    (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('TOPPADDING',  (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elems.append(f_tbl)
    else:
        elems.append(Paragraph("No fee vouchers recorded.", bod))

    doc.build(elems)
    resp = HttpResponse(buf.getvalue(), content_type='application/pdf')
    resp['Content-Disposition'] = f'attachment; filename="report_card_{student.admission_number}.pdf"'
    return resp


# ── Available filters helper ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_filters(request):
    """Returns sections, exams and academic years for populating dropdowns."""
    if not (request.user.is_superuser or request.user.role in (*MANAGEMENT, 'student')):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    from courses.models import ClassSection
    from exams.models import Exam
    sections = [
        {'id': s.id, 'label': f"{s.course.name} – {s.name} ({s.session.name if s.session else ''})"}
        for s in ClassSection.objects.select_related('course', 'session').all()
    ]
    exams = [
        {'id': e.id, 'label': f"{e.name} – {e.class_section.name} ({e.date})"}
        for e in Exam.objects.select_related('class_section').order_by('-date')
    ]

    return Response({'sections': sections, 'exams': exams})
