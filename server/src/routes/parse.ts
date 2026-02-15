import { Router } from 'express';
import multer from 'multer';
import { extractText } from '../services/extractor.js';
import { parseWithClaude } from '../services/claude.js';
import { enrichGaps } from '../services/validator.js';
import type { ParseResponse } from 'shared/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are supported'));
    }
  },
});

export const parseRouter = Router();

parseRouter.post('/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' } satisfies ParseResponse);
      return;
    }

    // Step 1: Extract text
    const text = await extractText(req.file.buffer, req.file.mimetype);

    if (text.trim().length < 50) {
      res.status(400).json({
        success: false,
        error: 'Could not extract enough text from the document. Is this a scanned/image-based PDF?',
      } satisfies ParseResponse);
      return;
    }

    // Step 2: Parse with Claude
    const plan = await parseWithClaude(text);

    // Step 3: Enrich data gaps
    enrichGaps(plan);

    res.json({
      success: true,
      data: plan,
      extractedTextLength: text.length,
    } satisfies ParseResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Parse error:', message);
    res.status(500).json({ success: false, error: message } satisfies ParseResponse);
  }
});
