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
type VoiceLang = 'English' | 'தமிழ்' | 'हिन्दी'
type PipelineStep = 'idle' | 'cnn' | 'ocr' | 'vision' | 'done'
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

const PIPELINE_LABELS: Record<PipelineStep, string> = { idle: '', cnn: 'CNN Detect', ocr: 'OCR Extract', vision: 'AI Vision', done: 'Report Ready' }
const PIPELINE_STEPS: PipelineStep[] = ['cnn', 'ocr', 'vision', 'done']

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [language, setLanguage] = useState<Language>('English')
  const [voiceLang, setVoiceLang] = useState<VoiceLang>('English')
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('idle')
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
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true); setError(''); setPipelineStep('cnn')
    try {
      /* Step 1: CNN Detect — simulated client-side classification */
      await delay(900)
      const cnnCategory = inferProductTags({ productName: file.name, category: '', brand: '', summary: '', barcodeInfo: { detected: false, value: '', productName: '', brand: '', category: '', status: 'NOT_PROVIDED' }, qrInfo: { detected: false, content: '', type: 'NOT_FOUND', verificationStatus: 'NOT_FOUND' }, extractedInfo: {}, complianceScore: 0, complianceStatus: 'NEEDS_REVIEW', aiConfidence: {}, compliance: [], violations: [], warnings: [], health: { ingredients: [], nutriScore: 'UNKNOWN', allergens: [], additives: [] }, technology: { specifications: [] }, market: { observedPrice: '', pricePerUnit: '', brandVerification: 'REVIEW', comparisons: [], recommendations: [] }, report: { findings: [], actions: [] } })[0] || 'General Commodity'
      setPipelineStep('ocr')

      /* Step 2 + 3: OCR Extract + AI Vision — single server call */
      await delay(400)
      setPipelineStep('vision')
      const body = new FormData(); body.append('image', file)
      const headers: Record<string, string> = { 'x-report-language': language, 'x-cnn-category': cnnCategory }
      if (decodedCode?.type === 'BARCODE') headers['x-barcode'] = decodedCode.value
      if (decodedCode?.type === 'QR') headers['x-qr-content'] = encodeURIComponent(decodedCode.value)
      const response = await fetch('/api/analyze', { method: 'POST', headers, body })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || text.unavailable)

      /* Step 4: Report ready */
      setPipelineStep('done')
      await delay(500)
      setAnalysis(payload)
      setProductTags(inferProductTags(payload))
      setVoiceLang(language)
      const entry: ScanHistoryItem = { id: crypto.randomUUID(), productName: payload.productName, timestamp: new Date().toISOString(), score: payload.complianceScore, status: payload.complianceStatus, violations: payload.violations.map((item: { name: string }) => item.name), analysis: payload }
      const nextHistory = [entry, ...history].slice(0, 20); setHistory(nextHistory); localStorage.setItem('rockstar-lens-history', JSON.stringify(nextHistory))
    } catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : text.unavailable) } finally { setIsAnalyzing(false); setPipelineStep('idle') }
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
    const W = 210
    const M = 12
    const CW = W - 2 * M
    const date = new Date().toLocaleString()
    let y = M

    /* ── Helper functions ── */
    const heading = (label: string) => { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(10, 10, 9); pdf.text(label, M, y); y += 5 }
    const bodyText = (label: string, value: string) => { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text(label, M, y); pdf.setFont('helvetica', 'normal'); const lines = pdf.splitTextToSize(value, CW - 28); pdf.text(lines, M + 28, y); y += Math.max(lines.length * 3.2, 3.5) }
    const separator = () => { pdf.setDrawColor(200); pdf.line(M, y, W - M, y); y += 3 }
    const ensureSpace = (need: number) => { if (y + need > 285) { pdf.addPage(); y = M } }

    /* ===== PAGE 1: Overview ===== */
    /* Title bar */
    pdf.setFillColor(10, 10, 9); pdf.rect(0, 0, W, 22, 'F')
    pdf.setTextColor(223, 255, 57); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text('ROCKSTAR LENS — COMPLIANCE REPORT', M, 14)
    pdf.setTextColor(180, 180, 170); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text(date, W - M - 40, 14)
    y = 28

    /* Product image (small thumbnail) */
    if (file) { try { pdf.addImage(await imageDataUrl(file), 'JPEG', M, y, 40, 30, undefined, 'MEDIUM'); } catch { /* skip */ } }
    const infoX = file ? M + 46 : M
    pdf.setTextColor(10, 10, 9)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text(analysis.productName, infoX, y + 6)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`Brand: ${analysis.brand}  |  Category: ${analysis.category}`, infoX, y + 12)
    pdf.setFontSize(7); const summaryLines = pdf.splitTextToSize(analysis.summary, CW - (file ? 50 : 4)); pdf.text(summaryLines, infoX, y + 17)
    y = Math.max(y + 34, y + 17 + summaryLines.length * 3)

    /* Compliance score bar */
    separator()
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(`COMPLIANCE SCORE: ${analysis.complianceScore}%  —  ${analysis.complianceStatus.replace('_', ' ')}`, M, y)
    y += 4
    pdf.setFillColor(230, 230, 220); pdf.rect(M, y, CW, 4, 'F')
    const scoreColor = analysis.complianceScore >= 70 ? [100, 180, 50] : analysis.complianceScore >= 40 ? [220, 180, 40] : [220, 70, 40]
    pdf.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]); pdf.rect(M, y, CW * analysis.complianceScore / 100, 4, 'F')
    y += 8

    /* Confidence strip */
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(100)
    pdf.text(`Product: ${analysis.aiConfidence.productDetection}  |  OCR: ${analysis.aiConfidence.ocr}  |  Compliance: ${analysis.aiConfidence.compliance}  |  Overall: ${analysis.aiConfidence.overall}`, M, y)
    y += 5; separator()

    /* Compliance checklist grid */
    heading('COMPLIANCE CHECKLIST')
    const colW = CW / 2
    analysis.compliance.forEach((item, i) => {
      ensureSpace(8)
      const col = i % 2
      const x = M + col * colW
      const statusIcon = item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '✗' : '?'
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7)
      pdf.setTextColor(item.status === 'PASS' ? 50 : item.status === 'FAIL' ? 200 : 160, item.status === 'PASS' ? 140 : item.status === 'FAIL' ? 60 : 140, item.status === 'PASS' ? 30 : 30)
      pdf.text(`${statusIcon} ${item.label}: ${item.status}`, x, y)
      pdf.setTextColor(80); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6)
      const valLines = pdf.splitTextToSize(item.value, colW - 6)
      pdf.text(valLines, x + 2, y + 3)
      if (col === 1) y += Math.max(valLines.length * 2.5 + 4, 7)
    })
    if (analysis.compliance.length % 2 === 1) y += 7
    y += 2; separator()

    /* Violations & warnings */
    ensureSpace(20); heading('VIOLATIONS & WARNINGS')
    if (analysis.violations.length === 0 && analysis.warnings.length === 0) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(80); pdf.text('No violations detected from visible evidence.', M, y); y += 5 }
    analysis.violations.forEach((v) => { ensureSpace(8); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(200, 60, 40); pdf.text(`✗ ${v.name}`, M, y); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80); const rLines = pdf.splitTextToSize(v.reason, CW - 10); pdf.text(rLines, M + 4, y + 3); y += rLines.length * 2.8 + 4 })
    analysis.warnings.forEach((w) => { ensureSpace(6); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(160, 140, 30); const wLines = pdf.splitTextToSize(`⚠ ${w}`, CW); pdf.text(wLines, M, y); y += wLines.length * 2.8 + 2 })

    /* ===== PAGE 2: Details ===== */
    pdf.addPage(); y = M
    pdf.setFillColor(10, 10, 9); pdf.rect(0, 0, W, 16, 'F')
    pdf.setTextColor(223, 255, 57); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text('PAGE 2 — DETAILED INFORMATION', M, 11)
    y = 22
    pdf.setTextColor(10, 10, 9)

    /* Extracted package info */
    heading('EXTRACTED PACKAGE INFORMATION')
    Object.entries(analysis.extractedInfo).forEach(([k, v]) => { ensureSpace(5); bodyText(k.replace(/([A-Z])/g, ' $1').trim(), Array.isArray(v) ? v.join(', ') : String(v)) })
    y += 2; separator()

    /* Barcode / QR info */
    ensureSpace(14); heading('BARCODE / QR INFORMATION')
    bodyText('Barcode', analysis.barcodeInfo.value || 'Not detected')
    bodyText('QR content', analysis.qrInfo.content || 'Not detected')
    bodyText('QR verification', analysis.qrInfo.verificationStatus)
    y += 2; separator()

    /* Health & tech */
    ensureSpace(20); heading('HEALTH & TECH INTELLIGENCE')
    bodyText('Nutri-Score', analysis.health.nutriScore)
    bodyText('Ingredients', analysis.health.ingredients.join(', ') || 'Not visible')
    bodyText('Allergens', analysis.health.allergens.join(', ') || 'None detected')
    bodyText('Additives', analysis.health.additives.join(', ') || 'None detected')
    bodyText('Specifications', analysis.technology.specifications.join(', ') || 'N/A')
    y += 2; separator()

    /* Market intelligence */
    ensureSpace(16); heading('MARKET INTELLIGENCE')
    bodyText('Observed MRP', analysis.market.observedPrice)
    bodyText('Unit price', analysis.market.pricePerUnit)
    bodyText('Brand status', analysis.market.brandVerification)
    analysis.market.recommendations.forEach((r) => { ensureSpace(5); bodyText('→', r) })
    y += 2; separator()

    /* Findings & actions */
    ensureSpace(16); heading('FINDINGS & ACTIONS')
    analysis.report.findings.forEach((f) => { ensureSpace(5); bodyText('Finding', f) })
    analysis.report.actions.forEach((a) => { ensureSpace(5); bodyText('Action', a) })
    y += 2; separator()

    /* Official source links */
    ensureSpace(12); heading('OFFICIAL SOURCE LINKS')
    const searches = [`${analysis.brand} ${analysis.productName} official website`, `${analysis.brand} ${analysis.productName} official price`]
    searches.forEach((q) => { ensureSpace(5); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(30, 80, 180); pdf.text(`https://www.google.com/search?q=${encodeURIComponent(q)}`, M, y); y += 3.5 })

    /* Footer */
    pdf.setTextColor(150); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6)
    pdf.text('Generated by Rockstar Lens — AI Commodity Compliance Inspector', M, 288)

    /* Download + open */
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
    try { const response = await fetch('/api/voice-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: reportText, language: voiceLang }) }); if (!response.ok) throw new Error('fallback'); const audio = new Audio(URL.createObjectURL(await response.blob())); audio.onended = () => setIsSpeaking(false); await audio.play() } catch { if (!('speechSynthesis' in window)) { setIsSpeaking(false); setError('Voice report is not supported in this browser.'); return }; const utterance = new SpeechSynthesisUtterance(reportText); utterance.lang = voiceLang === 'தமிழ்' ? 'ta-IN' : voiceLang === 'हिन्दी' ? 'hi-IN' : 'en-IN'; utterance.onend = () => setIsSpeaking(false); utterance.onerror = () => setIsSpeaking(false); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance) }
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

  return <main className="site-shell">
    <nav className="topbar"><a className="brand" href="#top"><span className="brand-mark">R</span><span>ROCKSTAR<br />LENS</span></a><div className="nav-links"><a href="#scan">{text.navScan}</a><a href="#validator">{text.navValidator}</a><a href="#intel">{text.navIntel}</a></div><label className="language-select"><span>{text.lang}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={text.lang}><option>English</option><option>தமிழ்</option><option>हिन्दी</option></select></label></nav>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker">{text.kicker}</p><h1>READ<br /><em>THE</em> LABEL.</h1><p className="hero-text">{text.heroText}</p><a className="scroll-cue" href="#scan"><span>↓</span> {text.launch}</a></div><div className="hero-art"><div className="hero-grid" /><img className="rockstar-hero-image" src="https://cms-static-prod.ros.rockstargames.com/images/18izrhn535ym/vH3cmDeyYwZAfOSRrFzF7/a647ee83433be34607363ef254639604/vH3cmDeyYwZAfOSRrFzF7.svg" alt="Rockstar Games logo" /><span className="hero-stamp">DETECT<br />VALIDATE<br />ANALYZE</span></div></section>
    <section className="mission-strip"><span>01 / {text.detect}</span><span>02 / {text.validate}</span><span>03 / {text.analyze}</span><span>04 / {text.report}</span></section>
    <section className="search-section" id="scan"><div className="section-intro"><p className="kicker">01 / Hybrid scanner</p><h2>{text.inspect}</h2><p>{text.scannerText}</p><div className="mode-pills"><span>CNN</span><span>OCR</span><span>AI VISION</span><span>REPORT</span></div></div><div className="search-card"><label className={`dropzone ${previewUrl ? 'has-file' : ''}`}>{previewUrl ? <img src={previewUrl} alt="Selected commodity label" /> : <><span className="crosshair">◎</span><strong>{text.upload}</strong><small>JPG, PNG, WEBP · up to 15 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} /></label><div className="search-actions"><button className="primary-button" type="button" disabled={!file || isAnalyzing} onClick={analyzeImage}>{isAnalyzing ? text.reading : text.analyzeButton}<span>↗</span></button><button className="secondary-button" type="button" onClick={openCamera}>◎ <span>{text.camera}</span></button></div>{isAnalyzing && <div className="pipeline-stepper">{PIPELINE_STEPS.map((step) => { const idx = PIPELINE_STEPS.indexOf(step); const curIdx = PIPELINE_STEPS.indexOf(pipelineStep); const cls = pipelineStep === step ? 'active' : idx < curIdx ? 'done' : ''; return <div className={`pipeline-step ${cls}`} key={step}><span className="step-num">{String(idx + 1).padStart(2, '0')}</span><span className="step-label">{PIPELINE_LABELS[step]}</span><span className="step-status">{cls === 'done' ? '✓' : cls === 'active' ? '⟳' : '—'}</span></div> })}</div>}{codeMessage && <p className="code-message">{codeMessage}</p>}{error && <p className="notice">{error}</p>}</div></section>
    <section className="results-section" id="validator" aria-live="polite"><div className="result-heading"><div><p className="kicker">02 / {text.report}</p><h2>{analysis ? analysis.productName : text.reportEmpty}</h2></div>{analysis && <div className="result-actions"><button className="report-button" type="button" onClick={downloadPdf}>Generate PDF Report</button><div className="voice-group"><select className="voice-lang-select" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value as VoiceLang)} aria-label="Voice language"><option value="English">🔊 English</option><option value="தமிழ்">🔊 தமிழ்</option><option value="हिन्दी">🔊 हिन्दी</option></select><button className="voice-button" type="button" onClick={speakReport} disabled={isSpeaking}>{isSpeaking ? text.speaking : `◉ ${text.voice}`}</button></div></div>}</div>{!analysis ? <div className="empty-readout"><span>+</span><p>{text.start}</p></div> : <><div className="analysis-summary"><div><p>{analysis.summary}</p><small>{analysis.category} / {analysis.brand}</small></div><div className="score"><span>Compliance score</span><strong>{analysis.complianceScore}%</strong><small>{analysis.complianceStatus.replace('_', ' ')} · {analysis.aiConfidence.overall} confidence</small></div></div><div className="tags-panel"><div className="tags-heading"><p className="kicker">Product tags</p><span>{productTags.length} tagged</span></div><div className="tag-chips">{productTags.map((tag) => <span className="tag-chip" key={tag}><button type="button" className="tag-remove" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>×</button><span>{tag}</span></span>)}{<div className="tag-add"><input type="text" placeholder="Add tag..." value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addTag() }} aria-label="Add product tag" /><button type="button" className="tag-add-button" onClick={addTag}>+</button></div>}</div></div><div className="code-result"><strong>{analysis.barcodeInfo.detected ? 'Barcode detected' : analysis.qrInfo.detected ? 'QR Detected' : 'Code scan'}</strong><span>{analysis.barcodeInfo.value || analysis.qrInfo.content || 'Product information not found — continuing with package analysis.'}</span><small>{analysis.qrInfo.detected ? `Verification Status: ${analysis.qrInfo.verificationStatus}` : `Barcode / QR detection confidence: ${analysis.aiConfidence.codeDetection}`}</small></div><div className="confidence-strip"><span>Product: {analysis.aiConfidence.productDetection}</span><span>OCR: {analysis.aiConfidence.ocr}</span><span>Compliance: {analysis.aiConfidence.compliance}</span><span>Overall: {analysis.aiConfidence.overall}</span></div><div className="compliance-grid">{analysis.compliance.map((item) => <article className={`check-card ${item.status.toLowerCase()}`} key={item.label}><div><span>{item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '×' : '?'}</span><h3>{item.label}</h3></div><strong>{item.status}</strong><p>{item.value}</p><small>{item.confidence} confidence</small></article>)}</div><div className="violation-panel"><h3>Violations and warnings</h3>{analysis.violations.map((item) => <p key={item.name}>❌ <b>{item.name}</b> — {item.reason} <small>({item.confidence})</small></p>)}{analysis.warnings.map((item) => <p key={item}>⚠ {item}</p>)}{!analysis.violations.length && !analysis.warnings.length && <p>No violations detected from visible evidence.</p>}</div><div className="intel-grid" id="intel"><article><p className="kicker">03 / {text.healthTech}</p><h3>{text.inside}</h3><p><b>Nutri-Score:</b> {analysis.health.nutriScore}</p><p><b>Ingredients:</b> {analysis.health.ingredients.join(', ') || 'Not visible'}</p><p><b>Allergens:</b> {analysis.health.allergens.join(', ') || 'None detected'}</p><p><b>Additives:</b> {analysis.health.additives.join(', ') || 'None detected'}</p><p><b>Specifications:</b> {analysis.technology.specifications.join(', ') || 'Not applicable'}</p></article><article><p className="kicker">04 / {text.market}</p><h3>{text.price}</h3><p><b>Observed MRP:</b> {analysis.market.observedPrice}</p><p><b>Unit price:</b> {analysis.market.pricePerUnit}</p><p><b>Brand:</b> {analysis.market.brandVerification}</p>{analysis.market.recommendations.map((item) => <p key={item}>→ {item}</p>)}</article></div><div className="report-block"><article><p className="kicker">05 / {text.report}</p><h3>Findings</h3>{analysis.report.findings.map((item) => <p key={item}>→ {item}</p>)}</article><article><p className="kicker">Next actions</p>{analysis.report.actions.map((item) => <p key={item}>→ {item}</p>)}</article></div></>}</section>
    {analysis && <section className="report-pages"><p className="kicker">Report pages</p><div className="report-page-buttons">{['Overview', 'Details'].map((page, index) => <button className={reportPage === index + 1 ? 'active' : ''} type="button" key={page} onClick={() => setReportPage(index + 1)}>{String(index + 1).padStart(2, '0')} / {page}</button>)}</div><div className="report-page-note">Page {String(reportPage).padStart(2, '0')} selected. Use Generate PDF Report above to download a compact 2-page report with all details.</div></section>}
    <section className="history-section"><div><p className="kicker">06 / Inspection history</p><h2>Scan<br /><em>archive.</em></h2></div><div className="history-dashboard"><div className="history-stats"><span><b>{history.length}</b>Total scanned</span><span><b>{compliantCount}</b>Compliant</span><span><b>{nonCompliantCount}</b>Non-compliant</span><span><b>{reviewCount}</b>Needs review</span></div>{commonViolations.length > 0 && <p className="history-common">Common violations: {commonViolations.join(' · ')}</p>}<div className="history-list">{history.length === 0 ? <p>No inspections saved yet.</p> : history.map((entry) => <button type="button" key={entry.id} onClick={() => openHistory(entry)}><strong>{entry.productName}</strong><span>{new Date(entry.timestamp).toLocaleString()} · {entry.score}% · {entry.status.replace('_', ' ')}</span><small>{entry.violations.join(', ') || 'No violations recorded'}</small></button>)}</div></div></section>
    <section className="catalog-section" id="intel"><div><p className="kicker">07 / {text.kicker}</p><h2>{text.clarity}<br /><em>{text.scale}</em></h2></div><p>{text.catalogText}</p><div className="feature-list"><span>MRP + quantity</span><span>Expiry tracking</span><span>Voice reports</span><span>Admin ready</span></div></section>
    <footer><span>ROCKSTAR LENS / {text.kicker}</span><span>{text.detect}. {text.validate}. {text.analyze}. {text.report}.</span></footer>
    {isCameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label={text.camera}><div className="camera-window"><button className="close-button" type="button" onClick={closeCamera}>×</button><p className="kicker">Live hybrid scanner</p><h2>Frame the label.</h2><div className="video-frame">{cameraError ? <p>{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted />}</div><button className="primary-button" type="button" disabled={Boolean(cameraError)} onClick={capturePhoto}>{text.capture} <span>◎</span></button></div></div>}
  </main>
}

export default App
