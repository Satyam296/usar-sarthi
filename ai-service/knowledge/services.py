import io
from functools import lru_cache

import numpy as np
import pdfplumber
import pypdfium2 as pdfium
from sentence_transformers import SentenceTransformer

from .models import DocumentChunk

EMBEDDING_MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
OCR_RENDER_SCALE = 2.0


@lru_cache(maxsize=1)
def embedding_model():
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


@lru_cache(maxsize=1)
def ocr_reader():
    # Imported lazily: easyocr pulls in torchvision/opencv at import time,
    # and most uploads (digital PDFs, .txt) never need OCR at all.
    import easyocr
    return easyocr.Reader(['en'], gpu=False)


def ocr_page_text(pdfium_document, page_index):
    page = pdfium_document[page_index]
    bitmap = page.render(scale=OCR_RENDER_SCALE)
    image = bitmap.to_pil()
    lines = ocr_reader().readtext(np.array(image), detail=0, paragraph=True)
    return '\n'.join(lines).strip()


def read_document(file_bytes: bytes, extension: str):
    if extension == '.pdf':
        pages = []
        pdfium_document = None
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page_number, page in enumerate(pdf.pages, start=1):
                    text = (page.extract_text() or '').strip()
                    if not text:
                        # No embedded text layer (e.g. a scanned or
                        # photographed notice) — fall back to OCR.
                        if pdfium_document is None:
                            pdfium_document = pdfium.PdfDocument(file_bytes)
                        text = ocr_page_text(pdfium_document, page_number - 1)
                    if text:
                        pages.append((text, page_number))
        finally:
            if pdfium_document is not None:
                pdfium_document.close()
        return pages
    if extension == '.txt':
        text = file_bytes.decode('utf-8-sig', errors='replace').strip()
        return [(text, None)] if text else []
    raise ValueError('Only PDF and TXT files are supported.')


def chunk_pages(pages, chunk_size=500, overlap=50):
    chunks = []
    step = chunk_size - overlap
    for text, page_number in pages:
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk = text[start:end].strip()
            if chunk:
                chunks.append({'text': chunk, 'pageNumber': page_number})
            if end == len(text):
                break
            start += step
    return chunks


def upsert_chunks(document_id, source, chunks):
    model = embedding_model()
    vectors = model.encode([chunk['text'] for chunk in chunks], normalize_embeddings=True)
    # Re-ingesting the same document id should replace its previous chunks.
    DocumentChunk.objects.filter(document_id=str(document_id)).delete()
    records = [
        DocumentChunk(
            document_id=str(document_id),
            chunk_index=position,
            chunk_text=chunk['text'],
            source=source,
            page_number=chunk['pageNumber'],
            embedding=vector.tolist(),
        )
        for position, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    DocumentChunk.objects.bulk_create(records)
    return len(records)


def delete_document_vectors(document_id):
    DocumentChunk.objects.filter(document_id=str(document_id)).delete()


def retrieve_chunks(query, top_k=3):
    rows = list(DocumentChunk.objects.all().values('chunk_text', 'source', 'page_number', 'embedding'))
    if not rows:
        return []

    query_vector = embedding_model().encode(query, normalize_embeddings=True)
    matrix = np.array([row['embedding'] for row in rows], dtype=np.float32)
    # Chunk embeddings are already L2-normalized at encode time, so the dot
    # product against the (also normalized) query vector is cosine similarity.
    scores = matrix @ query_vector
    top_indices = np.argsort(-scores)[:top_k]

    return [
        {
            'chunkText': rows[index]['chunk_text'],
            'source': rows[index]['source'],
            'score': float(scores[index]),
            'pageNumber': rows[index]['page_number'],
        }
        for index in top_indices
    ]