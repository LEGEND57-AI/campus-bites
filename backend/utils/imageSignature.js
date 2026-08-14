// Content-based image type detection.
//
// multer reports `file.mimetype` straight from the Content-Type the client put
// on the multipart part -- it never looks at the bytes. Trusting it means an
// upload can claim to be image/png while carrying HTML, SVG or anything else.
// These signatures are read from the buffer itself, so the stored extension
// and contentType are derived from what the file actually is.
//
// Deliberately covers only the three formats the upload route allows. A
// general-purpose sniffing library would pull in a dependency tree to detect
// several hundred formats this app has no use for.

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const SIGNATURES = [
  {
    mimeType: "image/jpeg",
    // SOI marker followed by the start of any APPn/marker segment.
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mimeType: "image/png",
    matches: (buffer) =>
      buffer.length >= PNG_SIGNATURE.length &&
      buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
  },
  {
    mimeType: "image/webp",
    // RIFF container whose form type is WEBP. Bytes 4-7 are the chunk size
    // and vary per file, so only the two literals are checked.
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
      buffer.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

/**
 * Returns the detected image MIME type, or null when the bytes are not one of
 * the supported image formats.
 */
export function detectImageMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  for (const signature of SIGNATURES) {
    if (signature.matches(buffer)) {
      return signature.mimeType;
    }
  }

  return null;
}
