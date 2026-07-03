const { GoogleGenerativeAI } = require('@google/generative-ai')

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

const EXTRACTION_PROMPT = `You are extracting structured data from a vendor invoice PDF for an ambulance company's accounts payable system.
Return ONLY valid JSON (no markdown code fences, no commentary) matching this exact shape:
{
  "vendor_name": string,
  "invoice_number": string,
  "invoice_date": "YYYY-MM-DD" or null,
  "extracted_total": number,
  "confidence": number between 0 and 1 indicating how confident you are the totals and line items are correct,
  "items": [ { "description": string, "quantity": number, "unit_price": number, "amount": number } ]
}
If a field cannot be found, use null (or an empty array for items). Amounts must be plain numbers with no currency symbols or thousands separators.`

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY is not configured.')
    err.code = 'OCR_CONFIG_MISSING'
    throw err
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

// Gemini sometimes wraps JSON in a ```json fence despite instructions not to.
function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

// UC-04: runs Gemini OCR against the raw PDF bytes and returns the extracted
// invoice fields + line items. Throws (code OCR_EXTRACTION_FAILED) on any
// failure so the caller can persist the invoice as `extraction_failed`.
async function extractVendorInvoice(pdfBuffer) {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: MODEL_NAME })

  let raw
  try {
    const result = await model.generateContent([
      { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } },
      { text: EXTRACTION_PROMPT },
    ])
    raw = result.response.text()
  } catch (err) {
    const wrapped = new Error(`Gemini OCR request failed: ${err.message}`)
    wrapped.code = 'OCR_EXTRACTION_FAILED'
    throw wrapped
  }

  let parsed
  try {
    parsed = JSON.parse(stripCodeFence(raw))
  } catch {
    const err = new Error('Gemini returned a non-JSON response.')
    err.code = 'OCR_EXTRACTION_FAILED'
    throw err
  }

  if (!parsed.vendor_name || !parsed.invoice_number) {
    const err = new Error('OCR extraction did not return the required vendor_name/invoice_number fields.')
    err.code = 'OCR_EXTRACTION_FAILED'
    throw err
  }

  return parsed
}

module.exports = { extractVendorInvoice }
