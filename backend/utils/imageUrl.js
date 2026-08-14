// Restricts food/category image URLs to this project's own Supabase Storage.
//
// admin.js and category.js accepted image_url straight from req.body with no
// validation at all. The only intended source is /api/upload, which always
// returns a Supabase Storage public URL -- every row in production already
// matches that shape (verified by direct query before this change). Nothing
// server-side ever fetches this URL (it is stored and returned as an opaque
// string), so the risk it closes is third-party resource loading /
// tracking-pixel style abuse and UI defacement via an admin-set external URL,
// not SSRF.
export function isAllowedImageUrl(url) {
  // Unset is fine -- callers fall back to a local placeholder image.
  if (url === undefined || url === null || url === "") {
    return true;
  }

  if (typeof url !== "string") {
    return false;
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const supabaseOrigin = new URL(process.env.SUPABASE_URL).origin;

  return parsed.origin === supabaseOrigin;
}
