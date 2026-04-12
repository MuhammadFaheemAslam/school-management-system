from django.urls import path
from . import views

urlpatterns = [
    # Enrollment fee packages (view/edit per-student fee assignments)
    path('enrollment-packages/',          views.enrollment_fee_package_list, name='enrollment_fee_package_list'),
    path('enrollment-packages/<int:pk>/', views.enrollment_package_delete,   name='enrollment_package_delete'),

    # Class-level fee structures
    path('class-structures/',          views.class_fee_structure_list,   name='class_fee_structure_list'),
    path('class-structures/create/',   views.class_fee_structure_create, name='class_fee_structure_create'),
    path('class-structures/<int:pk>/', views.class_fee_structure_detail, name='class_fee_structure_detail'),
    path('class-structures/revise/',   views.class_fee_bulk_revise,      name='class_fee_bulk_revise'),
    path('revisions/',                 views.fee_revision_log,            name='fee_revision_log'),

    # Fee Vouchers
    path('vouchers/',                                              views.voucher_list,           name='voucher_list'),
    path('vouchers/months/',                                       views.voucher_months,         name='voucher_months'),
    path('vouchers/generate-monthly/',                             views.voucher_generate_monthly, name='voucher_generate_monthly'),
    path('vouchers/<int:pk>/',                                     views.voucher_detail,         name='voucher_detail'),
    path('vouchers/<int:pk>/pay/',                                 views.voucher_pay,            name='voucher_pay'),
    path('vouchers/delete-month/',                                 views.voucher_delete_month,   name='voucher_delete_month'),
    path('vouchers/<int:pk>/delete/',                              views.voucher_delete,         name='voucher_delete'),
    path('vouchers/<int:voucher_pk>/payments/<int:payment_pk>/',   views.voucher_payment_delete, name='voucher_payment_delete'),
    path('vouchers/<int:pk>/arrears-detail/',                      views.voucher_arrears_detail, name='voucher_arrears_detail'),

    # Student's own vouchers (student/parent role)
    path('my-vouchers/', views.my_vouchers, name='my_vouchers'),

    # Student Fee Ledger
    path('student-ledger/<int:student_id>/', views.student_fee_ledger, name='student_fee_ledger'),

    # Fee Collection Report
    path('collection-report/', views.collection_report, name='collection_report'),

    # Auto-generate schedule
    path('autogenerate/status/',  views.autogenerate_status,  name='autogenerate_status'),
    path('autogenerate/trigger/', views.autogenerate_trigger, name='autogenerate_trigger'),
]
