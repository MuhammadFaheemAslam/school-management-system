from django.urls import path
from . import views

urlpatterns = [
    path('',                        views.exam_list,    name='exam_list'),
    path('create/',                 views.exam_create,  name='exam_create'),
    path('marks/',                  views.enter_marks,  name='enter_marks'),
    path('my-results/',             views.my_results,   name='my_results'),
    path('<int:pk>/',               views.exam_detail,  name='exam_detail'),
    path('<int:exam_id>/results/',  views.exam_results, name='exam_results'),
]
