import multer from 'multer';

// 1. Storage Configuration: Hold the file in RAM (Memory) temporarily
const storage = multer.memoryStorage();

// 2. File Filter: Security check to ensure only images are uploaded
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check if the uploaded file's mime type starts with 'image/'
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accept the file
  } else {
    // Reject the file if it is a PDF, video, or malicious script
    cb(new Error('Invalid file type. Only image files are allowed.'));
  }
};

// 3. Main Upload Instance
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max file size limit to prevent server overload
  },
});