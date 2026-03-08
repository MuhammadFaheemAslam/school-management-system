from rest_framework import generics, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
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