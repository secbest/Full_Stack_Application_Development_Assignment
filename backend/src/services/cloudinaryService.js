const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Uploads a vendor invoice PDF as a raw asset and returns its public URL.
// resource_type 'raw' is required for non-image files like PDFs.
function uploadPdf(buffer, originalName) {
  return new Promise((resolve, reject) => {
    const publicId = originalName
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 100)

    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'vendor-invoices', public_id: publicId, format: 'pdf' },
      (err, result) => {
        if (err) return reject(err)
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

module.exports = { uploadPdf }
