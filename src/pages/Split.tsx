import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { DropZone } from '../components/DropZone'
import { splitRGB, splitRGBGuided } from '../lib/imageOps'

type Mode = 'guided' | 'manual'

export default function Split() {
  const [mode, setMode] = useState<Mode>('guided')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!file) return
    setProcessing(true)
    setError(null)
    setResult(null)
    const fn = mode === 'guided' ? splitRGBGuided : splitRGB
    fn(file)
      .then((blob) => {
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
        const url = URL.createObjectURL(blob)
        resultUrlRef.current = url
        setResult(url)
      })
      .catch(() => setError('Could not process image — try another file.'))
      .finally(() => setProcessing(false))
  }, [file, mode])

  useEffect(() => () => { if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current) }, [])

  const filename = file
    ? `${file.name.replace(/\.[^.]+$/, '')}-RGB-48mm${mode === 'guided' ? '-guided' : ''}.png`
    : 'split-RGB-48mm.png'

  return (
    <div className="page">
      <Link to="/" className="back">← back</Link>
      <h1 className="page-title">Split</h1>

      <div className="mode-toggle">
        <button className={`mode-btn${mode === 'guided' ? ' active' : ''}`} onClick={() => setMode('guided')}>
          Guided
        </button>
        <button className={`mode-btn${mode === 'manual' ? ' active' : ''}`} onClick={() => setMode('manual')}>
          Manual
        </button>
      </div>

      {mode === 'guided' && (
        <p className="hint" style={{ marginBottom: 16 }}>
          Adds registration dots — use with Guided unify to auto-reconstruct.
        </p>
      )}

      <DropZone
        file={file}
        onFile={setFile}
        label="Tap to select image"
      />

      {processing && (
        <div className="loading">
          <div className="spinner" />
          Processing…
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}

      {result && !processing && (
        <div className="result">
          <p className="result-label">
            {mode === 'guided'
              ? 'Result — 384 px wide · R / G / B strips · registration dots'
              : 'Result — 384 px wide · R / G / B strips'}
          </p>
          <img src={result} alt="RGB split result" className="result-image" />
          <a href={result} download={filename} className="download-btn">
            ↓ Download PNG
          </a>
        </div>
      )}
    </div>
  )
}
