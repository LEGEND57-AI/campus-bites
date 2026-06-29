import express from "express";
import { supabase } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/admin.js";

const router = express.Router();

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


      if (error) throw error;


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


      if (error) throw error;


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