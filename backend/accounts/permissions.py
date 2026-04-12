from rest_framework.permissions import BasePermission

ADMIN_ROLES = ('super_admin', 'school_admin')
MANAGEMENT_ROLES = ('super_admin', 'school_admin', 'principal')
FINANCE_ROLES = ('super_admin', 'school_admin')      # fee structures, payments, salary
ACADEMIC_ROLES = ('super_admin', 'school_admin', 'principal')  # exams, marks, academic policy

# Salary fields that only finance roles may read or write
SALARY_FIELDS = ('basic_salary', 'payment_mode', 'bank_name', 'bank_account_number')


def get_effective_role(user):
    """Return 'super_admin' for Django superuser accounts that have no explicit role set."""
    return 'super_admin' if user.is_superuser and not user.role else user.role


def _auth(user):
    return user.is_authenticated


def _is_superuser(user):
    """Django superuser accounts bypass all role checks."""
    return user.is_authenticated and user.is_superuser


class IsAdminRole(BasePermission):
    """Super Admin or School Admin only."""
    def has_permission(self, request, view):
        return _is_superuser(request.user) or (_auth(request.user) and request.user.role in ADMIN_ROLES)


class IsManagement(BasePermission):
    """Super Admin, School Admin, or Principal."""
    def has_permission(self, request, view):
        return _is_superuser(request.user) or (_auth(request.user) and request.user.role in MANAGEMENT_ROLES)


class IsFinanceRole(BasePermission):
    """Super Admin or School Admin — financial operations (fees, payments, salary)."""
    def has_permission(self, request, view):
        return _is_superuser(request.user) or (_auth(request.user) and request.user.role in FINANCE_ROLES)


class IsAcademicOrTeacher(BasePermission):
    """Super Admin, Principal, or Teacher — academic operations (exams, marks)."""
    def has_permission(self, request, view):
        return _is_superuser(request.user) or (_auth(request.user) and request.user.role in (*ACADEMIC_ROLES, 'teacher'))


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return _auth(request.user) and request.user.role == 'teacher'


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return _auth(request.user) and request.user.role == 'student'


class IsParent(BasePermission):
    def has_permission(self, request, view):
        return _auth(request.user) and request.user.role == 'parent'


class IsManagementOrTeacher(BasePermission):
    def has_permission(self, request, view):
        return _is_superuser(request.user) or (_auth(request.user) and request.user.role in (*MANAGEMENT_ROLES, 'teacher'))
