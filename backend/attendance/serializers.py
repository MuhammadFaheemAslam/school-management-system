from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student_name     = serializers.SerializerMethodField()
    admission_number = serializers.CharField(source='student.admission_number', read_only=True)
    father_name      = serializers.CharField(source='student.father_name', read_only=True)
    marked_by_name   = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'student', 'student_name', 'admission_number', 'father_name',
            'class_section', 'date', 'status', 'arrival_time', 'note',
            'marked_by', 'marked_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['marked_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        s = obj.student
        name = ' '.join(filter(None, [s.first_name, s.middle_name, s.last_name]))
        if name:
            return name
        if s.user:
            return s.user.get_full_name() or s.user.username
        return s.admission_number or 'Unknown'

    def get_marked_by_name(self, obj):
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return None


class BulkAttendanceSerializer(serializers.Serializer):
    """Used for marking attendance for a whole section in one request."""
    class_section = serializers.IntegerField()
    date = serializers.DateField()
    records = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )

    def validate_records(self, records):
        valid_statuses = ('present', 'absent', 'late', 'leave')
        for r in records:
            if 'student' not in r or 'status' not in r:
                raise serializers.ValidationError("Each record must have 'student' and 'status'.")
            if r['status'] not in valid_statuses:
                raise serializers.ValidationError(f"Status must be one of {valid_statuses}.")
            # arrival_time is optional, only meaningful for 'late'
            if 'arrival_time' in r and r['arrival_time']:
                import re
                if not re.match(r'^\d{2}:\d{2}(:\d{2})?$', str(r['arrival_time'])):
                    raise serializers.ValidationError("arrival_time must be in HH:MM format.")
        return records
