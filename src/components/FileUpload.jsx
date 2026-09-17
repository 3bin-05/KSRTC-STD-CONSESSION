import { useState, useRef } from 'react'
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { uploadToCloudinary } from '../lib/cloudinary'

export default function FileUpload({ 
  label = 'Upload Document', 
  helperText = 'PDF, PNG or JPG up to 8MB',
  value, 
  onChange, 
  accept = '.pdf,image/png,image/jpeg,image/webp',
  required = false
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [previewName, setPreviewName] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setPreviewName(file.name)
    setUploading(true)
    setProgress(10)

    try {
      const result = await uploadToCloudinary(file, {
        onProgress: (p) => setProgress(p),
      })
      onChange(result.secure_url || result.url)
    } catch (err) {
      setError(err.message || 'File upload failed. Please try again.')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setPreviewName('')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-[#1F1E1D]">
          {label} {required && <span className="text-[#B3492F]">*</span>}
        </label>
      )}

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border border-dashed rounded-xl p-4 transition-all duration-150 cursor-pointer flex flex-col items-center justify-center text-center ${
          value 
            ? 'border-[#4F7942]/40 bg-[#EFF5ED]/40 hover:bg-[#EFF5ED]/60' 
            : error 
            ? 'border-[#B3492F]/40 bg-[#FAECE8]/30' 
            : 'border-[#E8E4DC] bg-white hover:border-[#D97757]/60 hover:bg-[#FAF8F5]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="w-full py-3 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-[#1F1E1D]">
              <Loader2 className="w-4 h-4 animate-spin text-[#D97757]" />
              <span>Uploading {previewName}... ({progress}%)</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[#E8E4DC] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#D97757] h-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : value ? (
          <div className="flex items-center justify-between w-full py-1 px-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-[#4F7942]/10 flex items-center justify-center flex-shrink-0 text-[#4F7942]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-left truncate">
                <p className="text-sm font-medium text-[#1F1E1D] truncate">
                  {previewName || 'Document Uploaded'}
                </p>
                <a 
                  href={value} 
                  target="_blank" 
                  rel="noreferrer" 
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-[#D97757] hover:underline"
                >
                  View uploaded file
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-[#6B6862] hover:text-[#1F1E1D] hover:bg-[#E8E4DC]/50 transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-2 space-y-1">
            <div className="w-9 h-9 rounded-full bg-[#FAF8F5] border border-[#E8E4DC] flex items-center justify-center mx-auto text-[#6B6862]">
              <UploadCloud className="w-4 h-4 text-[#D97757]" />
            </div>
            <p className="text-sm text-[#1F1E1D] font-medium">
              Click to browse or drop file here
            </p>
            <p className="text-xs text-[#6B6862]">
              {helperText}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-[#B3492F] mt-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
