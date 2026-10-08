from django.db import models


class DocumentChunk(models.Model):
    """A single embedded text chunk, stored locally in SQLite.

    Replaces an external vector database: embeddings are kept as JSON
    float arrays and compared with brute-force cosine similarity at query
    time. Fine for an admin knowledge base of this scale (hundreds to a
    few thousand chunks); revisit if the corpus grows much larger.
    """

    document_id = models.CharField(max_length=64, db_index=True)
    chunk_index = models.PositiveIntegerField()
    chunk_text = models.TextField()
    source = models.CharField(max_length=200)
    page_number = models.PositiveIntegerField(null=True, blank=True)
    embedding = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['document_id'])]
