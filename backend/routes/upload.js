import express from "express";
import multer from "multer";
import { supabase } from "../db.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 🔥 IMAGE UPLOAD
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = `food-${Date.now()}-${file.originalname}`;

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