# USAR Sarthi

Month 1 admin knowledge-base layer for **USAR Sarthi** — a Multimodal AI Chatbot with Retrieval-Augmented Generation (RAG) built for the **University School of Automation & Robotics (USAR)**. Administrators can upload campus PDFs and text files, manage their index records, and test semantic retrieval. This phase intentionally does not include student chat, LLM answer generation, or image/multimodal processing — those land in Month 2 and Month 3.

### Branding the admin panel

The header currently shows a bot-icon badge in place of the USAR crest. Drop the real logo at `frontend/public/logo.png` (square image, transparent background recommended) and it swaps in automatically — no code changes required. See `frontend/public/README-LOGO.txt`.

## Project structure

```text
frontend/    React, Vite, Tailwind CSS, React Router, Axios
backend/     Express API, MongoDB/Mongoose, admin authentication, uploads
ai-service/  Django REST Framework, pdfplumber, sentence-transformers, local SQLite vector store
```

The browser calls Express. Express owns authentication and document metadata, then calls Django for ingestion, retrieval, and vector deletion. The local setup shares `backend/uploads` with Django through the file path passed to `/ingest`. Django calls Express back to update the document status.

Embeddings are **not** stored in an external vector database. Django's own `db.sqlite3` holds a `DocumentChunk` table (chunk text + a JSON-encoded embedding vector per row), and retrieval does a brute-force cosine-similarity scan over that table with NumPy. That's simple and fully local — no API key, no account signup — and is plenty fast for an admin knowledge base of up to a few thousand chunks. If the corpus ever grows well beyond that, swap in a real vector database (Pinecone, Qdrant, pgvector, etc.) behind the same `upsert_chunks` / `delete_document_vectors` / `retrieve_chunks` functions in `ai-service/knowledge/services.py` — nothing else in the stack needs to change.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.11 or 3.12 recommended for the ML dependencies
- MongoDB Community running locally, or a MongoDB connection string

The first ingestion downloads `all-MiniLM-L6-v2` from Hugging Face if it is not already cached. Run `manage.py migrate` once before first use (see setup steps below) to create the local `DocumentChunk` table.

## Configure environment files

Open three PowerShell terminals at the repository root. Each startup sequence below copies that service's example file; edit the resulting `.env` before starting it.

Set these values:

| Service | Variables |
| --- | --- |
| Backend | `MONGO_URI`, `JWT_SECRET`, `DJANGO_SERVICE_URL`, `PORT`, `BACKEND_CALLBACK_SECRET`, `AI_SERVICE_SECRET`; `FRONTEND_URL` defaults to `http://localhost:5173` |
| AI service | `BACKEND_URL`, `BACKEND_CALLBACK_SECRET`, `AI_SERVICE_SECRET`; `BACKEND_UPLOADS_DIR` and `DJANGO_SECRET_KEY` are also provided |
| Frontend | `VITE_API_URL`, normally `http://127.0.0.1:5000/api` |

Use the same `BACKEND_CALLBACK_SECRET` in backend and AI service, and the same `AI_SERVICE_SECRET` in both. Set strong, unique values in local `.env` files; the example values are placeholders. The backend upload directory is `backend/uploads`. If you change it, point `BACKEND_UPLOADS_DIR` at that same directory.

## Run locally on Windows

Start each command in its own PowerShell terminal from the repository root.

**1. Django AI service**

```powershell
Set-Location ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env, then:
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

**2. Express API**

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
# Edit .env, then:
npm run dev
```

**3. React admin panel**

```powershell
Set-Location frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is `http://127.0.0.1:5000/api/health`; the AI service health endpoint is `http://127.0.0.1:8000/health`.

Make sure MongoDB is running before starting Express. On the first upload, keep the AI service online while the embedding model loads and the document is indexed. Uploads are limited to 20 MB and accept PDF or TXT. PDFs are extracted page by page; TXT files are decoded as UTF-8. Text is split into 500-character chunks with 50-character overlap.

**Scanned / photographed PDFs:** if a page has no embedded text layer (a phone photo of a printed notice, for example), ingestion automatically falls back to OCR (`easyocr`, rendered via `pypdfium2`) instead of failing with "No readable text was found." This only triggers for pages that actually need it, so normal digital PDFs ingest at full speed. The first OCR run on a fresh machine downloads EasyOCR's English model (~65 MB) and is noticeably slower per page (CPU-only, roughly 15–25s/page) — expected, not a hang.

## Create the first admin

The register endpoint is a one-time bootstrap: it creates an `admin` only while the database has no admin account. Subsequent public registration attempts are rejected. From PowerShell, with MongoDB and the backend running, send:

```powershell
$body = @{
  name = 'Campus Administrator'
  email = 'admin@usar.ac.in'
  password = 'replace-with-a-strong-password'
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri 'http://127.0.0.1:5000/api/auth/register' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body
```

Then sign in at `http://localhost:5173/login` with that email and password. Passwords are bcrypt-hashed before storage. Keep the bootstrap endpoint unavailable to the public once the initial admin has been created.

## API overview

- `POST /api/auth/register` — create the first admin account
- `POST /api/auth/login` — return a 12-hour JWT
- `POST /api/documents/upload` — admin-only multipart upload (`title`, `department`, `category`, `file`)
- `GET /api/documents` — admin-only document inventory
- `DELETE /api/documents/:id` — delete the document's chunks from the local vector store, its MongoDB metadata, and the uploaded file
- `POST /api/documents/retrieve` — admin-only top-K retrieval test; body `{ "query": "...", "topK": 3 }`
- `POST /ingest`, `POST /delete-vectors`, `POST /retrieve` — Django service operations, protected by `AI_SERVICE_SECRET`

The Django ingestion callback updates status through the backend's internal endpoint using `BACKEND_CALLBACK_SECRET`. A failed vector-store deletion leaves the MongoDB record intact so cleanup can be retried.