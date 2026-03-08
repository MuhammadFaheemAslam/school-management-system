from rest_framework import generics, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import status
from .models import User
from rest_framework.views import APIView
from .serializers import RegisterSerializer, UserSerializer

# 1️⃣ Signup
class RegisterView(generics.CreateAPIView):
    
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

# 2️⃣ Get current user
class MeView(APIView):
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    

# 3️⃣ Logout (Blacklist refresh token)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({"message":"Logout successfully"})
        except Exception:
            return Response(
                {"error": "Invalid token"},
                status=status.HTTP_400_BAD_REQUEST
            )

# Password Forget API
class ForgotPasswordView(APIView):

    def post(self, request):

        email = request.data.get("email")

        try:
            user = User.objects.get(email=email)

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            return Response({
                "uid": uid,
                "token": token
            })

        except User.DoesNotExist:
            return Response({"error": "User not found"})

# Reset Password

class ResetPasswordView(APIView):

    def post(self, request):

        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("password")

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)

            if default_token_generator.check_token(user, token):

                user.set_password(new_password)
                user.save()

                return Response({"message": "Password reset successful"})

            return Response({"error": "Invalid token"})

        except Exception:
            return Response({"error": "Invalid request"})