from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display    = ('title', 'recipient', 'notif_type', 'is_read', 'created_at')
    list_filter     = ('notif_type', 'is_read')
    search_fields   = ('title', 'message', 'recipient__username', 'recipient__email')
    readonly_fields = ('created_at',)
    ordering        = ('-created_at',)
    date_hierarchy  = 'created_at'

    actions = ['mark_as_read', 'mark_as_unread']

    @admin.action(description='Mark selected as read')
    def mark_as_read(self, request, queryset):
        queryset.update(is_read=True)

    @admin.action(description='Mark selected as unread')
    def mark_as_unread(self, request, queryset):
        queryset.update(is_read=False)
