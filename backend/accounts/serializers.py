from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'middle_name', 'last_name', 'role', 'is_active', 'is_first_login', 'is_superuser', 'profile_photo']
        read_only_fields = ['id', 'is_first_login']


class CreateUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'middle_name', 'last_name', 'role']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_role(self, value):
        valid_roles = [r[0] for r in User.ROLE_CHOICES]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Invalid role. Choose from: {valid_roles}")
        if value == 'super_admin':
            raise serializers.ValidationError("The super_admin role cannot be assigned to new users.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return data


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Username existence is already checked at the view level.
        # If we get here and auth still fails, the password is wrong.
        try:
            data = super().validate(attrs)
        except Exception:
            raise serializers.ValidationError(
                {'password': 'Incorrect password. Please try again.'},
            )

        data['user'] = UserSerializer(self.user).data
        data['first_login'] = self.user.is_first_login
        return data
