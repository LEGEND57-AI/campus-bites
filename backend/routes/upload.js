import express from "express";
import multer from "multer";
import crypto from "crypto";

import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import { detectImageMimeType } from "../utils/imageSignature.js";

const router = express.Router();

router.use(uploadLimiter);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// multer signals a rejected upload by calling next(err). Without this the
// 2MB limit still stopped the upload, but the error fell through to the
// global handler and was reported as a generic 500 rather than telling the
// caller what was wrong. Only multer's own errors are translated here;
// anything else still propagates so genuine faults remain 500s.
function handleFileUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "Image must be 2MB or smaller",
        });
      }

      return res.status(400).json({
        error: "Invalid file upload",
      });
    }

    return next(err);
  });
}

// 🔥 IMAGE UPLOAD
router.post(
  "/",
  authenticate,
  isAdmin,
  handleFileUpload,
  async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Decided by the file's own bytes, never by the client-supplied
      // Content-Type, which can claim anything.
      const detectedType = detectImageMimeType(file.buffer);

      if (!detectedType) {
        return res.status(400).json({
          error: "Only JPG, PNG and WEBP images are allowed",
        });
      }

      // A client that declares one supported image type while sending the
      // bytes of another is mislabelling deliberately -- a browser never does
      // this. Declared types outside the allowlist (image/jpg,
      // application/octet-stream and similar) are simply ignored in favour of
      // the detected type, so honest-but-imprecise clients still work.
      if (
        ALLOWED_IMAGE_TYPES.includes(file.mimetype) &&
        file.mimetype !== detectedType
      ) {
        return res.status(400).json({
          error: "Only JPG, PNG and WEBP images are allowed",
        });
      }

      // Derived from the detected type so a forged Content-Type cannot
      // influence what gets written to storage. For a genuine upload this
      // produces exactly the same extension as before.
      const extension = detectedType.split("/")[1];

      const fileName = `food-${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { data, error } = await supabase.storage
        .from("food-image")
        .upload(fileName, file.buffer, {
          contentType: detectedType,
        });

      if (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: "Failed to upload image" });
      }

      // 🔥 PUBLIC URL
      const { data: publicUrl } = supabase.storage
        .from("food-image")
        .getPublicUrl(fileName);

      res.json({ url: publicUrl.publicUrl });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

export default router;