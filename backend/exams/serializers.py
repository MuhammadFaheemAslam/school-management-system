from rest_framework import serializers
from .models import Exam, Result


class ExamSerializer(serializers.ModelSerializer):
    class_section_name = serializers.CharField(source='class_section.__str__', read_only=True)
    subject_name       = serializers.CharField(source='subject.name', read_only=True)
    created_by_name    = serializers.SerializerMethodField()
    result_count       = serializers.SerializerMethodField()

    class Meta:
        model  = Exam
        fields = [
            'id', 'name', 'exam_type', 'class_section', 'class_section_name',
            'subject', 'subject_name', 'date', 'total_marks', 'passing_marks',
            'created_by', 'created_by_name', 'result_count', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_result_count(self, obj):
        return obj.results.count()


class ResultSerializer(serializers.ModelSerializer):
    student_name      = serializers.SerializerMethodField()
    admission_number  = serializers.CharField(source='student.admission_number', read_only=True)
    percentage        = serializers.FloatField(read_only=True)
    passed            = serializers.BooleanField(read_only=True)
    exam_name         = serializers.CharField(source='exam.name', read_only=True)
    total_marks       = serializers.IntegerField(source='exam.total_marks', read_only=True)
    passing_marks     = serializers.IntegerField(source='exam.passing_marks', read_only=True)

    class Meta:
        model  = Result
        fields = [
            'id', 'exam', 'exam_name', 'student', 'student_name', 'admission_number',
            'marks_obtained', 'grade', 'percentage', 'passed',
            'total_marks', 'passing_marks', 'remarks',
            'entered_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['grade', 'entered_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return obj.student.user.get_full_name() or obj.student.user.username


class BulkResultSerializer(serializers.Serializer):
    exam    = serializers.IntegerField()
    results = serializers.ListField(child=serializers.DictField(), min_length=1)

    def validate_results(self, results):
        for r in results:
            if 'student' not in r or 'marks_obtained' not in r:
                raise serializers.ValidationError("Each result must have 'student' and 'marks_obtained'.")
            try:
                float(r['marks_obtained'])
            except (TypeError, ValueError):
                raise serializers.ValidationError("marks_obtained must be a number.")
        return results
