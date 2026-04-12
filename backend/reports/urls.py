from django.urls import path
from . import views

urlpatterns = [
    path('filters/',             views.report_filters,        name='report_filters'),
    path('attendance/',          views.attendance_report,     name='attendance_report'),
    path('results/',             views.results_report,        name='results_report'),
    path('fees/',                views.fees_report,           name='fees_report'),
    path('report-card/',         views.student_report_card,   name='student_report_card'),
]
