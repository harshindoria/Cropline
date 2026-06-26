import cloudinary from "../config/cloudinary";
import streamifier from 'streamifier';

export const uploadToCloudinary = (fileBuffer : Buffer , folderName : string) : Promise<string> => {
    return new Promise((resolve,reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {folder : folderName},
            (error,result) => {
                if(result)resolve(result.secure_url);
                else reject(error);
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
}