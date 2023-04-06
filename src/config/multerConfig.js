import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5242880 },
  fileFilter: (req, file, callback) => {
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/gif'
    ) {
      const fileSize = parseInt(req.headers['content-length']);
      if (fileSize > 5242880) {
        return callback(
          new Error('File size too large maximum size should be 5mb')
        );
      }
      return callback(null, true);
    } else {
      return callback(new Error('Allowed only .png, .jpg, .jpeg and .gif'));
    }
  },
  onError: function (err, next) {
    next(err);
  },
});