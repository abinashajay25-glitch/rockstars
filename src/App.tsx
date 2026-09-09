import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { jsPDF } from 'jspdf'
import './App.css'

type ComplianceItem = { label: string; status: 'PASS' | 'FAIL' | 'REVIEW'; value: string; confidence: string }
type Analysis = {
  provider?: string; productName: string; category: string; brand: string; summary: string
  barcodeInfo: { detected: boolean; value: string; productName: string; brand: string; category: string; status: string }
  qrInfo: { detected: boolean; content: string; type: string; verificationStatus: string }
  extractedInfo: Record<string, string | string[]>; complianceScore: number
  complianceStatus: 'COMPLIANT' | 'NEEDS_REVIEW' | 'NON_COMPLIANT'; aiConfidence: Record<string, string>
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

const PRODUCT_TAG_KEYWORDS: Record<string, string[]> = {
  Food: ['food', 'snack', 'bever', 'drink', 'juice', 'milk', 'oil', 'spice', 'cereal', 'chocolate', 'biscuit', 'chip', 'sauce', 'candy', 'tea', 'coffee', 'sugar', 'noodle', 'rice', 'flour', 'dairy', 'yogurt', 'butter', 'cheese', 'jam', 'honey', 'soup'],
  Cosmetic: ['cosmetic', 'cream', 'soap', 'shampoo', 'lotion', 'perfume', 'makeup', 'toothpaste', 'skincare', 'face wash', 'facewash', 'serum', 'sunscreen', 'deodorant', 'lipstick', 'mascara', 'hair', 'body lotion'],
  Medicine: ['medicine', 'tablet', 'capsule', 'syrup', 'pharma', 'drug', 'injection', 'derm', 'ayurvedic', 'homeo', 'paracetamol', 'vitamin', 'supplement', 'ointment', 'gel', 'balm', 'sachet'],
  Electronic: ['electronic', 'mobile', 'laptop', 'charger', 'earphone', 'headphone', 'battery', 'cable', 'router', 'led', 'tv', 'watch', 'speaker', 'adapter', 'remote', 'keyboard', 'mouse', 'power bank'],
  'General Commodity': [],
}

const PRODUCT_TAG_CATEGORY_MATCH: Record<string, string> = {
  food: 'Food',
  cosmetic: 'Cosmetic',
  cosmetics: 'Cosmetic',
  medicine: 'Medicine',
  medication: 'Medicine',
  electronic: 'Electronic',
  electronics: 'Electronic',
  commodity: 'General Commodity',
  general: 'General Commodity',
}

const inferProductTags = (analysis: Analysis): string[] => {
  const category = (analysis.category || '').toLowerCase()
  const productName = (analysis.productName || '').toLowerCase()
  const brand = (analysis.brand || '').toLowerCase()
  const extracted = Object.values(analysis.extractedInfo || {}).map((value) => Array.isArray(value) ? value.join(' ') : value).join(' ').toLowerCase()
  const haystack = `${category} ${productName} ${brand} ${extracted}`
  const found = new Set<string>()
  for (const [tag, keywords] of Object.entries(PRODUCT_TAG_KEYWORDS)) {
    if (tag === 'General Commodity') continue
    if (keywords.some((keyword) => haystack.includes(keyword))) found.add(tag)
  }
  const categoryTag = PRODUCT_TAG_CATEGORY_MATCH[category]
  if (categoryTag) found.add(categoryTag)
  if (found.size === 0) found.add('General Commodity')
  const order = ['Food', 'Cosmetic', 'Medicine', 'Electronic', 'General Commodity']
  return order.filter((tag) => found.has(tag))
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
  const [history, setHistory] = useState<ScanHistoryItem[]>([])
  const [decodedCode, setDecodedCode] = useState<{ type: 'BARCODE' | 'QR'; value: string } | null>(null)
  const [codeMessage, setCodeMessage] = useState('')
  const [reportPage, setReportPage] = useState(1)
  const [productTags, setProductTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const text = copy[language]

  useEffect(() => { if (!file) { setPreviewUrl(''); return }; const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url) }, [file])
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem('rockstar-lens-history') || '[]')) } catch { setHistory([]) } }, [])
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])
  useEffect(() => {
    const element = cursorRef.current
    if (!element) return
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let currentX = targetX
    let currentY = targetY
    let rafId = 0
    const onMove = (event: MouseEvent) => {
      targetX = event.clientX
      targetY = event.clientY
    }
    const render = () => {
      currentX += (targetX - currentX) * 0.16
      currentY += (targetY - currentY) * 0.16
      element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      rafId = window.requestAnimationFrame(render)
    }
    window.addEventListener('mousemove', onMove)
    rafId = window.requestAnimationFrame(render)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.cancelAnimationFrame(rafId)
    }
  }, [])

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
  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true); setError('')
    try {
      const body = new FormData(); body.append('image', file)
      const headers: Record<string, string> = { 'x-report-language': language }
      if (decodedCode?.type === 'BARCODE') headers['x-barcode'] = decodedCode.value
      if (decodedCode?.type === 'QR') headers['x-qr-content'] = encodeURIComponent(decodedCode.value)
      const response = await fetch('/api/analyze', { method: 'POST', headers, body })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || text.unavailable)
      setAnalysis(payload)
      setProductTags(inferProductTags(payload))
      const entry: ScanHistoryItem = { id: crypto.randomUUID(), productName: payload.productName, timestamp: new Date().toISOString(), score: payload.complianceScore, status: payload.complianceStatus, violations: payload.violations.map((item: { name: string }) => item.name), analysis: payload }
      const nextHistory = [entry, ...history].slice(0, 20); setHistory(nextHistory); localStorage.setItem('rockstar-lens-history', JSON.stringify(nextHistory))
    } catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : text.unavailable) } finally { setIsAnalyzing(false) }
  }
  const reportText = useMemo(() => analysis ? `${text.report}. ${analysis.productName}, ${analysis.category}, brand ${analysis.brand}. ${analysis.summary} Product information: ${Object.entries(analysis.extractedInfo).map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(', ') : value}`).join('. ')} Compliance score ${analysis.complianceScore} percent. Status ${analysis.complianceStatus}. Findings: ${analysis.report.findings.join('. ')} Violations: ${analysis.violations.map((item) => `${item.name}. Reason: ${item.reason}`).join('. ')} Warnings: ${analysis.warnings.join('. ')} Actions: ${analysis.report.actions.join('. ')} Market recommendation: ${analysis.market.recommendations.join('. ')}` : '', [analysis, text.report])
  const imageDataUrl = async (source: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The uploaded image could not be added to the PDF.'))
    reader.readAsDataURL(source)
  })
  const downloadPdf = async () => {
    if (!analysis) return
    const pdf = new jsPDF()
    const packageInfo = Object.entries(analysis.extractedInfo).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')
    const violations = analysis.violations.map((item) => `${item.name}: ${item.reason} (${item.confidence})`).join('\n') || 'None detected'
    const date = new Date().toLocaleString()
    const addPage = (title: string, body: string) => { pdf.addPage(); pdf.setTextColor(10, 10, 9); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text(title, 15, 20); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(pdf.splitTextToSize(body, 180), 15, 32) }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text(text.report, 15, 20); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(pdf.splitTextToSize(`Inspection Summary\n${analysis.summary}\n\nInspection date\n${date}`, 180), 15, 32)
    if (file) { try { pdf.addImage(await imageDataUrl(file), 'JPEG', 15, 75, 180, 105, undefined, 'MEDIUM') } catch { /* Keep the text report if the browser cannot encode the image. */ } }
    addPage('Product Information', `Product: ${analysis.productName}\nBrand: ${analysis.brand}\nCategory: ${analysis.category}`)
    addPage('Barcode / QR Information', `Barcode: ${analysis.barcodeInfo.value || 'Not detected'}\nQR: ${analysis.qrInfo.content || 'Not detected'}\nVerification: ${analysis.qrInfo.verificationStatus}`)
    addPage('Extracted Package Information', packageInfo)
    addPage('Compliance', `Score: ${analysis.complianceScore}%\nStatus: ${analysis.complianceStatus}\nAI confidence: ${analysis.aiConfidence.overall}\n${analysis.compliance.map((item) => `${item.label}: ${item.status} - ${item.value}`).join('\n')}`)
    addPage('Detected Violations', violations)
    addPage('Warnings and Explanations', `${analysis.warnings.join('\n') || 'None'}\n\n${analysis.violations.map((item) => `${item.name}: ${item.reason}`).join('\n') || 'No violations detected.'}`)
    const officialSearches = [`https://www.google.com/search?q=${encodeURIComponent(`${analysis.brand} ${analysis.productName} official website`)}`, `https://www.google.com/search?q=${encodeURIComponent(`${analysis.brand} ${analysis.productName} official price`)}`, `https://www.google.com/search?q=${encodeURIComponent(`${analysis.brand} ${analysis.productName} official models`)}`]
    addPage('Market and Official Sources', `Observed price: ${analysis.market.observedPrice}\nUnit price: ${analysis.market.pricePerUnit}\n\nOfficial-source searches (verify before relying on them):\n${officialSearches.join('\n')}`)
    addPage('Inspection Notes', `${analysis.report.findings.join('\n') || 'No additional findings.'}\n\nNext actions:\n${analysis.report.actions.join('\n') || 'No additional actions.'}`)
    const pdfBlob = pdf.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = pdfUrl
    downloadLink.download = `${analysis.productName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'inspection'}-report.pdf`
    downloadLink.click()
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
  }
  const speakReport = async () => {
    if (!reportText) return
    setIsSpeaking(true); setError('')
    try { const response = await fetch('/api/voice-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: reportText, language }) }); if (!response.ok) throw new Error('fallback'); const audio = new Audio(URL.createObjectURL(await response.blob())); audio.onended = () => setIsSpeaking(false); await audio.play() } catch { if (!('speechSynthesis' in window)) { setIsSpeaking(false); setError('Voice report is not supported in this browser.'); return }; const utterance = new SpeechSynthesisUtterance(reportText); utterance.lang = language === 'தமிழ்' ? 'ta-IN' : language === 'हिन्दी' ? 'hi-IN' : 'en-IN'; utterance.onend = () => setIsSpeaking(false); utterance.onerror = () => setIsSpeaking(false); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance) }
  }
  const openHistory = (entry: ScanHistoryItem) => { setAnalysis(entry.analysis); setProductTags(inferProductTags(entry.analysis)); window.location.hash = 'validator' }
  const addTag = () => {
    const value = tagInput.trim()
    if (!value) return
    setProductTags((current) => current.includes(value) ? current : [...current, value])
    setTagInput('')
  }
  const removeTag = (tag: string) => {
    setProductTags((current) => current.filter((item) => item !== tag))
  }
  const compliantCount = history.filter((item) => item.status === 'COMPLIANT').length
  const reviewCount = history.filter((item) => item.status === 'NEEDS_REVIEW').length
  const nonCompliantCount = history.filter((item) => item.status === 'NON_COMPLIANT').length
  const commonViolations = [...new Set(history.flatMap((item) => item.violations))].slice(0, 4)
