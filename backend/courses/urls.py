from django.urls import path
from . import views

urlpatterns = [
    # Academic Sessions
    path('sessions/',              views.session_list,     name='session_list'),
    path('sessions/create/',       views.session_create,   name='session_create'),
    path('sessions/<int:pk>/',     views.session_detail,   name='session_detail'),
    path('sessions/<int:pk>/activate/', views.session_activate, name='session_activate'),

    # Classes
    path('',                       views.course_list,      name='course_list'),
    path('create/',                views.course_create,    name='course_create'),
    path('<int:pk>/',              views.course_detail,    name='course_detail'),

    # Subjects
    path('subjects/',              views.subject_list,     name='subject_list'),
    path('subjects/create/',       views.subject_create,   name='subject_create'),
    path('subjects/<int:pk>/',     views.subject_detail,   name='subject_detail'),

    # Sections
    path('sections/',              views.section_list,     name='section_list'),
    path('sections/create/',       views.section_create,   name='section_create'),
    path('sections/<int:pk>/',     views.section_detail,   name='section_detail'),

    # School-wide settings
    path('school-settings/',            views.school_settings,           name='school_settings'),
    path('school-settings/apply-all/',  views.school_settings_apply_all, name='school_settings_apply_all'),
]
