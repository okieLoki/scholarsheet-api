import { v2 as cloudinary } from "cloudinary";
import { config } from "../../config";
import { l } from "../../config/logger";

export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(filePath: string, folder: string): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: "auto",
        folder: folder,
      });
      return result.secure_url;
    } catch (error) {
      l.error("Error uploading file to Cloudinary:", error);
      throw new Error("Failed to upload file to Cloudinary");
    }
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      l.error("Error deleting file from Cloudinary:", error);
      throw new Error("Failed to delete file from Cloudinary");
    }
  }

  getPublicIdFromUrl(url: string): string {
    const splitUrl = url.split("/");
    const filenameWithExtension = splitUrl[splitUrl.length - 1];
    const publicId = filenameWithExtension.split(".")[0];
    return publicId;
  }
}

const cloudinaryService = new CloudinaryService();
export { cloudinaryService };
