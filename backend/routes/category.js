import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

// 🔹 GET ALL CATEGORIES
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("*");

  if (error) return res.status(500).json({ error });

  res.json(data);
});

export default router;