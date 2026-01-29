const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads an image buffer to Cloudinary
 * @param {Buffer} fileBuffer - The image file buffer from Multer
 * @param {String} folder - Optional folder name in Cloudinary
 * @returns {Promise<String>} - The secure URL of the uploaded image
 */
const uploadImage = async (fileBuffer, folder = 'postair_uploads') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto', // Automatically detect image/png/jpg
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );

    // Write the buffer to the stream
    uploadStream.end(fileBuffer);
  });
};

module.exports = { uploadImage };