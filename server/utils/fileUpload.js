import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'

const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 5)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'resumes'))
  },
  filename(req, file, cb) {
    const safeBase = file.originalname
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9.-]/g, '')

    cb(null, `${Date.now()}-${safeBase}`)
  },
})

function fileFilter(req, file, cb) {
  const isPdfMime = file.mimetype === 'application/pdf'
  const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf'

  if (!isPdfMime || !isPdfExt) {
    cb(new Error('Only PDF files are allowed'))
    return
  }

  cb(null, true)
}

const uploadResume = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
})

export {
  uploadResume,
}
