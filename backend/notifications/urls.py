from django.urls import path
from . import views

urlpatterns = [
    path('',                        views.my_notifications,           name='my_notifications'),
    path('mark-read/',              views.mark_read,                  name='mark_read'),
    path('send-fee-reminders/',     views.send_fee_reminders,         name='send_fee_reminders'),
    path('send-exam-alerts/',       views.send_exam_alerts,           name='send_exam_alerts'),
    path('send-attendance-warnings/', views.send_attendance_warnings, name='send_attendance_warnings'),
    path('send-general/',           views.send_general,               name='send_general'),
]
