import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

type ComplianceItem = { label: string; status: 'PASS' | 'FAIL' | 'REVIEW'; value: string; confidence: string }
type Analysis = { provider?: string; productName: string; category: string; brand: string; summary: string; compliance: ComplianceItem[]; health: { ingredients: string[]; nutriScore: string; allergens: string[]; additives: string[] }; technology: { specifications: string[] }; market: { observedPrice: string; pricePerUnit: string; brandVerification: string; comparisons: { seller: string; price: string; unitPrice: string }[]; recommendations: string[] }; report: { findings: string[]; actions: string[] } }
type Language = 'English' | 'தமிழ்' | 'हिन्दी'

const copy: Record<Language, { inspect: string; upload: string; camera: string; analyze: string; report: string; voice: string; unavailable: string }> = {
  English: { inspect: 'Inspect a packaged product', upload: 'Upload label image', camera: 'Camera scan', analyze: 'Detect and validate', report: 'Mission intel report', voice: 'Read report aloud', unavailable: 'Live model unavailable. Check the server provider keys.' },
  'தமிழ்': { inspect: 'பொருள் லேபிளை ஆய்வு செய்க', upload: 'லேபிள் படத்தை பதிவேற்றவும்', camera: 'கேமரா ஸ்கேன்', analyze: 'கண்டறிந்து சரிபார்க்கவும்', report: 'ஆய்வு அறிக்கை', voice: 'அறிக்கையை வாசிக்கவும்', unavailable: 'நேரடி AI கிடைக்கவில்லை. சர்வர் API அமைப்புகளை சரிபார்க்கவும்.' },
  'हिन्दी': { inspect: 'पैक किए गए उत्पाद की जांच', upload: 'लेबल इमेज अपलोड करें', camera: 'कैमरा स्कैन', analyze: 'पता लगाएं और सत्यापित करें', report: 'मिशन इंटेल रिपोर्ट', voice: 'रिपोर्ट सुनें', unavailable: 'लाइव AI उपलब्ध नहीं है। सर्वर API कुंजी जांचें।' },
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [language, setLanguage] = useState<Language>('English')
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const text = copy[language]

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return }
    const url = URL.createObjectURL(file); setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  const chooseFile = (selected: File | undefined) => {
    if (!selected || !selected.type.startsWith('image/')) { setError('Please choose a JPG, PNG, or WEBP label image.'); return }
    setFile(selected); setAnalysis(null); setError('')
  }
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])
  const openCamera = async () => {
    setCameraError(''); setIsCameraOpen(true)
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream } catch { setCameraError('Camera access is unavailable. Use upload instead, or allow camera access in your browser.') }
  }
  const closeCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setIsCameraOpen(false) }
  const capturePhoto = () => {
    const video = videoRef.current; if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => { if (blob) chooseFile(new File([blob], `label-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })); closeCamera() }, 'image/jpeg', .92)
  }
  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true); setError('')
    try { const body = new FormData(); body.append('image', file); const response = await fetch('/api/analyze', { method: 'POST', body }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || text.unavailable); setAnalysis(payload) } catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : text.unavailable) } finally { setIsAnalyzing(false) }
  }
  const score = useMemo(() => { if (!analysis?.compliance.length) return 0; return Math.round((analysis.compliance.filter((item) => item.status === 'PASS').length / analysis.compliance.length) * 100) }, [analysis])
  const reportText = useMemo(() => {
    if (!analysis) return ''
    return `${text.report}. ${analysis.productName}, ${analysis.category}, brand ${analysis.brand}. Compliance score ${score} percent. ${analysis.summary} Findings: ${analysis.report.findings.join('. ')} Actions: ${analysis.report.actions.join('. ')} Market recommendation: ${analysis.market.recommendations.join('. ')}`
  }, [analysis, score, text.report])
  const speakReport = async () => {
    if (!reportText) return
    setIsSpeaking(true); setError('')
    try { const response = await fetch('/api/voice-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: reportText, language }) }); if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || 'Voice report unavailable.') }; const audio = new Audio(URL.createObjectURL(await response.blob())); audio.onended = () => setIsSpeaking(false); await audio.play() } catch (reason) { setIsSpeaking(false); setError(reason instanceof Error ? reason.message : 'Voice report unavailable.') }
  }

  return <main className="site-shell">
    <nav className="topbar"><a className="brand" href="#top"><span className="brand-mark">R</span><span>ROCKSTAR<br />LENS</span></a><div className="nav-links"><a href="#scan">Scan</a><a href="#validator">Validator</a><a href="#intel">Intel</a></div><label className="language-select"><span>LANG</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Language"><option>English</option><option>தமிழ்</option><option>हिन्दी</option></select></label></nav>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker">SIH26034 / Mission control</p><h1>READ<br /><em>THE</em> LABEL.</h1><p className="hero-text">AI-powered packaged commodity inspection for safer choices, clearer labels, and smarter price decisions.</p><a className="scroll-cue" href="#scan"><span>↓</span> Launch scanner</a></div><div className="hero-art"><div className="hero-grid" /><img className="rockstar-hero-image" src="https://cms-static-prod.ros.rockstargames.com/images/18izrhn535ym/vH3cmDeyYwZAfOSRrFzF7/a647ee83433be34607363ef254639604/vH3cmDeyYwZAfOSRrFzF7.svg" alt="Rockstar Games logo" /><span className="hero-stamp">DETECT<br />VALIDATE<br />ANALYZE</span></div></section>
    <section className="mission-strip"><span>01 / Detect</span><span>02 / Validate</span><span>03 / Analyze</span><span>04 / Report</span></section>
    <section className="search-section" id="scan"><div className="section-intro"><p className="kicker">01 / Hybrid scanner</p><h2>{text.inspect}</h2><p>Use a clear front or back label. Lens combines OCR, barcode or QR evidence, and vision reasoning. No product claim is invented when the label is unclear.</p><div className="mode-pills"><span>CAMERA</span><span>IMAGE</span><span>OCR + QR</span></div></div><div className="search-card"><label className={`dropzone ${previewUrl ? 'has-file' : ''}`}>{previewUrl ? <img src={previewUrl} alt="Selected commodity label" /> : <><span className="crosshair">◎</span><strong>{text.upload}</strong><small>JPG, PNG, WEBP · up to 15 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} /></label><div className="search-actions"><button className="primary-button" type="button" disabled={!file || isAnalyzing} onClick={analyzeImage}>{isAnalyzing ? 'Reading label...' : text.analyze}<span>↗</span></button><button className="secondary-button" type="button" onClick={openCamera}>◎ <span>{text.camera}</span></button></div>{error && <p className="notice">{error}</p>}</div></section>
    <section className="results-section" id="validator" aria-live="polite"><div className="result-heading"><div><p className="kicker">02 / {text.report}</p><h2>{analysis ? analysis.productName : 'Your mission readout.'}</h2></div>{analysis && <div className="result-actions"><button className="report-button" type="button" onClick={() => window.print()}>2-page PDF ↗</button><button className="voice-button" type="button" onClick={speakReport} disabled={isSpeaking}>{isSpeaking ? 'Speaking...' : `◉ ${text.voice}`}</button></div>}</div>{!analysis ? <div className="empty-readout"><span>+</span><p>Upload or capture a label to start Detect → Validate → Analyze → Report.</p></div> : <><div className="analysis-summary"><div><p>{analysis.summary}</p><small>{analysis.category} / {analysis.brand}</small></div><div className="score"><span>Compliance score</span><strong>{score}%</strong><small>{analysis.provider || 'AI'} inspection</small></div></div><div className="compliance-grid">{analysis.compliance.map((item) => <article className={`check-card ${item.status.toLowerCase()}`} key={item.label}><div><span>{item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '×' : '?'}</span><h3>{item.label}</h3></div><strong>{item.status}</strong><p>{item.value}</p><small>{item.confidence} confidence</small></article>)}</div><div className="intel-grid" id="intel"><article><p className="kicker">03 / Health + tech intelligence</p><h3>What is inside?</h3><p><b>Nutri-Score:</b> {analysis.health.nutriScore}</p><p><b>Ingredients:</b> {analysis.health.ingredients.join(', ') || 'Not visible'}</p><p><b>Allergens:</b> {analysis.health.allergens.join(', ') || 'None detected'}</p><p><b>Additives:</b> {analysis.health.additives.join(', ') || 'None detected'}</p><p><b>Specifications:</b> {analysis.technology.specifications.join(', ') || 'Not applicable'}</p></article><article><p className="kicker">04 / Market intelligence</p><h3>Price signal</h3><p><b>Observed MRP:</b> {analysis.market.observedPrice}</p><p><b>Price per unit:</b> {analysis.market.pricePerUnit}</p><p><b>Brand check:</b> {analysis.market.brandVerification}</p>{analysis.market.comparisons.map((item) => <p className="compare-line" key={`${item.seller}-${item.price}`}><span>{item.seller}</span><b>{item.price} · {item.unitPrice}</b></p>)}{analysis.market.recommendations.map((item) => <p className="recommendation" key={item}>↳ {item}</p>)}</article></div><div className="report-block"><div><p className="kicker">05 / Action brief</p><h3>Mission findings</h3>{analysis.report.findings.map((item) => <p key={item}>• {item}</p>)}</div><div><h3>Next actions</h3>{analysis.report.actions.map((item) => <p key={item}>→ {item}</p>)}</div></div></>}</section>
    <section className="catalog-section"><div><p className="kicker">06 / Built for India</p><h2>Clarity<br /><em>at scale.</em></h2></div><p>Multilingual AI mission control for consumers, inspectors, retailers, and administrators. Every report keeps uncertainty visible and every decision traceable.</p><div className="feature-list"><span>MRP + quantity</span><span>Expiry tracking</span><span>Voice reports</span><span>Admin ready</span></div></section>
    <footer><span>ROCKSTAR LENS / SIH26034</span><span>Detect. Validate. Analyze. Report.</span></footer>
    {isCameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Camera scan"><div className="camera-window"><button className="close-button" type="button" onClick={closeCamera}>×</button><p className="kicker">Live hybrid scanner</p><h2>Frame the label.</h2><div className="video-frame">{cameraError ? <p>{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted />}</div><button className="primary-button" type="button" disabled={Boolean(cameraError)} onClick={capturePhoto}>Capture label <span>◎</span></button></div></div>}
  </main>
}

export default App