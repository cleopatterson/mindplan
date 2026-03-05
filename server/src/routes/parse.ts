import { Router } from 'express';
import multer from 'multer';
import { extractText } from '../services/extractor.js';
import { scrubSensitiveData, restoreSurnames } from '../services/scrub.js';
import { parsePlan } from '../services/llm.js';
import { enrichGaps } from '../services/validator.js';
import { anonymize } from '../services/anonymize.js';
import type { ParseResponse } from 'shared/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/zip',          // .docx files are ZIP archives — some clients send this MIME
      'application/octet-stream', // generic binary fallback
    ];
    const ext = file.originalname.toLowerCase();
    if (allowed.includes(file.mimetype) && (ext.endsWith('.docx') || ext.endsWith('.doc'))) {
      cb(null, true);
    } else {
      cb(new Error('Only Word documents (.docx) are supported'));
    }
  },
});

export const parseRouter = Router();

parseRouter.post('/parse', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message } satisfies ParseResponse);
    }
    next();
  });
}, async (req, res) => {
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

    const isLocal = (process.env.LLM_PROVIDER || 'claude') === 'local';

    let plan;
    if (isLocal) {
      // Local mode: parse raw text directly, no scrub/anonymize (data never leaves machine)
      const t3 = performance.now();
      plan = await parsePlan(text);
      console.log(`⏱ [parse] Step 2 — Local parse: ${(performance.now() - t3).toFixed(0)}ms`);
    } else {
      // Cloud mode: scrub → parse → restore surnames
      const t2 = performance.now();
      const { text: scrubbedText, surnames } = scrubSensitiveData(text);
      console.log(`⏱ [parse] Step 2 — Scrub: ${(performance.now() - t2).toFixed(0)}ms (${text.length - scrubbedText.length} chars removed)`);

      const t3 = performance.now();
      plan = await parsePlan(scrubbedText);
      console.log(`⏱ [parse] Step 3 — LLM parse: ${(performance.now() - t3).toFixed(0)}ms`);

      // Restore surnames in structured data (before anonymize strips them from person fields)
      restoreSurnames(plan, surnames);
    }

    // Enrich data gaps
    const t5 = performance.now();
    enrichGaps(plan);
    console.log(`⏱ [parse] Step ${isLocal ? 3 : 5} — Gap enrichment: ${(performance.now() - t5).toFixed(0)}ms (${plan.dataGaps.length} gaps)`);

    // Derive family label from real surnames before anonymization strips them
    if (!plan.familyLabel) {
      const surnameList = plan.clients.map((c) => c.name.trim().split(/\s+/).pop()).filter(Boolean) as string[];
      const unique = [...new Set(surnameList)];
      plan.familyLabel = unique.length === 1
        ? `${unique[0]} Family`
        : plan.clients.map((c) => c.name.split(' ')[0]).join(' & ');
    }

    // Anonymize — strip surnames from person-name fields (skip in local mode)
    if (!isLocal) {
      anonymize(plan);
    }

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
