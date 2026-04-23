import path from 'path'
import multer from 'multer'

const configuredMaxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB)
const maxFileSizeMb = Number.isFinite(configuredMaxFileSizeMb) && configuredMaxFileSizeMb > 0
  ? configuredMaxFileSizeMb
  : 5

function fileFilter(req, file, cb) {
  const allowedPdfMimes = new Set([
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'text/pdf',
    'text/x-pdf',
    'binary/octet-stream',
  ])

  // Some clients send generic or empty MIME types for PDFs, so we prioritize extension.
  const isPdfMime = !file.mimetype || allowedPdfMimes.has(file.mimetype)
  const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf'

  if (!isPdfMime || !isPdfExt) {
    cb(new Error('Only PDF files are allowed'))
    return
  }

  cb(null, true)
}

const uploadResume = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
})

export {
  maxFileSizeMb,
  uploadResume,
}
