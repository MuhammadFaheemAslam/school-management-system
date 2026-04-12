from django.conf import settings
from django.core.mail import send_mail


def send_welcome_email(user, temp_password):
    subject = "Your School Management System Account"

    message = f"""
Hello {user.first_name or user.username},

Your account has been created on the School Management System.

Here are your login credentials:

  Username : {user.username}
  Password : {temp_password}
  Role     : {user.get_role_display()}

Login at: {settings.FRONTEND_URL}/login

IMPORTANT: You will be asked to set a new password on your first login.
Please do not share your credentials with anyone.

If you did not expect this email, please contact the system administrator.

Regards,
School Management System
"""

    send_mail(
        subject=subject,
        message=message.strip(),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
