import express from "express";
import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";
import { menuLimiter } from "../middleware/rateLimiter.js";
import { isAllowedImageUrl } from "../utils/imageUrl.js";

const router = express.Router();

// GET / is public and unauthenticated, and runs a joined query across
// categories and food_items. It is the same read-heavy catalogue profile as
// /api/food, so it reuses that limiter rather than introducing another one.
router.use(menuLimiter);

// 🔹 GET ALL CATEGORIES
// 🔹 GET ALL CATEGORIES WITH ITEM COUNT
router.get("/", async (req, res) => {
  try {

    const { data: categories, error } = await supabase
      .from("categories")
      .select(`
        *,
        food_items(id)
      `);

    if (error) throw error;


    const formattedCategories = categories.map(category => ({
      ...category,

      total_items: category.food_items
        ? category.food_items.length
        : 0
    }));


    res.json(formattedCategories);


  } catch (error) {

    console.error("Fetch categories error:", error);

    res.status(500).json({
      error: "Failed to fetch categories"
    });

  }
});

// 🔹 ADD CATEGORY
router.post(
  "/",
  authenticate,
  isAdmin,
  async (req, res) => {

    try {

      const { name, image_url } = req.body;

      // Validation
      if (!name || name.trim() === "") {
        return res.status(400).json({
          error: "Category name is required"
        });
      }

      if (!isAllowedImageUrl(image_url)) {
        return res.status(400).json({
          error: "Image URL must be uploaded via /api/upload"
        });
      }


      // Check duplicate category
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", name.trim())
        .single();


      if (existing) {
        return res.status(400).json({
          error: "Category already exists"
        });
      }


      // Insert category
      const { data, error } = await supabase
        .from("categories")
        .insert([
          {
            name: name.trim(),
            image_url
          }
        ])
        .select()
        .single();


      if (error) throw error;


      res.status(201).json({
        success: true,
        message: "Category added successfully",
        category: data
      });


    } catch (error) {

      console.error("Add category error:", error);

      res.status(500).json({
        error: "Failed to add category"
      });

    }

  });

// 🔹 UPDATE CATEGORY
router.put(
  "/:id",
  authenticate,
  isAdmin,
  async (req, res) => {

    try {

      const { id } = req.params;
      const { name, image_url } = req.body;


      // Validation
      if (!name || name.trim() === "") {
        return res.status(400).json({
          error: "Category name required"
        });
      }

      // image_url is only validated when the caller actually sent it --
      // when the field is omitted entirely it stays undefined here, which
      // JSON.stringify drops from the update payload below, leaving the
      // stored value untouched.
      if (image_url !== undefined && !isAllowedImageUrl(image_url)) {
        return res.status(400).json({
          error: "Image URL must be uploaded via /api/upload"
        });
      }


      // Update category
      const { data, error } = await supabase
        .from("categories")
        .update({
          name: name.trim(),
          image_url
        })
        .eq("id", id)
        .select()
        .single();


      // An update matching no row returns zero rows, which .single() reports
      // as PGRST116. That means no category carries this id -- a 404, not the
      // 500 this previously produced. Other error codes still fall through.
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            error: "Category not found"
          });
        }

        throw error;
      }


      res.json({
        success: true,
        message: "Category updated successfully",
        category: data
      });


    } catch (error) {

      console.error(
        "Update category error:",
        error
      );


      res.status(500).json({
        error: "Failed to update category"
      });

    }

  });

// 🔹 DELETE CATEGORY
router.delete(
  "/:id",
  authenticate,
  isAdmin,
  async (req, res) => {

    try {

      const { id } = req.params;


      // Check if category is used by any food item
      const { data: foodItems, error: checkError } =
        await supabase
          .from("food_items")
          .select("id")
          .eq("category_id", id);


      if (checkError) throw checkError;


      if (foodItems && foodItems.length > 0) {

        return res.status(400).json({
          error:
            `Cannot delete category. ${foodItems.length} menu items are using it.`
        });

      }


      // Delete category
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);


      if (error) {

        // 23503 = foreign_key_violation, raised by
        // food_items_category_id_fkey when a menu item still references this
        // category. The check above catches that in the normal case and gives
        // a friendlier message including the count, but it is a separate
        // statement: an item can be created or re-pointed at this category
        // between the check and this delete. The database, not the check, is
        // what actually decides -- reaching here means that race happened,
        // which is a conflict rather than a server fault, and was previously
        // reported as a generic 500.
        if (error.code === "23503") {
          return res.status(409).json({
            error: "Cannot delete category. Menu items are using it."
          });
        }

        throw error;
      }


      res.json({
        success: true,
        message: "Category deleted successfully"
      });


    } catch (error) {

      console.error(
        "Delete category error:",
        error
      );


      res.status(500).json({
        error: "Failed to delete category"
      });

    }

  });

export default router;