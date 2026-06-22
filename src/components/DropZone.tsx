import { useRef, useState, useEffect } from 'react'

interface DropZoneProps {
  file: File | null
  onFile: (file: File) => void
  accept?: string
  label?: string
  borderColor?: string
}

export function DropZone({ file, onFile, accept = 'image/*', label = 'Tap to select', borderColor }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div
      className={`dropzone${dragOver ? ' drag-over' : ''}`}
      style={borderColor ? { borderColor } : undefined}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      {previewUrl ? (
        <img src={previewUrl} alt="" className="dropzone-preview" />
      ) : (
        <div className="dropzone-empty">
          <UploadIcon />
          <span>{label}</span>
        </div>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
