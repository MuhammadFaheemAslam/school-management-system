"""
Fee voucher helper functions.
Imported by views and the students app to auto-generate vouchers on enrollment.
"""
from datetime import date


def generate_admission_voucher(student, fee_package, created_by=None):
    """
    Creates an Admission FeeVoucher with line items:
    - Admission / Registration Fee (one-time)
    - Annual Fee  = books_fee + exam_fee  (one-time)
    - First Month Tuition Fee
    - Transport Fee  (if transport_fee > 0)
    Returns the created FeeVoucher or None if no fees to charge.
    """
    from .models import FeeVoucher, VoucherLineItem, generate_voucher_number

    lines = []
    if float(fee_package.registration_fee) > 0:
        lines.append(('Admission / Registration Fee', float(fee_package.registration_fee)))
    annual = float(fee_package.books_fee) + float(fee_package.exam_fee)
    if annual > 0:
        lines.append(('Annual Fee (Books + Exam)', annual))
    if float(fee_package.tuition_fee) > 0:
        lines.append(('First Month Tuition Fee', float(fee_package.tuition_fee)))
    if float(fee_package.transport_fee) > 0:
        lines.append(('Transport Fee', float(fee_package.transport_fee)))

    if not lines:
        return None

    today = date.today()
    voucher_number = generate_voucher_number('admission')
    voucher = FeeVoucher.objects.create(
        voucher_number = voucher_number,
        student        = student,
        fee_package    = fee_package,
        voucher_type   = 'admission',
        due_date       = today,
        created_by     = created_by,
    )
    for label, amount in lines:
        VoucherLineItem.objects.create(voucher=voucher, label=label, amount=amount)

    return voucher


def generate_monthly_vouchers(month, section_id=None, created_by=None):
    """
    Creates Monthly FeeVouchers for all active students with fee packages.
    Calculates arrears from previous unpaid admission + monthly vouchers.
    Returns (created_count, skipped_count).
    """
    from .models import EnrollmentFeePackage, FeeVoucher, VoucherLineItem, generate_voucher_number
    from datetime import date

    try:
        year_str, mon_str = month.split('-')
        year, mon = int(year_str), int(mon_str)
    except (ValueError, AttributeError):
        raise ValueError(f'Invalid month format: {month}')

    due_date = date(year, mon, 10)

    qs = EnrollmentFeePackage.objects.select_related(
        'student'
    ).prefetch_related(
        'student__enrollments__class_section'
    ).filter(student__is_active=True)

    if section_id:
        qs = qs.filter(
            student__enrollments__class_section_id=section_id,
            student__enrollments__is_active=True,
        )

    created = 0
    skipped = 0

    for pkg in qs.distinct():
        monthly = pkg.total_monthly
        if monthly <= 0:
            skipped += 1
            continue

        # Skip if voucher already exists for this student + month
        if FeeVoucher.objects.filter(student=pkg.student, voucher_type='monthly', month=month).exists():
            skipped += 1
            continue

        # Calculate arrears: sum of OWN unpaid line items from previous vouchers.
        # We use own_line_balance (line_items_total - amount_paid) instead of v.balance
        # to avoid double-counting — each month's arrears already carried forward to next.
        prev_vouchers = FeeVoucher.objects.filter(
            student=pkg.student,
        ).exclude(voucher_type='annual').prefetch_related('line_items', 'payments')

        arrears = 0
        for v in prev_vouchers:
            is_prev_monthly = v.voucher_type == 'monthly' and v.month and v.month < month
            is_unpaid_admission = v.voucher_type == 'admission' and v.status != 'paid'
            if not (is_prev_monthly or is_unpaid_admission):
                continue
            # own line items total (excludes any arrears already on that voucher)
            own_total = sum(float(item.amount) for item in v.line_items.all())
            own_unpaid = max(0, own_total - float(v.amount_paid))
            arrears += own_unpaid
        arrears = round(arrears, 2)

        voucher_number = generate_voucher_number('monthly', month=month)
        voucher = FeeVoucher.objects.create(
            voucher_number = voucher_number,
            student        = pkg.student,
            fee_package    = pkg,
            voucher_type   = 'monthly',
            month          = month,
            due_date       = due_date,
            arrears        = arrears,
            created_by     = created_by,
        )

        if float(pkg.tuition_fee) > 0:
            VoucherLineItem.objects.create(voucher=voucher, label='Tuition Fee', amount=pkg.tuition_fee)
        if float(pkg.transport_fee) > 0:
            VoucherLineItem.objects.create(voucher=voucher, label='Transport Fee', amount=pkg.transport_fee)

        created += 1

    return created, skipped


def generate_annual_voucher(student, fee_package, year, created_by=None):
    """
    Creates an Annual FeeVoucher for books + exam fees.
    Returns the voucher or None if already exists or no annual fees.
    """
    from .models import FeeVoucher, VoucherLineItem, generate_voucher_number

    annual = float(fee_package.books_fee) + float(fee_package.exam_fee)
    if annual <= 0:
        return None

    if FeeVoucher.objects.filter(student=student, voucher_type='annual', year=year).exists():
        return None

    due_date = date(year, 1, 31)
    voucher_number = generate_voucher_number('annual', year=year)
    voucher = FeeVoucher.objects.create(
        voucher_number = voucher_number,
        student        = student,
        fee_package    = fee_package,
        voucher_type   = 'annual',
        year           = year,
        due_date       = due_date,
        created_by     = created_by,
    )
    if float(fee_package.books_fee) > 0:
        VoucherLineItem.objects.create(voucher=voucher, label='Books Fee', amount=fee_package.books_fee)
    if float(fee_package.exam_fee) > 0:
        VoucherLineItem.objects.create(voucher=voucher, label='Exam Fee', amount=fee_package.exam_fee)

    return voucher
