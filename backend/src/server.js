import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';

const required = ['MONGO_URI', 'JWT_SECRET', 'DJANGO_SERVICE_URL', 'BACKEND_CALLBACK_SECRET', 'AI_SERVICE_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment values: ${missing.join(', ')}`);

const port = Number(process.env.PORT || 5000);
await connectDatabase();
app.listen(port, () => console.log(`Express API listening on http://127.0.0.1:${port}`));