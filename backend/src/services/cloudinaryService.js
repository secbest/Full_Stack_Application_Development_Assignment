const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Uploads an in-memory buffer (from multer's memoryStorage) to Cloudinary and resolves
// with the upload result. Wraps the SDK's stream-based API in a Promise so controllers
// can just `await` it instead of dealing with callbacks.
function uploadBuffer(buffer, { folder }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
    stream.end(buffer)
  })
}

module.exports = { uploadBuffer }
