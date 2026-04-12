from django.urls import path
from . import views

urlpatterns = [
    path('', views.attendance_by_section, name='attendance_by_section'),
    path('mark/', views.mark_attendance, name='mark_attendance'),
    path('me/', views.my_attendance, name='my_attendance'),
    path('student/<int:student_id>/', views.student_attendance, name='student_attendance'),
    # Teacher attendance
    path('teachers/', views.teacher_attendance_list, name='teacher_attendance_list'),
    path('teachers/mark/', views.teacher_attendance_mark, name='teacher_attendance_mark'),
    path('teachers/me/', views.my_teacher_attendance, name='my_teacher_attendance'),
    path('teachers/<int:teacher_id>/', views.teacher_attendance_detail, name='teacher_attendance_detail'),
]
