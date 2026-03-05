import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    mimetype === 'application/zip' ||
    mimetype === 'application/octet-stream'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type. Please upload a Word document (.docx).`);
}
