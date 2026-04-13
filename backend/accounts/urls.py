from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView, change_password, create_user, dashboard_stats,
    forgot_password, list_users, me, update_profile, reset_password_via_token,
    admin_reset_password, upload_profile_photo, user_detail,
    school_settings, update_school_settings, public_school_info,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/', list_users, name='list_users'),
    path('users/create/', create_user, name='create_user'),
    path('users/<int:user_id>/', user_detail, name='user_detail'),
    path('change-password/', change_password, name='change_password'),
    path('me/', me, name='me'),
    path('update-profile/', update_profile, name='update_profile'),
    path('dashboard-stats/',            dashboard_stats,          name='dashboard_stats'),
    path('upload-photo/',               upload_profile_photo,     name='upload_profile_photo'),
    path('forgot-password/',            forgot_password,          name='forgot_password'),
    path('reset-via-token/',            reset_password_via_token, name='reset_via_token'),
    path('admin-reset/<int:user_id>/',  admin_reset_password,     name='admin_reset_password'),
    path('public-info/',                 public_school_info,       name='public_school_info'),
    path('school-settings/',            school_settings,          name='school_settings'),
    path('school-settings/update/',     update_school_settings,   name='update_school_settings'),
]
