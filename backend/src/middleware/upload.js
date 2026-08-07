const multer = require('multer')
const { error } = require('../utils')

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg']

function imageFileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const err = new Error('INVALID_FILE_TYPE')
    err.code = 'INVALID_FILE_TYPE'
    return cb(err)
  }
  cb(null, true)
}

// memoryStorage keeps the file as a buffer on req.file.buffer instead of writing to disk -
// the buffer is streamed straight to Cloudinary in the controller, no temp files to clean up.
const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single('file')

const hospitalStampUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single('file')

// Wraps a multer single-file middleware so multer's own errors (LIMIT_FILE_SIZE, our custom
// INVALID_FILE_TYPE) are translated into the exact codes/messages the API documentation
// specifies, instead of falling through to Express's generic error handler.
function handleUpload(multerMiddleware, tooLargeMessage) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, code: 'FILE_TOO_LARGE', message: tooLargeMessage })
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({
            success: false,
            code: 'INVALID_FILE_TYPE',
            message: 'Only PNG and JPG image files are accepted.',
          })
        }
        return next(err)
      }
      if (!req.file) {
        return res.status(400).json({ success: false, code: 'FILE_REQUIRED', message: 'A file is required.' })
      }
      next()
    })
  }
}

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10 MB, per POST /api/vendor-invoices spec

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('INVALID_FILE_TYPE'))
    cb(null, true)
  },
})

// Wraps multer's single-file upload so failures resolve to the API's standard
// { success, code, message } error shape instead of Express's default HTML error page.
function uploadPdf(fieldName) {
  return (req, res, next) => {
    pdfUpload.single(fieldName)(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return error(res, 'File exceeds the 10 MB limit. Please compress or re-scan the document.', 'FILE_TOO_LARGE', 400)
      }
      if (err.message === 'INVALID_FILE_TYPE') {
        return error(res, 'Only PDF files are accepted. Please scan the invoice and upload as a PDF.', 'INVALID_FILE_TYPE', 400)
      }
      return error(res, err.message, 'UPLOAD_ERROR', 400)
    })
  }
}

// Email providers such as Mailgun and SendGrid POST a multipart request with one or
// more attachments. Keep those PDFs in memory just like a staff upload, but accept
// multiple field names because providers do not share a single attachment convention.
function uploadInboundPdfs() {
  return (req, res, next) => {
    pdfUpload.array('attachments', 10)(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return error(res, 'An emailed attachment exceeds the 10 MB limit.', 'FILE_TOO_LARGE', 400)
      }
      if (err.message === 'INVALID_FILE_TYPE') {
        return error(res, 'Only PDF invoice attachments are accepted.', 'INVALID_FILE_TYPE', 400)
      }
      return error(res, err.message, 'UPLOAD_ERROR', 400)
    })
  }
}

module.exports = {
  uploadSignatureFile: handleUpload(signatureUpload, 'Signature image exceeds the 5 MB limit.'),
  uploadHospitalStampFile: handleUpload(hospitalStampUpload, 'Hospital stamp image exceeds the 10 MB limit.'),
  uploadPdf,
  uploadInboundPdfs,
}
