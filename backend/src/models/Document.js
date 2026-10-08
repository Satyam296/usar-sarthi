import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  department: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  fileName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'indexed', 'failed'], default: 'pending' },
  chunkCount: { type: Number, default: 0, min: 0 },
  uploadDate: { type: Date, default: Date.now },
});

export default mongoose.model('Document', documentSchema);