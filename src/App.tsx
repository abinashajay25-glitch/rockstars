import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { jsPDF } from 'jspdf'
import './App.css'

type ComplianceItem = { label: string; status: 'PASS' | 'FAIL' | 'REVIEW'; value: string; confidence: string }
type Analysis = {
  provider?: string; pipeline?: string; productName: string; category: string; brand: string; summary: string
  visionPipeline?: { cnn: { status: string; labelDetected: boolean; legibility: string; regions: string[]; notes: string[] }; ocr: { status: string; text: string; fieldsDetected: string[] }; aiVision: { status: string; evidence: string[]; reasoning: string } }

  barcodeInfo: { detected: boolean; value: string; productName: string; brand: string; category: string; status: string }
  qrInfo: { detected: boolean; content: string; type: string; verificationStatus: string }
  extractedInfo: Record<string, string | string[]>
  complianceStatus: 'COMPLIANT' | 'NEEDS_REVIEW' | 'NON_COMPLIANT'; complianceScore: number | null; aiConfidence: Record<string, string>
  compliance: ComplianceItem[]; violations: { name: string; reason: string; confidence: string }[]; warnings: string[]
  health: { ingredients: string[]; nutriScore: string; allergens: string[]; additives: string[] }
  technology: { specifications: string[] }
  market: { observedPrice: string; pricePerUnit: string; brandVerification: string; comparisons: { seller: string; price: string; unitPrice: string }[]; recommendations: string[] }
  report: { findings: string[]; actions: string[] }
}
type Language = 'English' | 'தமிழ்' | 'हिन्दी'
type ScanHistoryItem = { id: string; productName: string; timestamp: string; score: number; status: Analysis['complianceStatus']; violations: string[]; analysis: Analysis }

type Copy = { navScan: string; navValidator: string; navIntel: string; lang: string; kicker: string; heroText: string; launch: string; detect: string; validate: string; analyze: string; report: string; inspect: string; scannerText: string; camera: string; upload: string; analyzeButton: string; reading: string; reportEmpty: string; start: string; pdf: string; voice: string; speaking: string; unavailable: string; cameraError: string; capture: string; inside: string; healthTech: string; market: string; price: string; clarity: string; scale: string; catalogText: string }
const copy: Record<Language, Copy> = {
  English: { navScan: 'Scan', navValidator: 'Validator', navIntel: 'Intel', lang: 'LANG', kicker: 'MISSION PASSED / RESPECT +99', heroText: 'AI-powered packaged commodity inspection for safer choices, clearer labels, and smarter price decisions.', launch: 'Launch scanner', detect: 'Detect', validate: 'Validate', analyze: 'Analyze', report: 'Report', inspect: 'Inspect a packaged product', scannerText: 'Use a clear front or back label. Lens combines OCR, barcode or QR evidence, and vision reasoning. No product claim is invented when the label is unclear.', camera: 'Camera scan', upload: 'Upload label image', analyzeButton: 'Detect and validate', reading: 'Reading label...', reportEmpty: 'Your mission readout.', start: 'Upload or capture a label to start Detect → Validate → Analyze → Report.', pdf: 'View report ↗', voice: 'Read report aloud', speaking: 'Speaking...', unavailable: 'Live model unavailable. Check the server provider keys.', cameraError: 'Camera access is unavailable. Use upload instead, or allow camera access in your browser.', capture: 'Capture label', inside: 'What is inside?', healthTech: 'Health + tech intelligence', market: 'Market intelligence', price: 'Price signal', clarity: 'Clarity', scale: 'at scale.', catalogText: 'Multilingual AI analysis for consumers, inspectors, retailers, and administrators. Every report keeps uncertainty visible and every decision traceable.' },
  'தமிழ்': { navScan: 'ஸ்கேன்', navValidator: 'சரிபார்ப்பு', navIntel: 'தகவல்', lang: 'மொழி', kicker: 'பணி நிறைவு / மரியாதை +99', heroText: 'பாதுகாப்பான தேர்வுகள், தெளிவான லேபிள்கள் மற்றும் சிறந்த விலை முடிவுகளுக்கான AI பொருள் ஆய்வு.', launch: 'ஸ்கேனரைத் தொடங்கு', detect: 'கண்டறி', validate: 'சரிபார்', analyze: 'ஆய்வு', report: 'அறிக்கை', inspect: 'தொகுக்கப்பட்ட பொருளை ஆய்வு செய்க', scannerText: 'தெளிவான முன் அல்லது பின் லேபிளைப் பயன்படுத்தவும். OCR, பார்கோடு அல்லது QR தகவல் மற்றும் பட பகுப்பாய்வை Lens இணைக்கிறது. லேபிள் தெளிவில்லையெனில் எந்தக் கூற்றையும் உருவாக்காது.', camera: 'கேமரா ஸ்கேன்', upload: 'லேபிள் படத்தைப் பதிவேற்றவும்', analyzeButton: 'கண்டறிந்து சரிபார்', reading: 'லேபிளைப் படிக்கிறது...', reportEmpty: 'உங்கள் ஆய்வு அறிக்கை.', start: 'லேபிளைப் பதிவேற்றி அல்லது படம் எடுத்து Detect → Validate → Analyze → Report தொடங்கவும்.', pdf: 'அறிக்கையைப் பார்க்க ↗', voice: 'அறிக்கையை வாசிக்கவும்', speaking: 'வாசிக்கிறது...', unavailable: 'நேரடி AI கிடைக்கவில்லை. சர்வர் API அமைப்புகளைச் சரிபார்க்கவும்.', cameraError: 'கேமரா அணுகல் இல்லை. பதிவேற்றத்தைப் பயன்படுத்தவும் அல்லது உலாவியில் அனுமதிக்கவும்.', capture: 'லேபிளைப் படம் எடு', inside: 'உள்ளே என்ன உள்ளது?', healthTech: 'ஆரோக்கியம் + தொழில்நுட்ப தகவல்', market: 'சந்தை தகவல்', price: 'விலை குறிப்பு', clarity: 'தெளிவு', scale: 'அளவில்.', catalogText: 'நுகர்வோர், ஆய்வாளர்கள், விற்பனையாளர்கள் மற்றும் நிர்வாகிகளுக்கான பன்மொழி AI ஆய்வு. ஒவ்வொரு அறிக்கையும் நிச்சயமின்மையை வெளிப்படையாகக் காட்டும்.' },
  'हिन्दी': { navScan: 'स्कैन', navValidator: 'सत्यापन', navIntel: 'जानकारी', lang: 'भाषा', kicker: 'मिशन पूरा / सम्मान +99', heroText: 'सुरक्षित विकल्पों, स्पष्ट लेबल और बेहतर मूल्य निर्णयों के लिए AI पैकेज्ड उत्पाद निरीक्षण।', launch: 'स्कैनर शुरू करें', detect: 'पता लगाएं', validate: 'सत्यापित करें', analyze: 'विश्लेषण', report: 'रिपोर्ट', inspect: 'पैक किए गए उत्पाद की जांच', scannerText: 'साफ सामने या पीछे का लेबल इस्तेमाल करें। Lens OCR, बारकोड या QR जानकारी और विज़न रीजनिंग को जोड़ता है। अस्पष्ट लेबल पर दावा नहीं बनाया जाता।', camera: 'कैमरा स्कैन', upload: 'लेबल इमेज अपलोड करें', analyzeButton: 'पता लगाएं और सत्यापित करें', reading: 'लेबल पढ़ा जा रहा है...', reportEmpty: 'आपकी मिशन रिपोर्ट।', start: 'लेबल अपलोड या कैप्चर करके Detect → Validate → Analyze → Report शुरू करें।', pdf: 'रिपोर्ट देखें ↗', voice: 'रिपोर्ट सुनें', speaking: 'बोला जा रहा है...', unavailable: 'लाइव AI उपलब्ध नहीं है। सर्वर API कुंजी जांचें।', cameraError: 'कैमरा उपलब्ध नहीं है। अपलोड का उपयोग करें या ब्राउज़र में अनुमति दें।', capture: 'लेबल कैप्चर करें', inside: 'अंदर क्या है?', healthTech: 'स्वास्थ्य + तकनीकी जानकारी', market: 'बाज़ार की जानकारी', price: 'मूल्य संकेत', clarity: 'स्पष्टता', scale: 'पैमाने पर।', catalogText: 'उपभोक्ताओं, निरीक्षकों, खुदरा विक्रेताओं और प्रशासकों के लिए बहुभाषी AI विश्लेषण। हर रिपोर्ट अनिश्चितता को स्पष्ट रखती है।' },
}


function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [language, setLanguage] = useState<Language>('English')
    const [voiceLanguage, setVoiceLanguage] = useState<Language>('English')
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [history, setHistory] = useState<ScanHistoryItem[]>([])
  const [decodedCode, setDecodedCode] = useState<{ type: 'BARCODE' | 'QR'; value: string } | null>(null)
  const [codeMessage, setCodeMessage] = useState('')
  const [reportPage, setReportPage] = useState(1)
  const [pdfUrl, setPdfUrl] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const text = copy[language]

  useEffect(() => { if (!file) { setPreviewUrl(''); return }; const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url) }, [file])
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem('rockstar-lens-history') || '[]')) } catch { setHistory([]) } }, [])
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])


  const decodePackageCode = async (url: string) => {
    setCodeMessage('Detecting barcode or QR...')
    try {
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url)
      const value = result.getText()
      const isQr = result.getBarcodeFormat().toString().toLowerCase().includes('qr')
      setDecodedCode({ type: isQr ? 'QR' : 'BARCODE', value })
      setCodeMessage(`${isQr ? 'QR detected' : 'Barcode detected'}: ${value}`)
      return { type: isQr ? 'QR' : 'BARCODE', value }
    } catch {
      setDecodedCode(null)
      setCodeMessage('No barcode or QR detected — continuing with package analysis.')
      return null
    }
  }
  const chooseFile = (selected: File | undefined) => {
    if (!selected || !selected.type.startsWith('image/')) { setError('Please choose a JPG, PNG, or WEBP label image.'); return }
    setFile(selected); setAnalysis(null); setError('')
    const url = URL.createObjectURL(selected); void decodePackageCode(url).finally(() => URL.revokeObjectURL(url))
  }
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])
  const openCamera = async () => { setCameraError(''); setIsCameraOpen(true); try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream } catch { setCameraError(text.cameraError) } }
  const closeCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setIsCameraOpen(false) }
  const capturePhoto = () => { const video = videoRef.current; if (!video || !video.videoWidth) return; const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d')?.drawImage(video, 0, 0); canvas.toBlob((blob) => { if (blob) chooseFile(new File([blob], `label-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })); closeCamera() }, 'image/jpeg', .92) }
  const prepareImageForAnalysis = async (source: File) => {
    const image = new Image()
    const sourceUrl = URL.createObjectURL(source)
    try {
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = sourceUrl })
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
      return blob ? new File([blob], 'label-analysis.jpg', { type: 'image/jpeg' }) : source
    } finally { URL.revokeObjectURL(sourceUrl) }
  }
  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true); setError('')
    try {
      const analysisFile = await prepareImageForAnalysis(file)
      const body = new FormData(); body.append('image', analysisFile)
      const headers: Record<string, string> = { 'x-report-language': language }
      if (decodedCode?.type === 'BARCODE') headers['x-barcode'] = decodedCode.value
      if (decodedCode?.type === 'QR') headers['x-qr-content'] = encodeURIComponent(decodedCode.value)
      const response = await fetch('/api/analyze', { method: 'POST', headers, body })
      const responseText = await response.text()
      let payload: Partial<Analysis> & { error?: string }
      try { payload = JSON.parse(responseText) } catch { throw new Error(responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html') ? 'The analysis API returned a web page instead of JSON. Redeploy the Node server and try again.' : 'The analysis API returned an invalid response.') }
      if (!response.ok) throw new Error(payload.error || text.unavailable)
      if (!payload.productName || !payload.complianceStatus) throw new Error('The analysis API returned an incomplete report. Please try the label again.')
      setAnalysis(payload as Analysis)

      const entry: ScanHistoryItem = { id: crypto.randomUUID(), productName: payload.productName, timestamp: new Date().toISOString(), score: payload.complianceScore ?? 0, status: payload.complianceStatus, violations: payload.violations?.map((item: { name: string }) => item.name) || [], analysis: payload as Analysis }
      const nextHistory = [entry, ...history].slice(0, 20); setHistory(nextHistory); localStorage.setItem('rockstar-lens-history', JSON.stringify(nextHistory))
    } catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : text.unavailable) } finally { setIsAnalyzing(false) }
  }
  const reportText = useMemo(() => analysis ? `${text.report}. ${analysis.productName}, ${analysis.category}, brand ${analysis.brand}. ${analysis.summary} Product information: ${Object.entries(analysis.extractedInfo).map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(', ') : value}`).join('. ')} Compliance score ${analysis.complianceScore} percent. Status ${analysis.complianceStatus}. Findings: ${analysis.report.findings.join('. ')} Violations: ${analysis.violations.map((item) => `${item.name}. Reason: ${item.reason}`).join('. ')} Warnings: ${analysis.warnings.join('. ')} Actions: ${analysis.report.actions.join('. ')} Market recommendation: ${analysis.market.recommendations.join('. ')}` : '', [analysis, text.report])
  const pdfImageDataUrl = async (source: File) => {
    const sourceUrl = URL.createObjectURL(source)
    const image = new Image()
    try {
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = sourceUrl })
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.86)
    } finally { URL.revokeObjectURL(sourceUrl) }
  }
  const downloadPdf = async () => {
    if (!analysis) return
    const pdf = new jsPDF()
    const accent = [223, 255, 57] as const
    const orange = [241, 93, 48] as const
    const drawHeader = (page: string) => {
      pdf.setFillColor(10, 10, 9); pdf.rect(0, 0, 210, 297, 'F')
      pdf.setFillColor(...accent); pdf.rect(0, 0, 210, 8, 'F')
      pdf.setTextColor(...accent); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('ROCKSTAR LENS', 15, 23)
      pdf.setTextColor(180, 180, 174); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`AI LABEL REPORT / ${page}`, 195, 23, { align: 'right' })
      pdf.setDrawColor(52, 52, 48); pdf.line(15, 29, 195, 29)
    }
    const drawFooter = () => { pdf.setDrawColor(52, 52, 48); pdf.line(15, 282, 195, 282); pdf.setTextColor(152, 152, 147); pdf.setFontSize(7); pdf.text('VISIBLE EVIDENCE ONLY / VERIFY UNCLEAR DETAILS', 15, 289); pdf.text(`${pdf.getNumberOfPages()}`, 195, 289, { align: 'right' }) }
    const margin = 15
    const width = 180
    const lines = (value: string, sectionWidth = width) => pdf.splitTextToSize(value, sectionWidth)
    const writeSection = (title: string, body: string, startY: number, x = margin, sectionWidth = width) => {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(232, 230, 223); pdf.text(title, x, startY)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(190, 190, 184)
      const bodyLines = lines(body, sectionWidth); pdf.text(bodyLines, x, startY + 5)
      return startY + 7 + bodyLines.length * 3.8
    }
    const pipeline = analysis.visionPipeline
      ? `CNN: ${analysis.visionPipeline.cnn.status} / ${analysis.visionPipeline.cnn.legibility} legibility; regions: ${analysis.visionPipeline.cnn.regions.join(', ') || 'none'}\nOCR: ${analysis.visionPipeline.ocr.status}; fields: ${analysis.visionPipeline.ocr.fieldsDetected.join(', ') || 'none'}\nAI vision: ${analysis.visionPipeline.aiVision.status}; ${analysis.visionPipeline.aiVision.reasoning}`
      : 'CNN, OCR, and AI vision details were not returned.'
    const packageInfo = Object.entries(analysis.extractedInfo).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')
    const compliance = analysis.compliance.map((item) => `${item.label}: ${item.status} - ${item.value}`).join('\n') || 'No checklist details returned.'
    const violations = analysis.violations.map((item) => `${item.name}: ${item.reason} (${item.confidence})`).join('\n') || 'None detected.'
    const date = new Date().toLocaleString()
    drawHeader('01 / INSPECTION')
    pdf.setTextColor(...accent); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.text(analysis.productName, margin, 45)
    pdf.setTextColor(190, 190, 184); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(lines(`Company: ${analysis.brand}\nCategory: ${analysis.category}\nInspection date: ${date}\n\n${analysis.summary}`), margin, 53)
    if (file) { try { pdf.addImage(await pdfImageDataUrl(file), 'JPEG', margin, 62, 180, 72, undefined, 'MEDIUM') } catch { /* Keep the text report if the browser cannot encode the image. */ } }
    let y = 145
    y = writeSection('CNN + OCR + AI VISION PIPELINE', pipeline, y)
    y = writeSection('MACHINE-READABLE EVIDENCE', `Barcode: ${analysis.barcodeInfo.value || 'Not detected'}\nQR: ${analysis.qrInfo.content || 'Not detected'}\nVerification: ${analysis.qrInfo.verificationStatus}`, y + 4)
    writeSection('CONFIDENCE', `Product: ${analysis.aiConfidence.productDetection} | OCR: ${analysis.aiConfidence.ocr} | Compliance: ${analysis.aiConfidence.compliance} | Overall: ${analysis.aiConfidence.overall}`, y + 4)
    drawFooter()
    pdf.addPage(); drawHeader('02 / FINDINGS')
    y = 32
    let leftY = 32
    leftY = writeSection('EXTRACTED PACKAGE INFORMATION', packageInfo || 'No package fields returned.', leftY, 15, 85)
    writeSection('COMPLIANCE', `Score: ${analysis.complianceScore === null ? 'REVIEW' : `${analysis.complianceScore}%`} / ${analysis.complianceStatus}\n${compliance}`, leftY + 4, 15, 85)
    let rightY = 32
    rightY = writeSection('VIOLATIONS AND WARNINGS', `${violations}\nWarnings: ${analysis.warnings.join('; ') || 'None.'}`, rightY, 110, 85)
    rightY = writeSection('HEALTH, MARKET, AND NEXT ACTIONS', `Ingredients: ${analysis.health.ingredients.join(', ') || 'Not available'}\nAllergens: ${analysis.health.allergens.join(', ') || 'None reported'}\nObserved price: ${analysis.market.observedPrice}\nRecommendations: ${analysis.market.recommendations.join('; ') || 'None.'}\nNext actions: ${analysis.report.actions.join('; ') || 'None.'}`, rightY + 4, 110, 85)
    writeSection('FINDINGS', analysis.report.findings.join('; ') || 'No additional findings.', rightY + 4, 110, 85)
    pdf.setFillColor(...orange); pdf.rect(15, 250, 180, 18, 'F'); pdf.setTextColor(10, 10, 9); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text(`COMPLIANCE ${analysis.complianceScore === null ? 'REVIEW' : `${analysis.complianceScore}%`} / ${analysis.complianceStatus}`, 20, 261)
    drawFooter()

    const pdfBlob = pdf.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    setPdfUrl(pdfUrl)
    const downloadLink = document.createElement('a')
    downloadLink.href = pdfUrl
    downloadLink.download = `${analysis.productName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'inspection'}-report.pdf`
    downloadLink.click()
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
  }
  const speakReport = async () => {
    if (!reportText) return
    setIsSpeaking(true); setError('')
    try { const response = await fetch('/api/voice-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: reportText, language: voiceLanguage }) }); if (!response.ok) throw new Error('fallback'); const audio = new Audio(URL.createObjectURL(await response.blob())); audio.onended = () => setIsSpeaking(false); await audio.play() } catch { if (!('speechSynthesis' in window)) { setIsSpeaking(false); setError('Voice report is not supported in this browser.'); return }; const utterance = new SpeechSynthesisUtterance(reportText); utterance.lang = voiceLanguage === 'தமிழ்' ? 'ta-IN' : voiceLanguage === 'हिन्दी' ? 'hi-IN' : 'en-IN'; utterance.onend = () => setIsSpeaking(false); utterance.onerror = () => setIsSpeaking(false); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance) }
  }
  const openHistory = (entry: ScanHistoryItem) => { setAnalysis(entry.analysis); window.location.hash = 'validator' }

  const compliantCount = history.filter((item) => item.status === 'COMPLIANT').length
  const reviewCount = history.filter((item) => item.status === 'NEEDS_REVIEW').length
  const nonCompliantCount = history.filter((item) => item.status === 'NON_COMPLIANT').length
  const commonViolations = [...new Set(history.flatMap((item) => item.violations))].slice(0, 4)

  return <main className="site-shell">
    <nav className="topbar"><a className="brand" href="#top"><span className="brand-mark">R</span><span>ROCKSTAR<br />LENS</span></a><div className="nav-links"><a href="#scan">{text.navScan}</a><a href="#validator">{text.navValidator}</a><a href="#intel">{text.navIntel}</a></div><label className="language-select"><span>{text.lang}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={text.lang}><option>English</option><option>தமிழ்</option><option>हिन्दी</option></select></label></nav>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker">{text.kicker}</p><h1>READ<br /><em>THE</em> LABEL.</h1><p className="hero-text">{text.heroText}</p><a className="scroll-cue" href="#scan"><span>↓</span> {text.launch}</a></div><div className="hero-art"><div className="hero-grid" /><img className="rockstar-hero-image" src="https://cms-static-prod.ros.rockstargames.com/images/18izrhn535ym/vH3cmDeyYwZAfOSRrFzF7/a647ee83433be34607363ef254639604/vH3cmDeyYwZAfOSRrFzF7.svg" alt="Rockstar Games logo" /><span className="hero-stamp">DETECT<br />VALIDATE<br />ANALYZE</span></div></section>
    <section className="mission-strip"><span>01 / {text.detect}</span><span>02 / {text.validate}</span><span>03 / {text.analyze}</span><span>04 / {text.report}</span></section>
    <section className="search-section" id="scan"><div className="section-intro"><p className="kicker">01 / Hybrid scanner</p><h2>{text.inspect}</h2><p>{text.scannerText}</p><div className="mode-pills"><span>CAMERA</span><span>IMAGE</span><span>CNN + OCR</span><span>AI VISION</span></div></div><div className="search-card"><label className={`dropzone ${previewUrl ? 'has-file' : ''}`}>{previewUrl ? <img src={previewUrl} alt="Selected commodity label" /> : <><span className="crosshair">◎</span><strong>{text.upload}</strong><small>JPG, PNG, WEBP · up to 15 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} /></label><div className="search-actions"><button className="primary-button" type="button" disabled={!file || isAnalyzing} onClick={analyzeImage}>{isAnalyzing ? text.reading : text.analyzeButton}<span>↗</span></button><button className="secondary-button" type="button" onClick={openCamera}>◎ <span>{text.camera}</span></button></div>{codeMessage && <p className="code-message">{codeMessage}</p>}{error && <p className="notice">{error}</p>}</div></section>
    <section className="results-section" id="validator" aria-live="polite"><div className="result-heading"><div><p className="kicker">02 / {text.report}</p><h2>{analysis ? analysis.productName : text.reportEmpty}</h2></div>{analysis && <div className="result-actions"><button className="report-button" type="button" onClick={downloadPdf}>Generate PDF Report</button>{pdfUrl && <a className="report-link" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF ↗</a>}<label className="voice-language"><span>VOICE</span><select value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as Language)} aria-label="Voice language"><option>English</option><option>தமிழ்</option><option>हिन्दी</option></select></label><button className="voice-button" type="button" onClick={speakReport} disabled={isSpeaking}>{isSpeaking ? text.speaking : `◉ ${text.voice}`}</button></div>}</div>{!analysis ? <div className="empty-readout"><span>+</span><p>{text.start}</p></div> : <><div className="analysis-summary"><div><p>{analysis.summary}</p><small>{analysis.category} / {analysis.brand}</small></div><div className="score"><span>Compliance score</span><strong>{analysis.complianceScore === null ? 'REVIEW' : `${analysis.complianceScore}%`}</strong><small>{analysis.complianceStatus.replace('_', ' ')} · {analysis.aiConfidence.overall} confidence</small></div></div><div className="code-result"><strong>{analysis.barcodeInfo.detected ? 'Barcode detected' : analysis.qrInfo.detected ? 'QR Detected' : 'Code scan'}</strong><span>{analysis.barcodeInfo.value || analysis.qrInfo.content || 'Product information not found — continuing with package analysis.'}</span><small>{analysis.qrInfo.detected ? `Verification Status: ${analysis.qrInfo.verificationStatus}` : `Barcode / QR detection confidence: ${analysis.aiConfidence.codeDetection}`}</small></div><div className="confidence-strip"><span>Product: {analysis.aiConfidence.productDetection}</span><span>OCR: {analysis.aiConfidence.ocr}</span><span>Compliance: {analysis.aiConfidence.compliance}</span><span>Overall: {analysis.aiConfidence.overall}</span></div><div className="compliance-grid">{analysis.compliance.map((item) => <article className={`check-card ${item.status.toLowerCase()}`} key={item.label}><div><span>{item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '×' : '?'}</span><h3>{item.label}</h3></div><strong>{item.status}</strong><p>{item.value}</p><small>{item.confidence} confidence</small></article>)}</div><div className="violation-panel"><h3>Violations and warnings</h3>{analysis.violations.map((item) => <p key={item.name}>❌ <b>{item.name}</b> — {item.reason} <small>({item.confidence})</small></p>)}{analysis.warnings.map((item) => <p key={item}>⚠ {item}</p>)}{!analysis.violations.length && !analysis.warnings.length && <p>No violations detected from visible evidence.</p>}</div><div className="intel-grid" id="intel"><article><p className="kicker">03 / {text.healthTech}</p><h3>{text.inside}</h3><p><b>Nutri-Score:</b> {analysis.health.nutriScore}</p><p><b>Ingredients:</b> {analysis.health.ingredients.join(', ') || 'Not visible'}</p><p><b>Allergens:</b> {analysis.health.allergens.join(', ') || 'None detected'}</p><p><b>Additives:</b> {analysis.health.additives.join(', ') || 'None detected'}</p><p><b>Specifications:</b> {analysis.technology.specifications.join(', ') || 'Not applicable'}</p></article><article><p className="kicker">04 / {text.market}</p><h3>{text.price}</h3><p><b>Observed MRP:</b> {analysis.market.observedPrice}</p><p><b>Unit price:</b> {analysis.market.pricePerUnit}</p><p><b>Brand:</b> {analysis.market.brandVerification}</p>{analysis.market.recommendations.map((item) => <p key={item}>→ {item}</p>)}</article></div><div className="report-block"><article><p className="kicker">05 / {text.report}</p><h3>Findings</h3>{analysis.report.findings.map((item) => <p key={item}>→ {item}</p>)}</article><article><p className="kicker">Next actions</p>{analysis.report.actions.map((item) => <p key={item}>→ {item}</p>)}</article></div></>}</section>
    {analysis && <section className="report-pages"><p className="kicker">Report pages</p><div className="report-page-buttons">{['Inspection', 'Findings + actions'].map((page, index) => <button className={reportPage === index + 1 ? 'active' : ''} type="button" key={page} onClick={() => setReportPage(index + 1)}>{String(index + 1).padStart(2, '0')} / {page}</button>)}</div><div className="report-page-note">Page {String(reportPage).padStart(2, '0')} selected. Generate PDF Report creates exactly two pages.</div></section>}
    <section className="history-section"><div><p className="kicker">06 / Inspection history</p><h2>Scan<br /><em>archive.</em></h2></div><div className="history-dashboard"><div className="history-stats"><span><b>{history.length}</b>Total scanned</span><span><b>{compliantCount}</b>Compliant</span><span><b>{nonCompliantCount}</b>Non-compliant</span><span><b>{reviewCount}</b>Needs review</span></div>{commonViolations.length > 0 && <p className="history-common">Common violations: {commonViolations.join(' · ')}</p>}<div className="history-list">{history.length === 0 ? <p>No inspections saved yet.</p> : history.map((entry) => <button type="button" key={entry.id} onClick={() => openHistory(entry)}><strong>{entry.productName}</strong><span>{new Date(entry.timestamp).toLocaleString()} · {entry.score}% · {entry.status.replace('_', ' ')}</span><small>{entry.violations.join(', ') || 'No violations recorded'}</small></button>)}</div></div></section>
    <section className="catalog-section"><div><p className="kicker">07 / {text.kicker}</p><h2>{text.clarity}<br /><em>{text.scale}</em></h2></div><p>{text.catalogText}</p><div className="feature-list"><span>MRP + quantity</span><span>Expiry tracking</span><span>Voice reports</span><span>Admin ready</span></div></section>
    <footer><span>ROCKSTAR LENS / {text.kicker}</span><span>{text.detect}. {text.validate}. {text.analyze}. {text.report}.</span></footer>
    {isCameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label={text.camera}><div className="camera-window"><button className="close-button" type="button" onClick={closeCamera}>×</button><p className="kicker">Live hybrid scanner</p><h2>Frame the label.</h2><div className="video-frame">{cameraError ? <p>{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted />}</div><button className="primary-button" type="button" disabled={Boolean(cameraError)} onClick={capturePhoto}>{text.capture} <span>◎</span></button></div></div>}
  </main>
}

export default App

