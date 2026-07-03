const multer = require('multer')

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

module.exports = {
  uploadSignatureFile: handleUpload(signatureUpload, 'Signature image exceeds the 5 MB limit.'),
  uploadHospitalStampFile: handleUpload(hospitalStampUpload, 'Hospital stamp image exceeds the 10 MB limit.'),
}
