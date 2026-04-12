from django.urls import path
from . import views

urlpatterns = [
    path('', views.teacher_list, name='teacher_list'),
    path('create/', views.teacher_create, name='teacher_create'),
    path('me/', views.my_teacher_profile, name='my_teacher_profile'),
    path('my-salary/', views.my_salary, name='my_salary'),
    path('<int:pk>/', views.teacher_detail, name='teacher_detail'),

    # Salary management (finance only)
    path('salaries/', views.salary_list, name='salary_list'),
    path('salaries/autogenerate/status/',  views.salary_autogenerate_status,  name='salary_autogenerate_status'),
    path('salaries/autogenerate/trigger/', views.salary_autogenerate_trigger, name='salary_autogenerate_trigger'),
    path('salaries/<int:pk>/', views.salary_detail, name='salary_detail'),
    path('salaries/<int:pk>/pay/', views.record_salary_payment, name='record_salary_payment'),
]
