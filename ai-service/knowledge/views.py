import logging
from pathlib import Path

import requests
from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import chunk_pages, delete_document_vectors, read_document, retrieve_chunks, upsert_chunks

logger = logging.getLogger(__name__)
ALLOWED_EXTENSIONS = {'.pdf', '.txt'}


class ServiceSecretPermission(BasePermission):
    def has_permission(self, request, view):
        secret = settings.AI_SERVICE_SECRET
        return bool(secret and request.headers.get('x-service-secret') == secret)


def update_backend_status(document_id, document_status, chunk_count=0):
    if not settings.BACKEND_CALLBACK_SECRET:
        raise RuntimeError('BACKEND_CALLBACK_SECRET is not configured.')
    response = requests.patch(
        f'{settings.BACKEND_URL}/api/internal/documents/{document_id}/status',
        json={'status': document_status, 'chunkCount': chunk_count},
        headers={'x-callback-secret': settings.BACKEND_CALLBACK_SECRET},
        timeout=15,
    )
    response.raise_for_status()


class IngestView(APIView):
    permission_classes = [ServiceSecretPermission]

    def post(self, request):
        document_id = request.data.get('documentId')
        source = str(request.data.get('source') or 'Uploaded document')[:200]
        uploaded_file = request.FILES.get('file')
        if not uploaded_file or not document_id:
            return Response({'message': 'file and documentId are required.'}, status=status.HTTP_400_BAD_REQUEST)

        extension = Path(uploaded_file.name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            return Response({'message': 'Only PDF and TXT files are supported.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_bytes = uploaded_file.read()
            pages = read_document(file_bytes, extension)
            chunks = chunk_pages(pages)
            if not chunks:
                raise ValueError('No readable text was found in the uploaded document.')
            chunk_count = upsert_chunks(document_id, source, chunks)
            update_backend_status(document_id, 'indexed', chunk_count)
            return Response({'success': True, 'chunkCount': chunk_count})
        except Exception as error:
            logger.exception('Document ingestion failed for %s', document_id)
            try:
                delete_document_vectors(document_id)
            except Exception:
                logger.exception('Could not clean up partial vectors for %s', document_id)
            try:
                update_backend_status(document_id, 'failed')
            except Exception:
                logger.exception('Could not send failed-ingestion callback for %s', document_id)
            return Response({'success': False, 'message': str(error)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeleteVectorsView(APIView):
    permission_classes = [ServiceSecretPermission]

    def post(self, request):
        document_id = request.data.get('documentId')
        if not document_id:
            return Response({'message': 'documentId is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            delete_document_vectors(document_id)
            return Response({'success': True})
        except Exception as error:
            logger.exception('Vector deletion failed for %s', document_id)
            return Response({'message': str(error)}, status=status.HTTP_502_BAD_GATEWAY)


class RetrieveView(APIView):
    permission_classes = [ServiceSecretPermission]

    def post(self, request):
        query = str(request.data.get('query') or '').strip()
        try:
            top_k = min(max(int(request.data.get('topK', 3)), 1), 10)
        except (TypeError, ValueError):
            return Response({'message': 'topK must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if not query:
            return Response({'message': 'query is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response({'matches': retrieve_chunks(query, top_k)})
        except Exception as error:
            logger.exception('Chunk retrieval failed')
            return Response({'message': str(error)}, status=status.HTTP_502_BAD_GATEWAY)
