from django.contrib import admin
from .models import FarmerQuery, TrainingData
from .ml_engine import train_model
from django.contrib import messages

class FarmerQueryAdmin(admin.ModelAdmin):
    list_display = ('query_text', 'language', 'created_at')
    list_filter = ('language', 'created_at')
    search_fields = ('query_text', 'answer_text')

@admin.action(description='Retrain ML Model')
def retrain_model_action(modeladmin, request, queryset):
    result = train_model()
    modeladmin.message_user(request, result, messages.SUCCESS)

class TrainingDataAdmin(admin.ModelAdmin):
    list_display = ('question', 'category', 'language')
    list_filter = ('category', 'language')
    actions = [retrain_model_action]

admin.site.register(FarmerQuery, FarmerQueryAdmin)
admin.site.register(TrainingData, TrainingDataAdmin)
