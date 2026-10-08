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

The browser calls Express. Express owns authentication and document metadata; uploaded files are held in memory only and streamed straight through to Django's `/ingest` endpoint as the request body (never written to disk), so the two services don't need to share a filesystem — they can run on completely separate hosts. Django calls Express back to update the document status.

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
| AI service | `BACKEND_URL`, `BACKEND_CALLBACK_SECRET`, `AI_SERVICE_SECRET`, `DJANGO_SECRET_KEY`; `DATABASE_URL` and `DJANGO_ALLOWED_HOSTS` are also provided (leave `DATABASE_URL` empty for local SQLite) |
| Frontend | `VITE_API_URL`, normally `http://127.0.0.1:5000/api` |

Use the same `BACKEND_CALLBACK_SECRET` in backend and AI service, and the same `AI_SERVICE_SECRET` in both. Set strong, unique values in local `.env` files; the example values are placeholders.

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
- `DELETE /api/documents/:id` — delete the document's chunks from the local vector store and its MongoDB metadata
- `POST /api/documents/retrieve` — admin-only top-K retrieval test; body `{ "query": "...", "topK": 3 }`
- `POST /ingest`, `POST /delete-vectors`, `POST /retrieve` — Django service operations, protected by `AI_SERVICE_SECRET`

The Django ingestion callback updates status through the backend's internal endpoint using `BACKEND_CALLBACK_SECRET`. A failed vector-store deletion leaves the MongoDB record intact so cleanup can be retried.

## Deploying (Netlify + Render + MongoDB Atlas)

This is three separate pieces of hosting, not one. Netlify only serves the static frontend — the Express API and the Django AI service are both long-running servers, so each needs its own host (Render works for both; Railway/Fly are equally fine). You'll also need a real MongoDB connection string, since there's no MongoDB on Render — [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) has a free M0 tier that's plenty for this.

| Piece | Host | Notes |
| --- | --- | --- |
| `frontend/` | Netlify | Static build. `netlify.toml` at the repo root already sets the base directory, build command, and the SPA redirect React Router needs. |
| `backend/` | Render (Web Service, Node) | Stateless — no disk needed anymore. |
| `ai-service/` | Render (Web Service, Python) | Stateless too, as long as `DATABASE_URL` points at a real Postgres (see below). |
| MongoDB | MongoDB Atlas (free M0) | Metadata only: users, document records. |
| Vector store | Render Postgres (free) | Holds the `DocumentChunk` table in place of local SQLite — see below. |

### 1. MongoDB Atlas

Create a free M0 cluster, create a database user, and allow network access from anywhere (0.0.0.0/0 is fine for a project like this). Copy the connection string — that's your `MONGO_URI`.

### 2. Render Postgres (replaces local SQLite for the vector store)

Create a new **Postgres** instance on Render (free tier). Once it's up, copy its **Internal Database URL** (if the AI service will also live on Render — internal URLs are faster and don't count against bandwidth) or the **External Database URL** (if it's hosted elsewhere). This becomes `DATABASE_URL` for the AI service. The same `DocumentChunk` model and cosine-similarity retrieval code run unchanged against Postgres — only the connection string changes (see `ai-service/campus_ai/settings.py`).

### 3. Django AI service → Render Web Service

- **Root directory:** `ai-service`
- **Runtime:** Python 3
- **Build command:** `pip install -r requirements.txt && python manage.py migrate`
- **Start command:** `gunicorn campus_ai.wsgi:application --bind 0.0.0.0:$PORT`
- **Environment variables:** `DATABASE_URL` (from step 2), `DJANGO_SECRET_KEY` (any long random string), `DJANGO_ALLOWED_HOSTS` (the service's own `*.onrender.com` hostname), `BACKEND_URL` (the Express service's URL from step 4), `BACKEND_CALLBACK_SECRET`, `AI_SERVICE_SECRET` (both must exactly match what you set on the backend)

`gunicorn` only runs on Linux, so you won't be able to test this exact start command on Windows locally — that's expected, Render's containers are Linux. Local dev keeps using `manage.py runserver` as before; nothing about the local workflow changes.

### 4. Express backend → Render Web Service

- **Root directory:** `backend`
- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:** `MONGO_URI` (from step 1), `JWT_SECRET` (any long random string), `DJANGO_SERVICE_URL` (the AI service's URL from step 3), `BACKEND_CALLBACK_SECRET`, `AI_SERVICE_SECRET` (matching step 3), `FRONTEND_URL` (the Netlify URL from step 5 — needed for CORS)

Don't set `PORT` yourself — Render injects it, and `server.js` already reads `process.env.PORT`.

### 5. React frontend → Netlify

Connect the GitHub repo in Netlify; it will pick up `netlify.toml` automatically. Add one environment variable in Netlify's site settings before the first deploy:

- `VITE_API_URL` → the Express service's URL from step 4, with `/api` appended (e.g. `https://usar-sarthi-backend.onrender.com/api`)

Vite bakes environment variables in at build time, so if you add/change this after the first deploy, trigger a new deploy for it to take effect.

### 6. Wire the circular references and redeploy

Steps 3 and 4 each reference the other's URL, which you won't know until both services exist once. Create both first (even with a placeholder), then go back and fill in `DJANGO_SERVICE_URL` (on the backend) and `BACKEND_URL` (on the AI service) with the real `https://...onrender.com` addresses, then redeploy both. Same for `FRONTEND_URL` once Netlify gives you its URL.

### Known free-tier quirks

- **Cold starts:** Render's free web services spin down after ~15 minutes idle and take 30–60s to wake on the next request. The AI service is slower to wake than the backend, since it also has to re-load the embedding model into memory.
- **Models re-download after a restart:** `all-MiniLM-L6-v2` (~90 MB) and EasyOCR's English model (~65 MB) are cached to local disk at runtime, which is ephemeral on Render's free tier — so each cold start/redeploy re-downloads them. The first request after a restart will be noticeably slower than the rest; that's expected, not a hang.
- **Upload size vs. request timeouts:** free-tier Render services can have tighter request timeouts than the 5-minute one configured in `documents.js`. If a large scanned PDF's OCR run doesn't finish in time, consider trimming page count or upgrading the AI service's plan.