import { maxFileSizeMb, uploadResume } from './fileUpload.js'

function handleResumeUpload(req, res, next) {
  uploadResume.single('resume')(req, res, (error) => {
    if (!error) {
      next()
      return
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400)
      next(new Error(`Resume file is too large. Please upload a PDF up to ${maxFileSizeMb} MB.`))
      return
    }

    if (error.message === 'Only PDF files are allowed') {
      res.status(400)
      next(error)
      return
    }

    res.status(400)
    next(new Error('Resume upload failed. Please upload a valid PDF and try again.'))
  })
}

export {
  handleResumeUpload,
}
