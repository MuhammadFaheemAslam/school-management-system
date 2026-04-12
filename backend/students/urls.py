from django.urls import path
from . import views

urlpatterns = [
    path('', views.student_list, name='student_list'),
    path('enroll/', views.student_enroll, name='student_enroll'),
    path('me/', views.my_student_profile, name='my_student_profile'),
    path('<int:pk>/',             views.student_detail,             name='student_detail'),
    path('<int:pk>/enrollments/', views.student_enrollment_history, name='student_enrollment_history'),
    path('<int:pk>/promote/',     views.student_promote,            name='student_promote'),
    path('<int:pk>/section/',      views.student_change_section,     name='student_change_section'),
    path('<int:pk>/slc/',          views.student_slc,                name='student_slc'),
    path('<int:pk>/transport/',    views.student_transport,          name='student_transport'),
    path('<int:pk>/deactivate/',  views.student_deactivate,         name='student_deactivate'),
    path('<int:pk>/readmit/',     views.student_readmit,            name='student_readmit'),

    path('<int:student_id>/documents/',              views.student_documents,        name='student_documents'),
    path('<int:student_id>/documents/<int:doc_id>/', views.student_document_delete,  name='student_document_delete'),

    path('parents/', views.parent_list, name='parent_list'),
    path('parents/create/', views.parent_create, name='parent_create'),
    path('parents/<int:pk>/', views.parent_detail, name='parent_detail'),
]
