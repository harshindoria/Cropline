import multer from 'multer'

const storage = multer.memoryStorage()

// Thrown for a file that is not an allowed image, so the error handler can answer with a 400.
export class InvalidFileTypeError extends Error {
  constructor() {
    super('Only JPEG, PNG, and WebP images are allowed')
    this.name = 'InvalidFileTypeError'
  }
}

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new InvalidFileTypeError())
  }
}

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
})