import cloudinary from "../config/cloudinary";
import streamifier from 'streamifier';

export const uploadToCloudinary = (fileBuffer : Buffer , folderName : string) : Promise<string> => {
    return new Promise((resolve,reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {folder : folderName},
            (error,result) => {
                if (error) return reject(error)
                if (!result?.secure_url) return reject(new Error('Cloudinary upload failed — no URL returned'))
                resolve(result.secure_url)
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
}