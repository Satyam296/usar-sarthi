import { Router } from 'express';
import path from 'node:path';
import multer from 'multer';
import Document from '../models/Document.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
      if (extension !== '.pdf' && extension !== '.txt') {
        return callback(Object.assign(new Error('Only PDF and TXT files are supported.'), { status: 400 }));
      }
      return callback(null, true);
  },
});

router.use(requireAuth, requireRole('admin'));

router.post('/upload', upload.single('file'), async (req, res, next) => {
  let document;
  try {
    const { title, department, category } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF or TXT file to upload.' });
    if (!title?.trim() || !department?.trim() || !category?.trim()) {
      return res.status(400).json({ message: 'Title, department, and category are required.' });
    }

    document = await Document.create({
      title,
      department,
      category,
      fileName: req.file.originalname,
      status: 'pending',
    });

    // The uploaded bytes travel in the request body rather than a shared disk
    // path, so Express and the AI service can run as separate hosts/containers.
    const ingestForm = new FormData();
    ingestForm.append('documentId', document.id);
    ingestForm.append('source', document.title);
    ingestForm.append('file', new Blob([req.file.buffer]), req.file.originalname);

    const aiResponse = await fetch(`${process.env.DJANGO_SERVICE_URL}/ingest`, {
      method: 'POST',
      headers: { 'x-service-secret': process.env.AI_SERVICE_SECRET },
      body: ingestForm,
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!aiResponse.ok) {
      const result = await aiResponse.json().catch(() => ({}));
      throw Object.assign(new Error(result.message || 'The AI service could not index this document.'), { status: 502 });
    }
    return res.status(201).json({ document: await Document.findById(document.id) });
  } catch (error) {
    if (document) {
      document.status = 'failed';
      await document.save().catch(() => {});
    }
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const documents = await Document.find()
      .select('title department category status chunkCount uploadDate')
      .sort({ uploadDate: -1 });
    return res.json({ documents });
  } catch (error) {
    return next(error);
  }
});

router.post('/retrieve', async (req, res, next) => {
  try {
    const { query, topK = 3 } = req.body;
    if (!query?.trim()) return res.status(400).json({ message: 'Enter a search query.' });
    const response = await fetch(`${process.env.DJANGO_SERVICE_URL}/retrieve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service-secret': process.env.AI_SERVICE_SECRET },
      body: JSON.stringify({ query: query.trim(), topK: Math.min(Math.max(Number(topK) || 3, 1), 10) }),
      signal: AbortSignal.timeout(60_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ message: result.message || 'Retrieval service is unavailable.' });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found.' });

    const response = await fetch(`${process.env.DJANGO_SERVICE_URL}/delete-vectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service-secret': process.env.AI_SERVICE_SECRET },
      body: JSON.stringify({ documentId: document.id }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return res.status(502).json({ message: 'Could not remove this document from the vector index. The record was kept.' });

    await Document.deleteOne({ _id: document.id });
    return res.json({ message: 'Document and indexed chunks deleted.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
