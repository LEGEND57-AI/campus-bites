import express from "express";
import multer from "multer";
import crypto from "crypto";

import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

// 🔥 IMAGE UPLOAD
router.post(
  "/",
  authenticate,
  isAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: "Only JPG, PNG and WEBP images are allowed",
        });
      }



      const extension = file.mimetype.split("/")[1];

      const fileName = `food-${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { data, error } = await supabase.storage
        .from("food-image")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) {
        return res.status(500).json({ error: error.message });
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