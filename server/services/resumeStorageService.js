import { Readable } from 'stream'
import { v2 as cloudinary } from 'cloudinary'

let cloudinaryConfigured = false

function buildSafeFilename(originalName) {
  const fallbackName = 'resume.pdf'
  const sourceName = originalName || fallbackName
  const safeBase = sourceName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')

  return `${Date.now()}-${safeBase || fallbackName}`
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET,
  )
}

function assertCloudinaryConfig() {
  if (hasCloudinaryConfig()) {
    return
  }

  throw new Error('Cloudinary configuration is required. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.')
}

function ensureCloudinaryConfigured() {
  assertCloudinaryConfig()

  if (cloudinaryConfigured) {
    return
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })

  cloudinaryConfigured = true
}

async function uploadResumeToCloudinary({ fileBuffer, safeFilename }) {
  ensureCloudinaryConfigured()

  const folder = process.env.CLOUDINARY_RESUME_FOLDER || 'intervueai/resumes'
  const publicId = safeFilename.replace(/\.[^.]+$/, '')

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        public_id: publicId,
        use_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }

        resolve(result)
      },
    )

    Readable.from(fileBuffer).pipe(uploadStream)
  })
}

async function storeResumeFile({ fileBuffer, originalName }) {
  const safeFilename = buildSafeFilename(originalName)

  const result = await uploadResumeToCloudinary({ fileBuffer, safeFilename })

  return {
    fileUrl: result.secure_url || result.url,
    storageProvider: 'cloudinary',
    fileKey: result.public_id,
  }
}

export {
  assertCloudinaryConfig,
  storeResumeFile,
}
