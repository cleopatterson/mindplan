import { Router } from 'express';
import multer from 'multer';
import { extractText } from '../services/extractor.js';
import { scrubSensitiveData, restoreSurnames } from '../services/scrub.js';
import { parseWithClaude } from '../services/claude.js';
import { enrichGaps } from '../services/validator.js';
import { anonymize } from '../services/anonymize.js';
import type { ParseResponse } from 'shared/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, and text files are supported'));
    }
  },
});

export const parseRouter = Router();

parseRouter.post('/parse', upload.single('file'), async (req, res) => {
  const t0 = performance.now();
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' } satisfies ParseResponse);
      return;
    }

    console.log(`⏱ [parse] File received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB, ${req.file.mimetype})`);

    // Step 1: Extract text
    const t1 = performance.now();
    const text = await extractText(req.file.buffer, req.file.mimetype);
    console.log(`⏱ [parse] Step 1 — Text extraction: ${(performance.now() - t1).toFixed(0)}ms (${text.length} chars)`);

    if (text.trim().length < 50) {
      res.status(400).json({
        success: false,
        error: 'Could not extract enough text from the document. Is this a scanned/image-based PDF?',
      } satisfies ParseResponse);
      return;
    }

    // Step 2: Scrub sensitive data before sending to API
    const t2 = performance.now();
    const { text: scrubbedText, surnames } = scrubSensitiveData(text);
    console.log(`⏱ [parse] Step 2 — Scrub: ${(performance.now() - t2).toFixed(0)}ms (${text.length - scrubbedText.length} chars removed)`);

    // Step 3: Parse with Claude (using scrubbed text)
    const t3 = performance.now();
    const plan = await parseWithClaude(scrubbedText);
    console.log(`⏱ [parse] Step 3 — Claude API: ${(performance.now() - t3).toFixed(0)}ms`);

    // Step 4: Restore surnames in structured data (before anonymize strips them from person fields)
    restoreSurnames(plan, surnames);

    // Step 5: Enrich data gaps
    const t5 = performance.now();
    enrichGaps(plan);
    console.log(`⏱ [parse] Step 5 — Gap enrichment: ${(performance.now() - t5).toFixed(0)}ms (${plan.dataGaps.length} gaps)`);

    // Step 6: Anonymize — strip surnames from person-name fields
    anonymize(plan);

    console.log(`⏱ [parse] Total request: ${(performance.now() - t0).toFixed(0)}ms`);

    res.json({
      success: true,
      data: plan,
      extractedTextLength: text.length,
    } satisfies ParseResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Parse error (after ${(performance.now() - t0).toFixed(0)}ms):`, message);
    res.status(500).json({ success: false, error: message } satisfies ParseResponse);
  }
});
