/**
 * Convert large, self-hosted EPANTRY photography to WebP using Sharp.
 * Original PNG/JPEG assets are kept, and Vite switches URLs only when the
 * matching WebP exists. No image in the source archive is required to run.
 *
 * Run: npm run optimize:images --workspace=frontend
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const imageFolders = ['hero', 'exploar', 'banners', 'video']
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg'])

async function findImages(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const output = []
  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      output.push(...await findImages(fullPath))
    } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      output.push(fullPath)
    }
  }
  return output
}

const inputs = (await Promise.all(imageFolders.map((folder) => findImages(path.join(publicDir, folder))))).flat()
if (!inputs.length) {
  console.log('[EPANTRY images] No local public photography found. Nothing to optimize.')
} else {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.warn('[EPANTRY images] Sharp is not installed; retaining original images. Install once: npm install -D sharp -w frontend')
  }

  if (sharp) {
    let converted = 0
    let skipped = 0
    let bytesBefore = 0
    let bytesAfter = 0
    for (const source of inputs) {
      const target = source.replace(/\.(png|jpe?g)$/i, '.webp')
      const original = await fs.stat(source)
      const existing = await fs.stat(target).catch(() => null)
      if (existing && existing.mtimeMs >= original.mtimeMs) {
        skipped += 1
        continue
      }

      try {
        const result = await sharp(source, { limitInputPixels: 100_000_000 })
          .rotate()
          .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, effort: 5, smartSubsample: true })
          .toBuffer()
        // A larger WebP is a regression: keep the original asset in use.
        if (result.length >= original.size) {
          await fs.rm(target, { force: true })
          skipped += 1
          continue
        }
        await fs.writeFile(target, result)
        converted += 1
        bytesBefore += original.size
        bytesAfter += result.length
      } catch (error) {
        console.warn(`[EPANTRY images] Could not optimize ${path.relative(publicDir, source)}: ${error.message}`)
        await fs.rm(target, { force: true })
        // Preserve the original if the converter cannot process an asset.
      }
    }
    const saved = bytesBefore ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0
    console.log(`[EPANTRY images] ${converted} WebP generated, ${skipped} up-to-date; ${saved}% transfer savings on converted files (negative means larger).`)
  }
}
