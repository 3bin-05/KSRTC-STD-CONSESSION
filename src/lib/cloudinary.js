/**
 * Cloudinary Direct Unsigned Upload Utility
 * Uploads directly to Cloudinary without exposing API secrets in the frontend.
 * Uses an Unsigned Upload Preset — no server required.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

// True when real Cloudinary credentials are present
const isCloudinaryConfigured = Boolean(
  CLOUD_NAME &&
  CLOUD_NAME !== 'demo' &&
  UPLOAD_PRESET &&
  UPLOAD_PRESET !== 'anavandi_unsigned'
)

export async function uploadToCloudinary(file, { onProgress } = {}) {
  if (!file) {
    throw new Error('No file provided for upload')
  }

  // Validate file type (image or PDF)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Unsupported file type. Please upload a JPG, PNG, WEBP image or PDF document.')
  }

  // Validate size (max 8MB)
  const maxSizeBytes = 8 * 1024 * 1024
  if (file.size > maxSizeBytes) {
    throw new Error('File size exceeds the 8MB limit. Please choose a smaller file.')
  }

  // Demo / local mode: simulate upload with DataURL so the UI still works offline
  if (!isCloudinaryConfigured) {
    console.info('Cloudinary not configured — using local file preview (demo mode).')
    return new Promise((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += 25
        if (onProgress) onProgress(Math.min(progress, 100))
        if (progress >= 100) {
          clearInterval(interval)
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              url: reader.result,
              secure_url: reader.result,
              format: file.type.split('/')[1],
              bytes: file.size,
              original_filename: file.name,
              isMock: true,
            })
          }
          reader.readAsDataURL(file)
        }
      }, 100)
    })
  }

  // Live Cloudinary upload via XHR (supports progress)
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`

    xhr.open('POST', url, true)

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          onProgress(percentComplete)
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response)
        } catch (_e) {
          reject(new Error('Failed to parse Cloudinary response'))
        }
      } else {
        let errMessage = 'Upload to Cloudinary failed'
        try {
          const errRes = JSON.parse(xhr.responseText)
          errMessage = errRes.error?.message || errMessage
        } catch (_e) {
          // keep fallback error message
        }
        reject(new Error(errMessage))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error during file upload. Please check your internet connection.'))
    }

    xhr.send(formData)
  })
}
