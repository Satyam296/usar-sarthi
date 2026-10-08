from django.http import JsonResponse
from django.urls import path

from .views import DeleteVectorsView, IngestView, RetrieveView


def health_check(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('health', health_check),
    path('ingest', IngestView.as_view()),
    path('delete-vectors', DeleteVectorsView.as_view()),
    path('retrieve', RetrieveView.as_view()),
]