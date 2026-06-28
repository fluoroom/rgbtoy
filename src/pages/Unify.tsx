import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { DropZone } from '../components/DropZone'
import { unifyRGB, unifyRGBGuided } from '../lib/imageOps'

type Mode = 'guided' | 'manual'

export default function Unify() {
  const [mode, setMode] = useState<Mode>('guided')

  // Guided mode: single photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  // Manual mode: three strips
  const [rFile, setRFile] = useState<File | null>(null)
  const [gFile, setGFile] = useState<File | null>(null)
  const [bFile, setBFile] = useState<File | null>(null)

  const [result, setResult] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  // Guided mode effect
  useEffect(() => {
    if (mode !== 'guided' || !photoFile) return
    setProcessing(true)
    setError(null)
    setResult(null)
    unifyRGBGuided(photoFile)
      .then((blob) => {
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
        const url = URL.createObjectURL(blob)
        resultUrlRef.current = url
        setResult(url)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Could not process image — try again.'
        setError(msg)
      })
      .finally(() => setProcessing(false))
  }, [photoFile, mode])

  // Manual mode effect
  useEffect(() => {
    if (mode !== 'manual' || !rFile || !gFile || !bFile) return
    setProcessing(true)
    setError(null)
    setResult(null)
    unifyRGB(rFile, gFile, bFile)
      .then((blob) => {
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
        const url = URL.createObjectURL(blob)
        resultUrlRef.current = url
        setResult(url)
      })
      .catch(() => setError('Could not combine images — try again.'))
      .finally(() => setProcessing(false))
  }, [rFile, gFile, bFile, mode])

  useEffect(() => () => { if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current) }, [])

  const allSet = rFile && gFile && bFile
  const noneSet = !rFile && !gFile && !bFile

  return (
    <div className="page">
      <Link to="/" className="back">← back</Link>
      <h1 className="page-title">Unify</h1>

      <div className="mode-toggle">
        <button className={`mode-btn${mode === 'guided' ? ' active' : ''}`} onClick={() => setMode('guided')}>
          Guided
        </button>
        <button className={`mode-btn${mode === 'manual' ? ' active' : ''}`} onClick={() => setMode('manual')}>
          Manual
        </button>
      </div>

      {mode === 'guided' ? (
        <>
          <p className="hint" style={{ marginBottom: 16 }}>
            Upload a photo of the full guided print. Frame the shot to include just the print — auto-detects R / G / B strips.
          </p>
          <DropZone
            file={photoFile}
            onFile={setPhotoFile}
            label="Photo of guided print"
          />
        </>
      ) : (
        <>
          <div className="rgb-zones">
            <div>
              <p className="rgb-zone-label" style={{ color: 'var(--r)' }}>R</p>
              <DropZone file={rFile} onFile={setRFile} borderColor="var(--r)" label="R strip" />
            </div>
            <div>
              <p className="rgb-zone-label" style={{ color: 'var(--g)' }}>G</p>
              <DropZone file={gFile} onFile={setGFile} borderColor="var(--g)" label="G strip" />
            </div>
            <div>
              <p className="rgb-zone-label" style={{ color: 'var(--b)' }}>B</p>
              <DropZone file={bFile} onFile={setBFile} borderColor="var(--b)" label="B strip" />
            </div>
          </div>

          {noneSet && (
            <p className="hint">
              Upload photos of your 3 printed strips (R, G, B) to combine them into a color image.
            </p>
          )}

          {!allSet && !noneSet && (
            <p className="hint">
              {[!rFile && 'R', !gFile && 'G', !bFile && 'B'].filter(Boolean).join(', ')} still missing.
            </p>
          )}
        </>
      )}

      {processing && (
        <div className="loading">
          <div className="spinner" />
          {mode === 'guided' ? 'Detecting strips…' : 'Combining…'}
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}

      {result && !processing && (
        <div className="result">
          <p className="result-label">Result</p>
          <img src={result} alt="unified color result" className="result-image" />
          <a href={result} download="unified-color.png" className="download-btn">
            ↓ Download PNG
          </a>
        </div>
      )}
    </div>
  )
}
