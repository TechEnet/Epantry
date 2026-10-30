/**
 * Request small, browser-negotiated Cloudinary variants for public food images.
 * Never rewrite non-Cloudinary URLs, private/authenticated assets or signed links.
 * Original URL remains the fallback for those sources.
 */
const DEFAULT_WIDTHS = Object.freeze([320, 480, 720, 960, 1280])

export function publicImageVariant(source, width) {
  const original = typeof source === 'string' ? source : ''
  const target = Number(width)
  if (!original || !Number.isInteger(target) || target < 100 || target > 2560) return original
  try {
    const url = new URL(original)
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
        url.search || url.hash || url.username || url.password) return original
    const marker = '/image/upload/'
    const index = url.pathname.indexOf(marker)
    if (index === -1 || url.pathname.indexOf('/image/authenticated/') !== -1 ||
        url.pathname.indexOf('/image/private/') !== -1) return original
    const remaining = url.pathname.slice(index + marker.length)
    // Signatures and access-controlled delivery must not be rewritten.
    if (!remaining || remaining.includes('s--') || remaining.includes('..') ||
        !/^v[0-9]+\//.test(remaining)) return original
    const transformation = `f_auto,q_auto:good,c_limit,w_${target}`
    url.pathname = `${url.pathname.slice(0, index + marker.length)}${transformation}/${remaining}`
    return url.toString()
  } catch {
    return original
  }
}

export function publicImageProps(source, {
  widths = DEFAULT_WIDTHS,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  loading = 'lazy',
  priority = false,
} = {}) {
  const original = typeof source === 'string' ? source : ''
  const validWidths = [...new Set(widths.filter((value) => Number.isInteger(value) && value >= 100 && value <= 2560))].sort((a,b) => a - b)
  const candidates = validWidths.map((width) => ({ width, url: publicImageVariant(original, width) }))
  const canOptimize = candidates.some((candidate) => candidate.url !== original)
  return {
    src: canOptimize ? candidates[candidates.length - 1].url : original,
    ...(canOptimize ? {
      srcSet: candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', '),
      sizes,
    } : {}),
    loading: priority ? 'eager' : loading,
    decoding: 'async',
    ...(priority ? { fetchPriority: 'high' } : {}),
  }
}
