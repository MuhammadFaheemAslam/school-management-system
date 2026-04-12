from django.contrib import admin

from .models import (
    ClassFeeStructure, EnrollmentFeePackage, FeeRevisionLog,
    FeeVoucher, VoucherLineItem, VoucherPayment, AutoGenerateLog,
)


class VoucherLineItemInline(admin.TabularInline):
    model  = VoucherLineItem
    extra  = 0
    fields = ('label', 'amount')


class VoucherPaymentInline(admin.TabularInline):
    model           = VoucherPayment
    extra           = 0
    fields          = ('amount', 'payment_date', 'payment_method', 'transaction_id', 'received_by', 'note')
    readonly_fields = ('payment_date',)


@admin.register(ClassFeeStructure)
class ClassFeeStructureAdmin(admin.ModelAdmin):
    list_display  = ('course', 'session', 'tuition_fee', 'transport_fee', 'registration_fee')
    list_filter   = ('session', 'course')
    search_fields = ('course__name', 'session__name')


@admin.register(EnrollmentFeePackage)
class EnrollmentFeePackageAdmin(admin.ModelAdmin):
    list_display  = ('student', 'tuition_fee', 'transport_fee', 'is_custom', 'created_at')
    list_filter   = ('is_custom',)
    search_fields = ('student__user__first_name', 'student__user__last_name', 'student__admission_number')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(FeeRevisionLog)
class FeeRevisionLogAdmin(admin.ModelAdmin):
    list_display  = ('revision_type', 'fee_field', 'amount', 'applied_to_all', 'applied_at', 'applied_by')
    list_filter   = ('revision_type', 'fee_field')
    readonly_fields = ('applied_at',)


@admin.register(FeeVoucher)
class FeeVoucherAdmin(admin.ModelAdmin):
    list_display    = ('voucher_number', 'student', 'voucher_type', 'month', 'due_date', 'amount_paid', 'status')
    list_filter     = ('voucher_type',)
    search_fields   = ('voucher_number', 'student__user__first_name', 'student__admission_number')
    readonly_fields = ('created_at',)
    inlines         = [VoucherLineItemInline, VoucherPaymentInline]

    def status(self, obj):
        return obj.status
    status.short_description = 'Status'


@admin.register(AutoGenerateLog)
class AutoGenerateLogAdmin(admin.ModelAdmin):
    list_display  = ('month', 'created', 'skipped', 'success', 'ran_at')
    list_filter   = ('success',)
    readonly_fields = ('ran_at',)
