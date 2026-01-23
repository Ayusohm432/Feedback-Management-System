from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('process_query/', views.process_query, name='process_query'),
]
