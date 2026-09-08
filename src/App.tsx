import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

type Analysis = { summary: string; details: string[]; observations: string[]; nextSteps: string[] }
type CatalogItem = { id: string; name: string; category: string; price: string; color: string; image: string; match: number; officialUrl: string; competitor: string; competitorPrice: string }

const catalog: CatalogItem[] = [
  { id: 'rider-01', name: 'No Rules Rider Jacket', category: 'Outerwear', price: '$248', color: 'Black / Bone', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85', match: 96, officialUrl: 'https://store.rockstargames.com/', competitor: 'StyleMarket', competitorPrice: '$279' },
  { id: 'circuit-02', name: 'Circuit 01 Tee', category: 'Tees', price: '$58', color: 'Washed black', image: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=700&q=85', match: 91, officialUrl: 'https://store.rockstargames.com/', competitor: 'StreetSupply', competitorPrice: '$64' },
  { id: 'void-03', name: 'Void Utility Cargo', category: 'Bottoms', price: '$138', color: 'Graphite', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=85', match: 88, officialUrl: 'https://store.rockstargames.com/', competitor: 'Urban Archive', competitorPrice: '$155' },
  { id: 'signal-04', name: 'Signal Runner', category: 'Footwear', price: '$176', color: 'Black / Volt', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85', match: 84, officialUrl: 'https://store.rockstargames.com/', competitor: 'Motion Dept.', competitorPrice: '$189' },
]

const fallbackAnalysis: Analysis = {
  summary: 'A dark streetwear look with a strong utility edge. The visual language reads as hard-wearing, graphic, and built for movement.',
  details: ['Dark outerwear is the dominant silhouette.', 'The composition includes high-contrast panels and a relaxed fit.', 'The overall palette is black, charcoal, and a small electric accent.'],
  observations: ['Exact brand and product identity cannot be confirmed from the photo alone.', 'The closest catalog matches are ranked by silhouette, color, and category.'],
  nextSteps: ['Open a matched item to compare details.', 'Try a closer crop for more precise visual search.'],
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [matches, setMatches] = useState<CatalogItem[]>([])
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  const chooseFile = (selected: File | undefined) => {
    if (!selected || !selected.type.startsWith('image/')) return
    setFile(selected); setAnalysis(null); setMatches([]); setError('')
  }
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])

  const openCamera = async () => {
    setCameraError(''); setIsCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch { setCameraError('Camera access is unavailable. Use upload instead, or allow camera access in your browser.') }
  }
  const closeCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setIsCameraOpen(false) }
  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => { if (blob) chooseFile(new File([blob], `lens-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })); closeCamera() }, 'image/jpeg', .92)
  }

  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true); setError('')
    try {
      const body = new FormData(); body.append('image', file)
      const response = await fetch('/api/analyze', { method: 'POST', body })
      if (!response.ok) throw new Error('API unavailable')
      setAnalysis(await response.json())
    } catch { setAnalysis(fallbackAnalysis); setError('Live model unavailable, so Lens is showing the local catalog match preview.') }
    finally { setMatches(catalog); setIsAnalyzing(false) }
  }

  const downloadReport = () => window.print()

  return <main className="site-shell">
    <nav className="topbar" aria-label="Main navigation"><a className="brand" href="#top" aria-label="Lens home"><span className="brand-mark">R</span><span>ROCKSTAR<br />LENS</span></a><div className="nav-links"><a href="#search">Search</a><a href="#catalog">Catalog</a><a href="#how">How it works</a></div><button className="menu-button" type="button" aria-label="Open menu"><span /><span /></button></nav>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker">Visual search / 001</p><h1>FIND<br /><em>THE</em> SIGNAL.</h1><p className="hero-text">Point at it. Snap it. Know what it is. Rockstar Lens turns the world around you into a searchable catalog.</p><a className="scroll-cue" href="#search"><span>↓</span> Start searching</a></div><div className="hero-art"><div className="hero-grid" /><img src="https://cms-static-prod.ros.rockstargames.com/images/18izrhn535ym/vH3cmDeyYwZAfOSRrFzF7/a647ee83433be34607363ef254639604/vH3cmDeyYwZAfOSRrFzF7.svg" alt="Official Rockstar Games image" /><span className="hero-stamp">OFFICIAL<br />SOURCE<br />ROCKSTAR GAMES</span></div></section>
    <section className="search-section" id="search"><div className="section-intro"><p className="kicker">02 / Lens</p><h2>What are you<br /><em>looking at?</em></h2><p>Upload a photo or use your camera. We’ll read the visual details and surface the closest items in the catalog.</p></div><div className="search-card"><label className={`dropzone ${previewUrl ? 'has-file' : ''}`}>{previewUrl ? <img src={previewUrl} alt="Selected visual search" /> : <><span className="crosshair">◎</span><strong>Drop an image here</strong><small>JPG, PNG, WEBP · up to 15 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} /></label><div className="search-actions"><button className="primary-button" type="button" disabled={!file || isAnalyzing} onClick={analyzeImage}>{isAnalyzing ? 'Reading signal...' : 'Analyze image'} <span>↗</span></button><button className="secondary-button" type="button" onClick={openCamera}>◎ <span>Use camera</span></button></div>{error && <p className="notice">{error}</p>}</div></section>
    <section className="results-section" aria-live="polite"><div className="result-heading"><div><p className="kicker">03 / Match report</p><h2>{analysis ? 'The signal is clear.' : 'Your match report.'}</h2></div>{matches.length > 0 && <button className="report-button" type="button" onClick={downloadReport}>Download PDF ↗</button>}</div>{!analysis ? <div className="empty-readout"><span>+</span><p>Upload or capture a photo to build a related-item report.</p></div> : <><div className="analysis-summary"><p>{analysis.summary}</p><div><span>Visual match</span><strong>CATALOG / LIVE</strong></div></div><div className="match-grid">{matches.map((item) => <article className="match-card" key={item.id}><div className="match-image"><img src={item.image} alt={item.name} /><span>{item.match}% match</span></div><div className="match-info"><div><p>{item.category}</p><h3>{item.name}</h3></div><strong>{item.price}</strong></div><small>{item.color} <span>↗</span></small><div className="price-compare"><span>Official <a href={item.officialUrl} target="_blank" rel="noreferrer">page ↗</a></span><span>{item.competitor}: {item.competitorPrice}</span></div></article>)}</div><p className="report-note">Your PDF includes the image analysis, related items, official links, and price comparisons. On a phone, choose “Save to Files” or “Print to PDF” in the system dialog.</p></>}</section>
    <section className="catalog-section" id="catalog"><div><p className="kicker">04 / The catalog</p><h2>Built for the<br /><em>curious.</em></h2></div><p>Every match gets sharper as the catalog grows. Add your own models, products, or inventory through the API and make Lens yours.</p><button className="outline-button" type="button">Browse all items ↗</button></section>
    <footer id="how"><span>ROCKSTAR LENS / 2026</span><span>See more. Search better.</span></footer>
    {isCameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Camera search"><div className="camera-window"><button className="close-button" type="button" onClick={closeCamera}>×</button><p className="kicker">Live camera</p><h2>Frame the signal.</h2><div className="video-frame">{cameraError ? <p>{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted />}</div><button className="primary-button" type="button" disabled={Boolean(cameraError)} onClick={capturePhoto}>Capture photo <span>◎</span></button></div></div>}
  </main>
}

export default App