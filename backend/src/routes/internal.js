import { Router } from 'express';
import Document from '../models/Document.js';

const router = Router();

router.patch('/documents/:id/status', async (req, res, next) => {
  if (!process.env.BACKEND_CALLBACK_SECRET || req.get('x-callback-secret') !== process.env.BACKEND_CALLBACK_SECRET) {
    return res.status(401).json({ message: 'Invalid service callback credentials.' });
  }
  try {
    const { status, chunkCount = 0 } = req.body;
    if (!['indexed', 'failed'].includes(status)) return res.status(400).json({ message: 'Invalid document status.' });
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      { status, chunkCount: status === 'indexed' ? Math.max(0, Number(chunkCount) || 0) : 0 },
      { new: true, runValidators: true },
    );
    if (!document) return res.status(404).json({ message: 'Document not found.' });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;