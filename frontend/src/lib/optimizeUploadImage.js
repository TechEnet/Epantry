/**
 * Optimize an allowed listing photo before the existing signed Cloudinary upload.
 * Images still travel directly from the browser to Cloudinary; this does not
 * change upload signatures, API permissions, or product-evidence metadata.
 */
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function encodeWebp(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw(context, width, height) {
        context.drawImage(bitmap, 0, 0, width, height)
      },
      close() {
        bitmap.close?.()
      },
    }
  }

  // Safari/older browser fallback; the signed upload remains unchanged.
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('Cannot read this image.'))
      image.src = objectUrl
    })
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw(context, width, height) {
        context.drawImage(image, 0, 0, width, height)
      },
      close() {},
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * @param {File} file - Original JPEG, PNG or WebP.
 * @param {object} options - Recommended maximum dimensions/size per listing type.
 * @returns {Promise<File>} Smaller WebP, or unchanged original on unsafe/unsupported conversion.
 */
export async function optimizeUploadImage(file, {
  maxEdge = 2200,
  targetBytes = 900 * 1024,
} = {}) {
  if (!file || !SUPPORTED_TYPES.has(file.type) || file.size < 110 * 1024) {
    return file
  }

  // This helper is only called in the browser; never require Sharp in React.
  if (typeof document === 'undefined' || typeof File === 'undefined') {
    return file
  }

  let decoded
  try {
    decoded = await decodeImage(file)
    if (!decoded.width || !decoded.height) return file

    // Avoid allocating very large canvases or exhausting mobile device memory.
    const safeEdge = Math.max(640, Math.min(3000, Math.floor(maxEdge)))
    const initialScale = Math.min(1, safeEdge / Math.max(decoded.width, decoded.height))
    let width = Math.max(1, Math.round(decoded.width * initialScale))
    let height = Math.max(1, Math.round(decoded.height * initialScale))
    let best = null

    for (let pass = 0; pass < 4; pass += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) break
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      decoded.draw(context, width, height)

      for (const quality of [0.86, 0.8, 0.74]) {
        const blob = await encodeWebp(canvas, quality)
        // Some browsers silently export PNG if WebP encoding is unavailable.
        if (!blob || blob.type !== 'image/webp') continue
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= targetBytes && blob.size < file.size) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
            type: 'image/webp',
            lastModified: file.lastModified,
          })
        }
      }

      width = Math.max(1, Math.round(width * 0.83))
      height = Math.max(1, Math.round(height * 0.83))
    }

    // Never make uploads larger, and never discard an otherwise valid original.
    if (best && best.size < file.size) {
      return new File([best], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
        type: 'image/webp',
        lastModified: file.lastModified,
      })
    }
    return file
  } catch {
    // Conversion failure must not break an upload that already worked.
    return file
  } finally {
    decoded?.close()
  }
}
