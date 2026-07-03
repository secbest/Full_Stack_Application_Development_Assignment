const multer = require('multer')
const { error } = require('../utils')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB, per POST /api/vendor-invoices spec

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('INVALID_FILE_TYPE'))
    cb(null, true)
  },
})

// Wraps multer's single-file upload so failures resolve to the API's standard
// { success, code, message } error shape instead of Express's default HTML error page.
function uploadPdf(fieldName) {
  return (req, res, next) => {
    multerUpload.single(fieldName)(req, res, (err) => {
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

module.exports = { uploadPdf }
