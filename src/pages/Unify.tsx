import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { DropZone } from '../components/DropZone'
import { unifyRGB } from '../lib/imageOps'

export default function Unify() {
  const [rFile, setRFile] = useState<File | null>(null)
  const [gFile, setGFile] = useState<File | null>(null)
  const [bFile, setBFile] = useState<File | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!rFile || !gFile || !bFile) return
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
  }, [rFile, gFile, bFile])

  useEffect(() => () => { if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current) }, [])

  const allSet = rFile && gFile && bFile
  const noneSet = !rFile && !gFile && !bFile

  return (
    <div className="page">
      <Link to="/" className="back">← back</Link>
      <h1 className="page-title">Unify</h1>

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

      {processing && (
        <div className="loading">
          <div className="spinner" />
          Combining…
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
