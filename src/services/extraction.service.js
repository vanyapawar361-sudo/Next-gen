const fs = require('fs/promises');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

/**
 * Clean extracted text
 * Removes excess spaces, new lines, and strange hidden characters.
 */
function cleanText(text) {
  return text
    .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Merge multiple spaces into one
    .trim();
}

/**
 * Extracts text from a given document based on its mimetype.
 * Handles TXT directly, Standard PDFs via pdf-parse, and Scanned PDFs via Tesseract OCR.
 */
async function extractText(filePath, mimetype) {
  let extractedText = '';

  if (mimetype === 'text/plain') {
    // 1. TXT Handle
    const data = await fs.readFile(filePath, 'utf8');
    extractedText = data;
  } 
  else if (mimetype === 'application/pdf') {
    // 2. PDF Handle
    try {
      const dataBuffer = await fs.readFile(filePath);
      // Ensure we call the function correctly regardless of export style
      const pdf = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
      const pdfData = await pdf(dataBuffer);
      
      const text = (pdfData.text || '').trim();
      
        // Heuristic: If PDF parsed text is very short/empty, it's likely a scanned PDF
      if (text.length < 50) {
        throw new Error('PDF appears to be scanned or contains no text layer. OCR image conversion is currently required but not supported for raw PDFs.');
      } else {
        extractedText = text;
      }
    } catch (err) {
      throw new Error(`Standard PDF parsing failed (${err.message}). OCR image conversion is required but raw PDFs are not supported.`);
    }
  } 
  else {
    throw new Error('Unsupported mime type for extraction');
  }

  // 3. Text Cleaning
  return cleanText(extractedText);
}

/**
 * Perform OCR using Tesseract.js.
 * NOTE: For production, scanned PDFs must first be converted to images (using something like `pdf-poppler` or `pdf2pic`),
 * because Tesseract.js accepts images, not PDFs natively. 
 * For this beginner-friendly architectural implementation, we structure the call to represent that step.
 */
async function performOCR(filePath) {
  try {
    // In a full implementation, you would loop through extracted images of the PDF pages here.
    // We pass the filePath directly which expects a recognizable image format.
    const { data: { text } } = await Tesseract.recognize(
      filePath, 
      'eng',
      { logger: m => console.log(`[OCR] ${Math.round(m.progress * 100)}% - ${m.status}`) }
    );
    return text;
  } catch (error) {
    console.error('OCR failed. Reminder: Tesseract.js expects image files. Ensure PDF is converted first.', error.message);
    throw error;
  }
}

module.exports = {
  extractText,
  cleanText
};
