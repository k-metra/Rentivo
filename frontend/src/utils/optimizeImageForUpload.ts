export const MAX_OPTIMIZED_IMAGE_BYTES = 300 * 1024

export async function optimizeImageForUpload(file: File): Promise<File> {
  if (file.size <= MAX_OPTIMIZED_IMAGE_BYTES) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`Unable to process "${file.name}". Try another image file.`)
  }

  try {
    const canvas = document.createElement('canvas')
    const initialScale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
    let width = Math.max(1, Math.round(bitmap.width * initialScale))
    let height = Math.max(1, Math.round(bitmap.height * initialScale))
    let quality = 0.82

    for (let attempt = 0; attempt < 24; attempt += 1) {
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Unable to prepare photos for upload.')
      context.drawImage(bitmap, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', quality)
      })
      if (!blob || blob.type !== 'image/webp') {
        throw new Error('Your browser could not optimize this image. Try a recent browser or a smaller photo.')
      }
      if (blob.size <= MAX_OPTIMIZED_IMAGE_BYTES) {
        const name = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`
        return new File([blob], name, { type: 'image/webp' })
      }

      if (quality > 0.52) {
        quality = Math.max(0.52, quality - 0.1)
      } else if (Math.max(width, height) > 640) {
        width = Math.max(1, Math.round(width * 0.8))
        height = Math.max(1, Math.round(height * 0.8))
        quality = 0.76
      } else if (quality > 0.36) {
        quality = Math.max(0.36, quality - 0.08)
      } else {
        break
      }
    }

    throw new Error(`"${file.name}" could not be reduced enough to upload. Try a smaller photo.`)
  } finally {
    bitmap.close()
  }
}
