import path from 'path'
import multer from 'multer'

const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 5)

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
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
})

export {
  uploadResume,
}
