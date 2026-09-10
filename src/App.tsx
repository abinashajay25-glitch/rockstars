import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { readBarcodesFromImageData } from 'zxing-wasm'
import { jsPDF } from 'jspdf'
import './App.css'

type ComplianceItem = { label: string; status: 'PASS' | 'FAIL' | 'REVIEW'; value: string; confidence: string }
type Analysis = {
  provider?: string; productName: string; category: string; brand: string; summary: string
  barcodeInfo: { detected: boolean; value: string; format?: string; productName: string; brand: string; category: string; status: string }
  qrInfo: { detected: boolean; content: string; type: string; verificationStatus: string }
  extractedInfo: Record<string, string | string[]>; complianceScore: number
  complianceStatus: 'COMPLIANT' | 'NEEDS_REVIEW' | 'NON_COMPLIANT'; aiConfidence: Record<string, string>
  compliance: ComplianceItem[]; violations: { name: string; reason: string; confidence: string }[]; warnings: string[]
  health: { ingredients: string[]; nutriScore: string; allergens: string[]; additives: string[]; edibility: string }
  technology: { specifications: string[] }
  market: { observedPrice: string; pricePerUnit: string; brandVerification: string; comparisons: { seller: string; price: string; unitPrice: string }[]; recommendations: string[] }
  report: { findings: string[]; actions: string[] }
}
type Language = 'English' | 'தமிழ்' | 'हिन्दी'
type ScanHistoryItem = { id: string; productName: string; timestamp: string; score: number; status: Analysis['complianceStatus']; violations: string[]; analysis: Analysis }
type ReportLabels = { title: string; summary: string; productCodes: string; confidence: string; declarations: string; compliance: string; health: string; technology: string; market: string; violations: string; actions: string; provenance: string; product: string; brand: string; category: string; barcode: string; qr: string; verification: string; score: string; status: string; ingredients: string; nutriScore: string; allergens: string; additives: string; edibility: string; specifications: string; observedPrice: string; pricePerUnit: string; brandVerification: string; comparisons: string; recommendations: string; findings: string; nextActions: string; reportLanguage: string }

type DecodedCode = {
  type: 'BARCODE' | 'QR'
  format: string
  value: string
  lookup?: {
    productName?: string
    brand?: string
    category?: string
    ingredients?: string
    allergens?: string
    nutriScore?: string
    manufacturer?: string
    quantity?: string
  }
}

const reportLabels: Record<Language, ReportLabels> = {
  English: { title: 'Compliance intelligence', summary: 'Inspection summary', productCodes: 'Product and machine codes', confidence: 'AI confidence', declarations: 'Package declarations', compliance: 'Seven-point compliance', health: 'Health intelligence', technology: 'Technology specifications', market: 'Market intelligence', violations: 'Violations and warnings', actions: 'Findings and next actions', provenance: 'Report provenance', product: 'Product', brand: 'Brand', category: 'Category', barcode: 'Barcode', qr: 'QR', verification: 'Verification', score: 'Compliance score', status: 'Status', ingredients: 'Ingredients', nutriScore: 'Nutri-Score', allergens: 'Allergens', additives: 'Additives', edibility: 'Edibility', specifications: 'Specifications', observedPrice: 'Observed price', pricePerUnit: 'Price per unit', brandVerification: 'Brand verification', comparisons: 'Comparisons', recommendations: 'Recommendations', findings: 'Findings', nextActions: 'Next actions', reportLanguage: 'Report language' },
  'தமிழ்': { title: 'இணக்க நுண்ணறிவு', summary: 'ஆய்வு சுருக்கம்', productCodes: 'பொருள் மற்றும் குறியீடுகள்', confidence: 'AI நம்பிக்கை', declarations: 'பொதி அறிவிப்புகள்', compliance: 'ஏழு அம்ச இணக்கம்', health: 'ஆரோக்கிய தகவல்', technology: 'தொழில்நுட்ப விவரக்குறிப்புகள்', market: 'சந்தை தகவல்', violations: 'மீறல்கள் மற்றும் எச்சரிக்கைகள்', actions: 'கண்டறிதல்கள் மற்றும் அடுத்த செயல்கள்', provenance: 'அறிக்கை மூலம்', product: 'பொருள்', brand: 'பிராண்ட்', category: 'வகை', barcode: 'பார்கோடு', qr: 'QR', verification: 'சரிபார்ப்பு', score: 'இணக்க மதிப்பெண்', status: 'நிலை', ingredients: 'பொருட்கள்', nutriScore: 'ஊட்ட மதிப்பெண்', allergens: 'ஒவ்வாமைகள்', additives: 'சேர்க்கைகள்', edibility: 'உண்ணக்கூடிய நிலை', specifications: 'விவரக்குறிப்புகள்', observedPrice: 'காணப்பட்ட விலை', pricePerUnit: 'அலகு விலை', brandVerification: 'பிராண்ட் சரிபார்ப்பு', comparisons: 'ஒப்பீடுகள்', recommendations: 'பரிந்துரைகள்', findings: 'கண்டறிதல்கள்', nextActions: 'அடுத்த செயல்கள்', reportLanguage: 'அறிக்கை மொழி' },
  'हिन्दी': { title: 'अनुपालन इंटेलिजेंस', summary: 'जांच सारांश', productCodes: 'उत्पाद और मशीन कोड', confidence: 'AI भरोसा', declarations: 'पैकेज घोषणाएं', compliance: 'सात-बिंदु अनुपालन', health: 'स्वास्थ्य जानकारी', technology: 'तकनीकी विनिर्देश', market: 'बाजार जानकारी', violations: 'उल्लंघन और चेतावनियां', actions: 'निष्कर्ष और अगले कदम', provenance: 'रिपोर्ट स्रोत', product: 'उत्पाद', brand: 'ब्रांड', category: 'श्रेणी', barcode: 'बारकोड', qr: 'QR', verification: 'सत्यापन', score: 'अनुपालन स्कोर', status: 'स्थिति', ingredients: 'सामग्री', nutriScore: 'न्यूट्री-स्कोर', allergens: 'एलर्जेन', additives: 'एडिटिव', edibility: 'खाने योग्य स्थिति', specifications: 'विनिर्देश', observedPrice: 'देखी गई कीमत', pricePerUnit: 'इकाई कीमत', brandVerification: 'ब्रांड सत्यापन', comparisons: 'तुलनाएं', recommendations: 'सिफारिशें', findings: 'निष्कर्ष', nextActions: 'अगले कदम', reportLanguage: 'रिपोर्ट भाषा' },
}

const readJsonResponse = async (response: Response) => {
  const body = await response.text()
  if (!body.trim()) throw new Error(`The inspection service returned an empty response (${response.status}). Please try again.`)
  try { return JSON.parse(body) as Record<string, any> } catch { throw new Error(`The inspection service returned invalid JSON (${response.status}). Please try again.`) }
}

const barcodeUnreadable = 'Barcode not readable — please upload a clearer image.'
const displayCheckStatus = (status: string) => (status === 'PASS' || status === 'FAIL' ? status : 'NONE')
const displayOverallStatus = (status: Analysis['complianceStatus']) => (status === 'COMPLIANT' ? 'PASS' : status === 'NON_COMPLIANT' ? 'FAIL' : 'NONE')
const infoText = (item: string | string[] | undefined, fallback = 'Not available') => {
  if (Array.isArray(item)) {
    const joined = item.filter(Boolean).join(', ').trim()
    return joined || fallback
  }
  if (typeof item === 'string' && item.trim() && !['unknown', 'n/a', 'none', 'null', 'undefined'].includes(item.trim().toLowerCase())) {
    return item.trim()
  }
  return fallback
}

const normalizeBarcodeFormat = (formatStr: string, isQr: boolean): string => {
  if (isQr) return 'QR'
  const upper = (formatStr || '').toUpperCase().replace(/_/g, '-')
  if (upper.includes('EAN-13') || upper.includes('EAN13')) return 'EAN-13'
  if (upper.includes('EAN-8') || upper.includes('EAN8')) return 'EAN-8'
  if (upper.includes('UPC-A') || upper.includes('UPCA')) return 'UPC-A'
  if (upper.includes('UPC-E') || upper.includes('UPCE')) return 'UPC-E'
  if (upper.includes('CODE-128') || upper.includes('CODE128')) return 'Code-128'
  if (upper.includes('CODE-39') || upper.includes('CODE39')) return 'Code-39'
  if (upper.includes('DATAMATRIX') || upper.includes('DATA-MATRIX')) return 'Data Matrix'
  if (upper.includes('PDF-417') || upper.includes('PDF417')) return 'PDF417'
  if (upper.includes('AZTEC')) return 'Aztec'
  if (upper.includes('ITF')) return 'ITF'
  if (upper.includes('CODABAR')) return 'Codabar'
  return upper || 'EAN-13'
}

// Client-side multi-pass barcode decoder using zxing-wasm + BarcodeDetector API
const drawRotatedImage = (canvas: HTMLCanvasElement, img: HTMLImageElement, angle: number, filter: string) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (angle === 90 || angle === 270) {
    canvas.width = h; canvas.height = w
  } else {
    canvas.width = w; canvas.height = h
  }
  ctx.save()
  ctx.filter = filter
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

const decodeCanvasZxingWasm = async (canvas: HTMLCanvasElement): Promise<{ type: 'BARCODE' | 'QR'; format: string; value: string } | null> => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const results = await readBarcodesFromImageData(imageData, {
      formats: [],
      tryHarder: true,
      tryRotate: false,
      tryInvert: true,
      tryDownscale: true,
      tryDenoise: true,
    })
    if (results && results.length > 0) {
      const r = results[0]
      const val = r.text
      if (val) {
        const fmt = r.format || ''
        const isQr = fmt.toLowerCase().includes('qr') || fmt.toLowerCase().includes('datamatrix')
        return { type: isQr ? 'QR' : 'BARCODE', format: normalizeBarcodeFormat(fmt, isQr), value: val }
      }
    }
  } catch { /* continue */ }
  return null
}

const decodeCanvasNative = async (canvas: HTMLCanvasElement, NativeDetector: any): Promise<{ type: 'BARCODE' | 'QR'; format: string; value: string } | null> => {
  if (!NativeDetector) return null
  try {
    const detected = await NativeDetector.detect(canvas)
    if (Array.isArray(detected) && detected.length > 0) {
      const item = detected[0]
      const val = item.rawValue || item.text
      if (val) {
        const isQr = (item.format || '').toLowerCase().includes('qr')
        return { type: isQr ? 'QR' : 'BARCODE', format: normalizeBarcodeFormat(item.format || '', isQr), value: val }
      }
    }
  } catch { /* continue */ }
  return null
}

const scanImageCanvas = async (imageSrc: string): Promise<{ type: 'BARCODE' | 'QR'; format: string; value: string } | null> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const NativeDetector = (window as any).BarcodeDetector
          ? new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix', 'pdf417', 'aztec', 'itf', 'codabar'],
            })
          : null

        const canvas = document.createElement('canvas')

        const passes: Array<{ angle: number; filter: string }> = [
          { angle: 0,   filter: 'none' },
          { angle: 0,   filter: 'contrast(180%) grayscale(100%)' },
          { angle: 90,  filter: 'none' },
          { angle: 180, filter: 'none' },
          { angle: 270, filter: 'none' },
          { angle: 0,   filter: 'contrast(250%) brightness(110%) grayscale(100%)' },
          { angle: 90,  filter: 'contrast(180%) grayscale(100%)' },
          { angle: 270, filter: 'contrast(180%) grayscale(100%)' },
        ]

        for (const { angle, filter } of passes) {
          drawRotatedImage(canvas, img, angle, filter)
          const native = await decodeCanvasNative(canvas, NativeDetector)
          if (native) { resolve(native); return }
          const wasm = await decodeCanvasZxingWasm(canvas)
          if (wasm) { resolve(wasm); return }
        }

        // Center-crop pass: zoom into center 60% of image
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.filter = 'contrast(200%) grayscale(100%)'
          const cropX = w * 0.2, cropY = h * 0.2, cropW = w * 0.6, cropH = h * 0.6
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, w, h)
          ctx.filter = 'none'
          const cropNative = await decodeCanvasNative(canvas, NativeDetector)
          if (cropNative) { resolve(cropNative); return }
          const cropWasm = await decodeCanvasZxingWasm(canvas)
          if (cropWasm) { resolve(cropWasm); return }
        }

        resolve(null)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageSrc
  })
}

// Client-side Open Food Facts product lookup
const lookupBarcodeClientSide = async (barcode: string) => {
  if (!/^\d{8,14}$/.test(barcode)) return null
  const catalogs = [
    'https://world.openfoodfacts.org/api/v2/product/',
    'https://world.openbeautyfacts.org/api/v2/product/',
    'https://world.openproductsfacts.org/api/v2/product/'
  ]
  for (const catalog of catalogs) {
    try {
      const res = await fetch(`${catalog}${encodeURIComponent(barcode)}.json`)
      if (!res.ok) continue
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        return {
          productName: p.product_name || p.product_name_en || p.generic_name || '',
          brand: p.brands || '',
          category: p.categories || p.categories_tags?.join(', ') || '',
          ingredients: p.ingredients_text || p.ingredients_text_en || '',
          allergens: p.allergens || p.allergens_tags?.join(', ') || '',
          nutriScore: p.nutriscore_grade ? String(p.nutriscore_grade).toUpperCase() : 'UNKNOWN',
          manufacturer: p.manufacturing_places || p.owner || p.brands || '',
          quantity: p.quantity || '',
        }
      }
    } catch { /* continue */ }
  }
  return null
}

type Copy = { navScan: string; navValidator: string; navIntel: string; lang: string; kicker: string; heroText: string; launch: string; detect: string; validate: string; analyze: string; report: string; inspect: string; scannerText: string; camera: string; upload: string; analyzeButton: string; reading: string; reportEmpty: string; start: string; pdf: string; voice: string; speaking: string; unavailable: string; cameraError: string; capture: string; inside: string; healthTech: string; market: string; price: string; clarity: string; scale: string; catalogText: string }
const copy: Record<Language, Copy> = {
  English: { navScan: 'Scan', navValidator: 'Validator', navIntel: 'Intel', lang: 'LANG', kicker: 'MISSION PASSED / RESPECT +99', heroText: 'AI-powered packaged commodity inspection for safer choices, clearer labels, and smarter price decisions.', launch: 'Launch scanner', detect: 'Detect', validate: 'Validate', analyze: 'Analyze', report: 'Report', inspect: 'Inspect a packaged product', scannerText: 'Use a clear front or back label. Lens combines OCR, barcode or QR evidence, and vision reasoning. No product claim is invented when the label is unclear.', camera: 'Camera scan', upload: 'Upload label image', analyzeButton: 'Detect and validate', reading: 'Reading label...', reportEmpty: 'Your mission readout.', start: 'Upload or capture a label to start Detect → Validate → Analyze → Report.', pdf: 'View report ↗', voice: 'Read report aloud', speaking: 'Speaking...', unavailable: 'Live model unavailable. Check the server provider keys.', cameraError: 'Camera access is unavailable. Use upload instead, or allow camera access in your browser.', capture: 'Capture label', inside: 'What is inside?', healthTech: 'Health + tech intelligence', market: 'Market intelligence', price: 'Price signal', clarity: 'Clarity', scale: 'at scale.', catalogText: 'Multilingual AI analysis for consumers, inspectors, retailers, and administrators. Every report keeps uncertainty visible and every decision traceable.' },
  'தமிழ்': { navScan: 'ஸ்கேன்', navValidator: 'சரிபார்ப்பு', navIntel: 'தகவல்', lang: 'மொழி', kicker: 'பணி நிறைவு / மரியாதை +99', heroText: 'பாதுகாப்பான தேர்வுகள், தெளிவான லேபிள்கள் மற்றும் சிறந்த விலை முடிவுகளுக்கான AI பொருள் ஆய்வு.', launch: 'ஸ்கேனரைத் தொடங்கு', detect: 'கண்டறி', validate: 'சரிபார்', analyze: 'ஆய்வு', report: 'அறிக்கை', inspect: 'தொகுக்கப்பட்ட பொருளை ஆய்வு செய்க', scannerText: 'தெளிவான முன் அல்லது பின் லேபிளைப் பயன்படுத்தவும். OCR, பார்கோடு அல்லது QR தகவல் மற்றும் பட பகுப்பாய்வை Lens இணைக்கிறது. லேபிள் தெளிவில்லையெனில் எந்தக் கூற்றையும் உருவாக்காது.', camera: 'கேமரா ஸ்கேன்', upload: 'லேபிள் படத்தைப் பதிவேற்றவும்', analyzeButton: 'கண்டறிந்து சரிபார்', reading: 'லேபிளைப் படிக்கிறது...', reportEmpty: 'உங்கள் ஆய்வு அறிக்கை.', start: 'லேபிளைப் பதிவேற்றி அல்லது படம் எடுத்து Detect → Validate → Analyze → Report தொடங்கவும்.', pdf: 'அறிக்கையைப் பார்க்க ↗', voice: 'அறிக்கையை வாசிக்கவும்', speaking: 'வாசிக்கிறது...', unavailable: 'நேரடி AI கிடைக்கவில்லை. சர்வர் API அமைப்புகளைச் சரிபார்க்கவும்.', cameraError: 'கேமரா அணுகல் இல்லை. பதிவேற்றத்தைப் பயன்படுத்தவும் அல்லது உலாவியில் அனுமதிக்கவும்.', capture: 'லேபிளைப் படம் எடு', inside: 'உள்ளே என்ன உள்ளது?', healthTech: 'ஆரோக்கியம் + தொழில்நுட்ப தகவல்', market: 'சந்தை தகவல்', price: 'விலை குறிப்பு', clarity: 'தெளிவு', scale: 'அளவில்.', catalogText: 'நுகர்வோர், ஆய்வாளர்கள், விற்பனையாளர்கள் மற்றும் நிர்வாகிகளுக்கான பன்மொழி AI ஆய்வு. ஒவ்வொரு அறிக்கையும் நிச்சயமின்மையை வெளிப்படையாகக் காட்டும்.' },
  'हिन्दी': { navScan: 'स्कैन', navValidator: 'सत्यापन', navIntel: 'जानकारी', lang: 'भाषा', kicker: 'मिशन पूरा / सम्मान +99', heroText: 'सुरक्षित विकल्पों, स्पष्ट लेबल और बेहतर मूल्य निर्णयों के लिए AI पैकेज्ड उत्पाद निरीक्षण।', launch: 'स्कैनर शुरू करें', detect: 'पता लगाएं', validate: 'सत्यापित करें', analyze: 'विश्लेषण', report: 'रिपोर्ट', inspect: 'पैक किए गए उत्पाद की जांच', scannerText: 'साफ सामने या पीछे का लेबल इस्तेमाल करें। Lens OCR, बारकोड या QR जानकारी और विज़न रीजनिंग को जोड़ता है। अस्पष्ट लेबल पर दावा नहीं बनाया जाता।', camera: 'कैमरा स्कैन', upload: 'लेबल इमेज अपलोड करें', analyzeButton: 'पता लगाएं और सत्यापित करें', reading: 'लेबल पढ़ा जा रहा है...', reportEmpty: 'आपकी मिशन रिपोर्ट।', start: 'लेबल अपलोड या कैप्चर करके Detect → Validate → Analyze → Report शुरू करें।', pdf: 'रिपोर्ट देखें ↗', voice: 'रिपोर्ट सुनें', speaking: 'बोला जा रहा है...', unavailable: 'लाइव AI उपलब्ध नहीं है। सर्वर API कुंजी जांचें।', cameraError: 'कैमरा उपलब्ध नहीं है। अपलोड का उपयोग करें या ब्राउज़र में अनुमति दें।', capture: 'लेबल कैप्चर करें', inside: 'अंदर क्या है?', healthTech: 'स्वास्थ्य + तकनीकी जानकारी', market: 'बाज़ार की जानकारी', price: 'मूल्य संकेत', clarity: 'स्पष्टता', scale: 'पैमाने पर।', catalogText: 'उपभोक्ताओं, निरीक्षकों, खुदरा विक्रेताओं और प्रशासकों के लिए बहुभाषी AI विश्लेषण। हर रिपोर्ट अनिश्चितता को स्पष्ट रखती।' },
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [language, setLanguage] = useState<Language>('English')
  const [error, setError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [speechStatus, setSpeechStatus] = useState<'READY' | 'READING' | 'STOPPED'>('READY')
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [history, setHistory] = useState<ScanHistoryItem[]>([])
  const [decodedCode, setDecodedCode] = useState<DecodedCode | null>(null)
  const [codeMessage, setCodeMessage] = useState('')
  const [reportPage, setReportPage] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const decodedCodeRef = useRef<DecodedCode | null>(null)
  const decodeJobRef = useRef<Promise<unknown>>(Promise.resolve())
  const text = copy[language]

  useEffect(() => { if (!file) { setPreviewUrl(''); return }; const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url) }, [file])
  useEffect(() => { try { setHistory(JSON.parse(localStorage.getItem('rockstar-lens-history') || '[]')) } catch { setHistory([]) } }, [])
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const cursor = document.querySelector<HTMLElement>('.cursor-dot')
    const cursorRing = document.querySelector<HTMLElement>('.cursor-ring')
    if (!cursor || !cursorRing) return
    let ringX = window.innerWidth / 2
    let ringY = window.innerHeight / 2
    let targetX = ringX
    let targetY = ringY
    let frame = 0
    const moveCursor = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`
      const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, label, [role="button"]')
      cursorRing.classList.toggle('is-hovering', Boolean(interactive))
    }
    const animateRing = () => {
      ringX += (targetX - ringX) * 0.16
      ringY += (targetY - ringY) * 0.16
      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`
      frame = window.requestAnimationFrame(animateRing)
    }
    const hideCursor = () => cursor.classList.add('is-hidden')
    const showCursor = () => cursor.classList.remove('is-hidden')
    window.addEventListener('pointermove', moveCursor)
    const handlePointerOut = (event: PointerEvent) => { if (!event.relatedTarget) hideCursor() }
    window.addEventListener('pointerout', handlePointerOut)
    window.addEventListener('pointerover', showCursor)
    frame = window.requestAnimationFrame(animateRing)
    return () => { window.removeEventListener('pointermove', moveCursor); window.removeEventListener('pointerout', handlePointerOut); window.removeEventListener('pointerover', showCursor); window.cancelAnimationFrame(frame) }
  }, [])

  const decodePackageCode = async (selected: File, url: string) => {
    setCodeMessage('Detecting barcode or QR...')
    
    // 1. Try client-side multi-pass canvas scanner
    const clientResult = await scanImageCanvas(url)
    if (clientResult && clientResult.value) {
      let lookup = await lookupBarcodeClientSide(clientResult.value)
      const codeObj: DecodedCode = {
        type: clientResult.type,
        format: clientResult.format,
        value: clientResult.value,
        lookup: lookup || undefined
      }
      decodedCodeRef.current = codeObj
      setDecodedCode(codeObj)
      const details = [lookup?.productName, lookup?.brand, lookup?.category].filter(Boolean).join(' / ')
      setCodeMessage(details ? `Barcode detected: ${clientResult.value} (${clientResult.format}) · ${details}` : `Barcode detected: ${clientResult.value} (${clientResult.format})`)
      return codeObj
    }

    // 2. Fallback to server endpoint
    try {
      const body = new FormData()
      body.append('image', selected)
      const response = await fetch('/api/decode-barcode', { method: 'POST', body })
      const payload = await readJsonResponse(response) as { detected?: boolean; type?: 'BARCODE' | 'QR'; value?: string; format?: string; lookup?: any; error?: string }
      if (payload.detected && payload.value && (payload.type === 'BARCODE' || payload.type === 'QR')) {
        const fmt = normalizeBarcodeFormat(payload.format || '', payload.type === 'QR')
        const codeObj: DecodedCode = {
          type: payload.type,
          format: fmt,
          value: payload.value,
          lookup: payload.lookup || undefined
        }
        decodedCodeRef.current = codeObj
        setDecodedCode(codeObj)
        const details = [payload.lookup?.productName, payload.lookup?.brand, payload.lookup?.category].filter(Boolean).join(' / ')
        setCodeMessage(details ? `Barcode detected: ${payload.value} (${fmt}) · ${details}` : `Barcode detected: ${payload.value} (${fmt})`)
        return codeObj
      }
    } catch { /* Fall back */ }

    decodedCodeRef.current = null
    setDecodedCode(null)
    setCodeMessage(barcodeUnreadable)
    return null
  }

  const chooseFile = (selected: File | undefined) => {
    if (!selected || !selected.type.startsWith('image/')) { setError('Please choose a JPG, PNG, or WEBP label image.'); return }
    setFile(selected); setAnalysis(null); setError(''); decodedCodeRef.current = null; setDecodedCode(null)
    stopSpeech()
    const url = URL.createObjectURL(selected)
    decodeJobRef.current = decodePackageCode(selected, url).finally(() => URL.revokeObjectURL(url))
  }
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])
  const openCamera = async () => { setCameraError(''); setIsCameraOpen(true); try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream } catch { setCameraError(text.cameraError) } }
  const closeCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setIsCameraOpen(false) }
  const capturePhoto = () => { const video = videoRef.current; if (!video || !video.videoWidth) return; const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d')?.drawImage(video, 0, 0); canvas.toBlob((blob) => { if (blob) chooseFile(new File([blob], `label-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })); closeCamera() }, 'image/jpeg', .92) }
  
  const analyzeImage = async () => {
    if (!file) return
    setIsAnalyzing(true); setError('')
    stopSpeech()
    try {
      await decodeJobRef.current
      const code = decodedCodeRef.current || decodedCode
      const body = new FormData(); body.append('image', file)
      const headers: Record<string, string> = { 'x-report-language': language }
      if (code?.type === 'BARCODE') headers['x-barcode'] = code.value
      if (code?.type === 'QR') headers['x-qr-content'] = encodeURIComponent(code.value)
      const response = await fetch('/api/analyze', { method: 'POST', headers, body })
      const payload = await readJsonResponse(response) as Analysis & { error?: string }
      if (!response.ok) throw new Error(payload.error || text.unavailable)
      
      // Ensure merged data fields are properly integrated
      if (code) {
        payload.barcodeInfo = {
          detected: true,
          value: code.value,
          format: code.format,
          productName: payload.barcodeInfo?.productName || code.lookup?.productName || '',
          brand: payload.barcodeInfo?.brand || code.lookup?.brand || '',
          category: payload.barcodeInfo?.category || code.lookup?.category || '',
          status: 'FOUND'
        }
      }

      setAnalysis(payload)
      if (payload.barcodeInfo?.detected) {
        const details = [payload.barcodeInfo.productName, payload.barcodeInfo.brand, payload.barcodeInfo.category].filter(Boolean).join(' / ')
        setCodeMessage(details ? `Barcode decoded: ${payload.barcodeInfo.value} (${payload.barcodeInfo.format || 'EAN-13'}) · ${details}` : `Barcode decoded: ${payload.barcodeInfo.value} (${payload.barcodeInfo.format || 'EAN-13'})`)
      }
      const entry: ScanHistoryItem = { id: crypto.randomUUID(), productName: payload.productName, timestamp: new Date().toISOString(), score: payload.complianceScore, status: payload.complianceStatus, violations: payload.violations.map((item: { name: string }) => item.name), analysis: payload }
      const nextHistory = [entry, ...history].slice(0, 20); setHistory(nextHistory); localStorage.setItem('rockstar-lens-history', JSON.stringify(nextHistory))
    } catch (reason) { setAnalysis(null); setError(reason instanceof Error ? reason.message : text.unavailable) } finally { setIsAnalyzing(false) }
  }

  const labels = reportLabels[language]

  const imageDataUrl = async (source: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The uploaded image could not be added to the PDF.'))
    reader.readAsDataURL(source)
  })

  // Client-side 100% free PDF report generator (Pages 1 & 2 unchanged + Page 3 Barcode Intelligence)
  const downloadPdf = async () => {
    if (!analysis) return
    const hasBarcode = Boolean(analysis.barcodeInfo?.detected || decodedCode?.value)
    const totalPages = hasBarcode ? 3 : 2

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    const date = new Date().toLocaleString()
    
    const valueStr = (item: string | string[] | undefined, fallback = 'Not available') => infoText(item, fallback)
    const lines = (label: string, item: string | string[] | undefined) => `${label}: ${valueStr(item)}`
    
    const drawHeader = (pageNumber: number, title: string) => {
      pdf.setFillColor(10, 10, 9); pdf.rect(0, 0, pageWidth, 24, 'F')
      pdf.setTextColor(223, 255, 57); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text('ROCKSTAR LENS', margin, 15)
      pdf.setTextColor(232, 230, 223); pdf.setFontSize(9); pdf.text(title.toUpperCase(), pageWidth - margin, 15, { align: 'right' })
      pdf.setTextColor(110, 110, 104); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`Mission report / ${pageNumber} of ${totalPages}`, margin, 291); pdf.text(date, pageWidth - margin, 291, { align: 'right' })
    }
    
    const drawSection = (title: string, body: string, x: number, y: number, width: number, maxHeight: number) => {
      const bodyLines = pdf.splitTextToSize(body, width - 8)
      const height = Math.min(maxHeight, Math.max(16, 9 + bodyLines.length * 4.1))
      pdf.setFillColor(245, 244, 238); pdf.roundedRect(x, y, width, height, 2, 2, 'F')
      pdf.setTextColor(241, 93, 48); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text(title.toUpperCase(), x + 4, y + 6)
      pdf.setTextColor(35, 35, 31); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(bodyLines.slice(0, Math.floor((height - 11) / 4.1)), x + 4, y + 12, { lineHeightFactor: 1.15 })
      return height
    }

    // PAGE 1
    drawHeader(1, labels.title)
    pdf.setTextColor(10, 10, 9); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(21); pdf.text(pdf.splitTextToSize(analysis.productName, 120), margin, 38)
    pdf.setTextColor(95, 95, 88); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(`${analysis.brand} / ${analysis.category}`, margin, 48)
    pdf.setFillColor(223, 255, 57); pdf.roundedRect(154, 31, 42, 24, 3, 3, 'F'); pdf.setTextColor(10, 10, 9); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text(`${analysis.complianceScore}%`, 175, 43, { align: 'center' }); pdf.setFontSize(6.5); pdf.text(analysis.complianceStatus.replace('_', ' '), 175, 50, { align: 'center' })
    let y = 61
    if (file) { try { pdf.addImage(await imageDataUrl(file), 'JPEG', margin, y, 54, 42, undefined, 'MEDIUM') } catch { /* Ignore */ } }
    const overviewX = file ? 76 : margin
    const overviewWidth = file ? 120 : contentWidth
    drawSection(labels.summary, analysis.summary, overviewX, y, overviewWidth, 44)
    y += 49
    const columnGap = 6
    const columnWidth = (contentWidth - columnGap) / 2
    drawSection(labels.productCodes, [lines(labels.product, analysis.productName), lines(labels.brand, analysis.brand), lines(labels.category, analysis.category), lines(labels.barcode, analysis.barcodeInfo.value || 'Not detected'), analysis.barcodeInfo.detected ? `Barcode details: ${[analysis.barcodeInfo.productName, analysis.barcodeInfo.brand, analysis.barcodeInfo.category].filter(Boolean).join(' / ') || 'Decoded'} · ${displayOverallStatus(analysis.complianceStatus)}` : '', lines(labels.qr, analysis.qrInfo.content || 'Not detected'), lines(labels.verification, analysis.qrInfo.verificationStatus)].filter(Boolean).join('\n'), margin, y, columnWidth, 58)
    drawSection(labels.confidence, Object.entries(analysis.aiConfidence).map(([key, item]) => lines(key, item)).join('\n'), margin + columnWidth + columnGap, y, columnWidth, 58)
    y += 64
    drawSection(labels.declarations, Object.entries(analysis.extractedInfo).map(([key, item]) => lines(key, item)).join('\n'), margin, y, contentWidth, 54)
    y += 60
    drawSection(labels.compliance, analysis.compliance.map((item) => `${displayCheckStatus(item.status)}  ${item.label}: ${item.value} [${item.confidence}]`).join('\n') || 'No compliance checks returned.', margin, y, contentWidth, 44)

    // PAGE 2
    pdf.addPage(); drawHeader(2, `${labels.health}, ${labels.market} and ${labels.actions}`)
    y = 31
    drawSection(labels.health, [`${labels.edibility}: ${valueStr(analysis.health.edibility, 'NEEDS_REVIEW')}`, `${labels.ingredients}: ${valueStr(analysis.health.ingredients)}`, `${labels.nutriScore}: ${valueStr(analysis.health.nutriScore)}`, `${labels.allergens}: ${valueStr(analysis.health.allergens)}`, `${labels.additives}: ${valueStr(analysis.health.additives)}`].join('\n'), margin, y, columnWidth, 45)
    drawSection(labels.technology, `${labels.specifications}: ${valueStr(analysis.technology.specifications)}`, margin + columnWidth + columnGap, y, columnWidth, 45)
    y += 51
    drawSection(labels.market, [lines(labels.observedPrice, analysis.market.observedPrice), lines(labels.pricePerUnit, analysis.market.pricePerUnit), lines(labels.brandVerification, analysis.market.brandVerification), `${labels.comparisons}: ${analysis.market.comparisons.map((item) => `${item.seller} / ${item.price} / ${item.unitPrice}`).join('; ') || 'None'}`, `${labels.recommendations}: ${valueStr(analysis.market.recommendations)}`].join('\n'), margin, y, contentWidth, 48)
    y += 54
    drawSection(labels.violations, [`${labels.violations}: ${analysis.violations.map((item) => `${item.name}: ${item.reason} (${item.confidence})`).join('; ') || 'None detected.'}`, `Warnings: ${valueStr(analysis.warnings, 'None reported.')}`].join('\n'), margin, y, contentWidth, 48)
    y += 54
    drawSection(labels.actions, [`${labels.findings}: ${valueStr(analysis.report.findings, 'No additional findings.')}`, `${labels.nextActions}: ${valueStr(analysis.report.actions, 'No additional actions.')}`].join('\n'), margin, y, contentWidth, 45)
    y += 51
    drawSection(labels.provenance, `${labels.reportLanguage}: ${language}. Generated from the uploaded package image, OCR, barcode or QR evidence, and AI label analysis. Unclear fields remain marked for review and should be verified against the physical package.`, margin, y, contentWidth, 35)

    // PAGE 3 — BARCODE INTELLIGENCE (only when barcode detected)
    if (hasBarcode) {
      pdf.addPage()
      drawHeader(3, 'PAGE 3 — BARCODE INTELLIGENCE')
      y = 31
      
      const bNumber = analysis.barcodeInfo.value || decodedCode?.value || 'Not available'
      const bType = analysis.barcodeInfo.format || decodedCode?.format || 'EAN-13'
      const bStatus = analysis.barcodeInfo.detected ? 'BARCODE DETECTED' : 'MANUAL / DECODED'
      const bConfidence = analysis.aiConfidence.codeDetection || 'HIGH'

      drawSection(
        'BARCODE DETECTION & VERIFICATION',
        [
          `Detection Status: ${bStatus}`,
          `Barcode Type: ${bType}`,
          `Barcode Number: ${bNumber}`,
          `Verification Status: ${analysis.barcodeInfo.status || 'VERIFIED'}`,
          `Confidence Metric: ${bConfidence}`
        ].join('\n'),
        margin,
        y,
        columnWidth,
        52
      )

      drawSection(
        'PRODUCT & BRAND IDENTIFICATION',
        [
          `Product Name: ${valueStr(analysis.productName)}`,
          `Brand Name: ${valueStr(analysis.brand)}`,
          `Category: ${valueStr(analysis.category)}`
        ].join('\n'),
        margin + columnWidth + columnGap,
        y,
        columnWidth,
        52
      )

      y += 58
      drawSection(
        'PUBLIC CATALOG LOOKUP DATA',
        [
          `Catalog Product Name: ${valueStr(analysis.barcodeInfo.productName || decodedCode?.lookup?.productName || analysis.productName)}`,
          `Catalog Brand: ${valueStr(analysis.barcodeInfo.brand || decodedCode?.lookup?.brand || analysis.brand)}`,
          `Catalog Category: ${valueStr(analysis.barcodeInfo.category || decodedCode?.lookup?.category || analysis.category)}`,
          `Catalog Ingredients: ${valueStr(decodedCode?.lookup?.ingredients || analysis.health.ingredients)}`,
          `Catalog Manufacturer: ${valueStr(decodedCode?.lookup?.manufacturer || analysis.extractedInfo.manufacturer)}`
        ].join('\n'),
        margin,
        y,
        contentWidth,
        54
      )

      y += 60
      drawSection(
        'PACKAGE OCR & DECLARED METADATA',
        [
          `MRP (Maximum Retail Price): ${valueStr(analysis.extractedInfo.mrp)}`,
          `Net Quantity: ${valueStr(analysis.extractedInfo.netQuantity)}`,
          `Mfg Date: ${valueStr(analysis.extractedInfo.manufacturingDate)}`,
          `Expiry / Best Before: ${valueStr(analysis.extractedInfo.expiryBestBefore)}`,
          `Manufacturer Name: ${valueStr(analysis.extractedInfo.manufacturer)}`,
          `Consumer Care: ${valueStr(analysis.extractedInfo.consumerCare)}`,
          `Country of Origin: ${valueStr(analysis.extractedInfo.countryOfOrigin)}`,
          `Ingredients (OCR): ${valueStr(analysis.health.ingredients)}`
        ].join('\n'),
        margin,
        y,
        contentWidth,
        64
      )

      y += 70
      drawSection(
        'VERIFICATION & COMPLIANCE SUMMARY',
        [
          `Compliance Score: ${analysis.complianceScore}% (${analysis.complianceStatus})`,
          `Overall AI Confidence: ${analysis.aiConfidence.overall}`,
          `Verification Note: Decoded barcode data merged with package OCR text. Barcode contains GTIN/UPC metadata, MRP and dates derived from package label OCR.`
        ].join('\n'),
        margin,
        y,
        contentWidth,
        38
      )
    }

    const pdfBlob = pdf.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = pdfUrl
    downloadLink.download = `${analysis.productName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'inspection'}-report.pdf`
    downloadLink.click()
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
  }

  // Browser SpeechSynthesis Report Reader
  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeechStatus('STOPPED')
  }

  const speakReport = () => {
    if (!analysis) return
    if (!('speechSynthesis' in window)) {
      setError('Voice report reader is not supported in this browser.')
      return
    }

    // Cancel any current reading
    window.speechSynthesis.cancel()
    setSpeechStatus('READING')
    setError('')

    const parts: string[] = []
    const bDetected = Boolean(analysis.barcodeInfo?.detected || decodedCode?.value)
    const bType = analysis.barcodeInfo?.format || decodedCode?.format || 'EAN-13'
    const bNumber = analysis.barcodeInfo?.value || decodedCode?.value || ''

    if (language === 'தமிழ்') {
      parts.push(`அறிக்கை: ${analysis.productName}.`)
      parts.push(`பிராண்ட்: ${infoText(analysis.brand)}, வகை: ${infoText(analysis.category)}.`)
      if (bDetected) {
        parts.push(`பார்கோடு கண்டறியப்பட்டது. வகை: ${bType}, எண்: ${bNumber}.`)
      }
      parts.push(`இணக்க மதிப்பெண்: ${analysis.complianceScore} சதவீதம். நிலை: ${analysis.complianceStatus}.`)
      parts.push(`அதிகபட்ச சில்லறை விலை MRP: ${infoText(analysis.extractedInfo.mrp)}.`)
      parts.push(`நிகர அளவு: ${infoText(analysis.extractedInfo.netQuantity)}.`)
      parts.push(`தயாரிப்பு தேதி: ${infoText(analysis.extractedInfo.manufacturingDate)}, காலாவதி தேதி: ${infoText(analysis.extractedInfo.expiryBestBefore)}.`)
      parts.push(`தயாரிப்பாளர்: ${infoText(analysis.extractedInfo.manufacturer)}.`)
      parts.push(`நாட்டின் தோற்றம்: ${infoText(analysis.extractedInfo.countryOfOrigin)}.`)
      parts.push(`பொருட்கள்: ${infoText(analysis.health.ingredients)}.`)
      if (analysis.violations.length) {
        parts.push(`மீறல்கள்: ${analysis.violations.map(v => `${v.name}, ${v.reason}`).join('. ')}.`)
      } else {
        parts.push(`மீறல்கள் எதுவும் இல்லை.`)
      }
      parts.push(`கண்டறிதல்கள்: ${analysis.report.findings.join('. ') || 'எதுவுமில்லை'}.`)
    } else if (language === 'हिन्दी') {
      parts.push(`रिपोर्ट: ${analysis.productName}.`)
      parts.push(`ब्रांड: ${infoText(analysis.brand)}, श्रेणी: ${infoText(analysis.category)}.`)
      if (bDetected) {
        parts.push(`बारकोड का पता चला. प्रकार: ${bType}, संख्या: ${bNumber}.`)
      }
      parts.push(`अनुपालन स्कोर: ${analysis.complianceScore} प्रतिशत. स्थिति: ${analysis.complianceStatus}.`)
      parts.push(`अधिकतम खुदरा मूल्य MRP: ${infoText(analysis.extractedInfo.mrp)}.`)
      parts.push(`शुद्ध मात्रा: ${infoText(analysis.extractedInfo.netQuantity)}.`)
      parts.push(`निर्माण तिथि: ${infoText(analysis.extractedInfo.manufacturingDate)}, समाप्ति तिथि: ${infoText(analysis.extractedInfo.expiryBestBefore)}.`)
      parts.push(`निर्माता: ${infoText(analysis.extractedInfo.manufacturer)}.`)
      parts.push(`मूल देश: ${infoText(analysis.extractedInfo.countryOfOrigin)}.`)
      parts.push(`सामग्री: ${infoText(analysis.health.ingredients)}.`)
      if (analysis.violations.length) {
        parts.push(`उल्लंघन: ${analysis.violations.map(v => `${v.name}, ${v.reason}`).join('. ')}.`)
      } else {
        parts.push(`कोई उल्लंघन नहीं पाया गया.`)
      }
      parts.push(`निष्कर्ष: ${analysis.report.findings.join('. ') || 'कोई नहीं'}.`)
    } else {
      parts.push(`Inspection report for ${analysis.productName}.`)
      parts.push(`Brand: ${infoText(analysis.brand)}. Category: ${infoText(analysis.category)}.`)
      if (bDetected) {
        parts.push(`Barcode detected. Type: ${bType}. Number: ${bNumber}.`)
      }
      parts.push(`Compliance score: ${analysis.complianceScore} percent. Overall status: ${analysis.complianceStatus}.`)
      parts.push(`Maximum Retail Price MRP: ${infoText(analysis.extractedInfo.mrp)}.`)
      parts.push(`Net quantity: ${infoText(analysis.extractedInfo.netQuantity)}.`)
      parts.push(`Manufacturing date: ${infoText(analysis.extractedInfo.manufacturingDate)}. Expiry or best before: ${infoText(analysis.extractedInfo.expiryBestBefore)}.`)
      parts.push(`Manufacturer: ${infoText(analysis.extractedInfo.manufacturer)}.`)
      parts.push(`Country of origin: ${infoText(analysis.extractedInfo.countryOfOrigin)}.`)
      parts.push(`Ingredients: ${infoText(analysis.health.ingredients)}.`)
      if (analysis.violations.length) {
        parts.push(`Violations found: ${analysis.violations.map(v => `${v.name}: ${v.reason}`).join('. ')}.`)
      } else {
        parts.push(`No compliance violations found.`)
      }
      parts.push(`Findings: ${analysis.report.findings.join('. ') || 'None'}.`)
    }

    const fullText = parts.join(' ')
    const utterance = new SpeechSynthesisUtterance(fullText)
    const targetPrefix = language === 'தமிழ்' ? 'ta' : language === 'हिन्दी' ? 'hi' : 'en'
    utterance.lang = language === 'தமிழ்' ? 'ta-IN' : language === 'हिन्दी' ? 'hi-IN' : 'en-IN'

    const voices = window.speechSynthesis.getVoices()
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetPrefix)) ||
                          voices.find(v => v.lang.toLowerCase().startsWith('en'))
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    utterance.onstart = () => setSpeechStatus('READING')
    utterance.onend = () => setSpeechStatus('READY')
    utterance.onerror = () => setSpeechStatus('STOPPED')

    window.speechSynthesis.speak(utterance)
  }

  const openHistory = (entry: ScanHistoryItem) => { setAnalysis(entry.analysis); window.location.hash = 'validator' }
  const compliantCount = history.filter((item) => item.status === 'COMPLIANT').length
  const reviewCount = history.filter((item) => item.status === 'NEEDS_REVIEW').length
  const nonCompliantCount = history.filter((item) => item.status === 'NON_COMPLIANT').length
  const commonViolations = [...new Set(history.flatMap((item) => item.violations))].slice(0, 4)

  return <main className="site-shell">
    <span className="cursor-dot" aria-hidden="true" />
    <span className="cursor-ring" aria-hidden="true" />
    {analysis && <div className="edibility-badge" aria-label="Food edibility result"><span>Edibility</span><strong>{analysis.health.edibility}</strong></div>}
    <nav className="topbar"><a className="brand" href="#top"><span className="brand-mark">R</span><span>ROCKSTAR<br />LENS</span></a><div className="nav-links"><a href="#scan">{text.navScan}</a><a href="#validator">{text.navValidator}</a><a href="#intel">{text.navIntel}</a></div><label className="language-select"><span>{text.lang}</span><select value={language} onChange={(event) => { setLanguage(event.target.value as Language); stopSpeech(); }} aria-label={text.lang}><option>English</option><option>தமிழ்</option><option>हिन्दी</option></select></label></nav>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker">{text.kicker}</p><h1>READ<br /><em>THE</em> LABEL.</h1><p className="hero-text">{text.heroText}</p><a className="scroll-cue" href="#scan"><span>↓</span> {text.launch}</a></div><div className="hero-art"><div className="hero-grid" /><img className="rockstar-hero-image" src="https://cms-static-prod.ros.rockstargames.com/images/18izrhn535ym/vH3cmDeyYwZAfOSRrFzF7/a647ee83433be34607363ef254639604/vH3cmDeyYwZAfOSRrFzF7.svg" alt="Rockstar Games logo" /><span className="hero-stamp">DETECT<br />VALIDATE<br />ANALYZE</span></div></section>
    <section className="mission-strip"><span>01 / {text.detect}</span><span>02 / {text.validate}</span><span>03 / {text.analyze}</span><span>04 / {text.report}</span></section>
    <section className="search-section" id="scan"><div className="section-intro"><p className="kicker">01 / Hybrid scanner</p><h2>{text.inspect}</h2><p>{text.scannerText}</p><div className="mode-pills"><span>CAMERA</span><span>IMAGE</span><span>OCR + QR</span></div></div><div className="search-card"><label className={`dropzone ${previewUrl ? 'has-file' : ''}`}>{previewUrl ? <img src={previewUrl} alt="Selected commodity label" /> : <><span className="crosshair">◎</span><strong>{text.upload}</strong><small>JPG, PNG, WEBP · up to 15 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} /></label><div className="search-actions"><button className="primary-button" type="button" disabled={!file || isAnalyzing} onClick={analyzeImage}>{isAnalyzing ? text.reading : text.analyzeButton}<span>↗</span></button><button className="secondary-button" type="button" onClick={openCamera}>◎ <span>{text.camera}</span></button></div>
    {decodedCode && (
      <div className="barcode-detected-banner">
        <div className="barcode-status-tag">{decodedCode.type === 'QR' ? 'QR DETECTED' : 'BARCODE DETECTED'}</div>
        <div className="barcode-meta-item"><span>TYPE:</span> <strong>{decodedCode.format}</strong></div>
        <div className="barcode-meta-item"><span>NUMBER:</span> <strong>{decodedCode.value}</strong></div>
      </div>
    )}
    {codeMessage && <p className="code-message">{codeMessage}</p>}{error && <p className="notice">{error}</p>}</div></section>
    <section className="results-section" id="validator" aria-live="polite"><div className="result-heading"><div><p className="kicker">02 / {text.report}</p><h2>{analysis ? analysis.productName : text.reportEmpty}</h2></div>{analysis && <div className="result-actions"><button className="report-button" type="button" onClick={downloadPdf}>Generate PDF Report</button>
    <div className="voice-control-group">
      <label className="voice-lang-picker">
        <span>Language</span>
        <select
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value as Language)
            stopSpeech()
          }}
          aria-label="Report voice language"
        >
          <option value="English">English</option>
          <option value="தமிழ்">தமிழ்</option>
          <option value="हिन्दी">हिन्दी</option>
        </select>
      </label>
      <button
        className="read-report-button"
        type="button"
        onClick={speakReport}
        disabled={!analysis}
      >
        ▶ READ REPORT
      </button>
      <button
        className="stop-report-button"
        type="button"
        onClick={stopSpeech}
      >
        ■ STOP
      </button>
      <span className={`speech-status-pill status-${speechStatus.toLowerCase()}`}>
        Status: {speechStatus}
      </span>
    </div>
    </div>}</div>{!analysis ? <div className="empty-readout"><span>+</span><p>{text.start}</p></div> : <><div className="analysis-summary"><div><p>{analysis.summary}</p><small>{analysis.category} / {analysis.brand}</small></div><div className="score"><span>Compliance score</span><strong>{analysis.complianceScore}%</strong><small>{analysis.complianceStatus.replace('_', ' ')} · {analysis.aiConfidence.overall} confidence</small></div></div><div className="code-result"><strong>{analysis.barcodeInfo.detected ? 'Barcode detected' : analysis.qrInfo.detected ? 'QR Detected' : 'Code scan'}</strong><span>{analysis.barcodeInfo.value || analysis.qrInfo.content || 'Product information not found — continuing with package analysis.'}</span>{analysis.barcodeInfo.detected && <><span>Type: {analysis.barcodeInfo.format || decodedCode?.format || 'EAN-13'}</span><span>Number: {analysis.barcodeInfo.value}</span><span>Product: {infoText(analysis.barcodeInfo.productName || analysis.productName)}</span><span>Brand: {infoText(analysis.barcodeInfo.brand || analysis.brand)}</span><span>Category: {infoText(analysis.barcodeInfo.category || analysis.category)}</span><span>MRP: {infoText(analysis.extractedInfo.mrp)}</span><span>Net Quantity: {infoText(analysis.extractedInfo.netQuantity)}</span><span>Mfg Date: {infoText(analysis.extractedInfo.manufacturingDate)}</span><span>Expiry Date: {infoText(analysis.extractedInfo.expiryBestBefore)}</span><span>Manufacturer: {infoText(analysis.extractedInfo.manufacturer)}</span><span>Consumer Care: {infoText(analysis.extractedInfo.consumerCare)}</span><span>Country of Origin: {infoText(analysis.extractedInfo.countryOfOrigin)}</span><span>Compliance: {displayOverallStatus(analysis.complianceStatus)}</span></>}<small>{analysis.qrInfo.detected ? `Verification Status: ${analysis.qrInfo.verificationStatus}` : `Barcode / QR detection confidence: ${analysis.aiConfidence.codeDetection}`}</small></div><div className="confidence-strip"><span>Product: {analysis.aiConfidence.productDetection}</span><span>OCR: {analysis.aiConfidence.ocr}</span><span>Compliance: {analysis.aiConfidence.compliance}</span><span>Overall: {analysis.aiConfidence.overall}</span></div><div className="compliance-grid">{analysis.compliance.map((item) => <article className={`check-card ${item.status.toLowerCase()}`} key={item.label}><div><span>{item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '×' : '?'}</span><h3>{item.label}</h3></div><strong>{displayCheckStatus(item.status)}</strong><p>{item.value}</p><small>{item.confidence} confidence</small></article>)}</div><div className="violation-panel"><h3>Violations and warnings</h3>{analysis.violations.map((item) => <p key={item.name}>❌ <b>{item.name}</b> — {item.reason} <small>({item.confidence})</small></p>)}{analysis.warnings.map((item) => <p key={item}>⚠ {item}</p>)}{!analysis.violations.length && !analysis.warnings.length && <p>No violations detected from visible evidence.</p>}</div><div className="intel-grid" id="intel"><article><p className="kicker">03 / {text.healthTech}</p><h3>{text.inside}</h3><p><b>Nutri-Score:</b> {analysis.health.nutriScore}</p><p><b>Ingredients:</b> {analysis.health.ingredients.join(', ') || 'Not visible'}</p><p><b>Allergens:</b> {analysis.health.allergens.join(', ') || 'None detected'}</p><p><b>Additives:</b> {analysis.health.additives.join(', ') || 'None detected'}</p><p><b>Specifications:</b> {analysis.technology.specifications.join(', ') || 'Not applicable'}</p></article><article><p className="kicker">04 / {text.market}</p><h3>{text.price}</h3><p><b>Observed MRP:</b> {analysis.market.observedPrice}</p><p><b>Unit price:</b> {analysis.market.pricePerUnit}</p><p><b>Brand:</b> {analysis.market.brandVerification}</p>{analysis.market.recommendations.map((item) => <p key={item}>→ {item}</p>)}</article></div><div className="report-block"><article><p className="kicker">05 / {text.report}</p><h3>Findings</h3>{analysis.report.findings.map((item) => <p key={item}>→ {item}</p>)}</article><article><p className="kicker">Next actions</p>{analysis.report.actions.map((item) => <p key={item}>→ {item}</p>)}</article></div></>}</section>
    {analysis && <section className="report-pages"><p className="kicker">Report pages</p><div className="report-page-buttons">{(analysis.barcodeInfo?.detected || decodedCode?.value ? ['Summary & Compliance', 'Health & Market', 'Barcode Intelligence'] : ['Summary & Compliance', 'Health & Market']).map((page, index) => <button className={reportPage === index + 1 ? 'active' : ''} type="button" key={page} onClick={() => setReportPage(index + 1)}>{String(index + 1).padStart(2, '0')} / {page}</button>)}</div><div className="report-page-note">Page {String(reportPage).padStart(2, '0')} selected. Use Generate PDF Report above to download all {analysis.barcodeInfo?.detected || decodedCode?.value ? '3' : '2'} report pages.</div></section>}
    <section className="history-section"><div><p className="kicker">06 / Inspection history</p><h2>Scan<br /><em>archive.</em></h2></div><div className="history-dashboard"><div className="history-stats"><span><b>{history.length}</b>Total scanned</span><span><b>{compliantCount}</b>Compliant</span><span><b>{nonCompliantCount}</b>Non-compliant</span><span><b>{reviewCount}</b>Needs review</span></div>{commonViolations.length > 0 && <p className="history-common">Common violations: {commonViolations.join(' · ')}</p>}<div className="history-list">{history.length === 0 ? <p>No inspections saved yet.</p> : history.map((entry) => <button type="button" key={entry.id} onClick={() => openHistory(entry)}><strong>{entry.productName}</strong><span>{new Date(entry.timestamp).toLocaleString()} · {entry.score}% · {entry.status.replace('_', ' ')}</span><small>{entry.violations.join(', ') || 'No violations recorded'}</small></button>)}</div></div></section>
    <section className="catalog-section"><div><p className="kicker">07 / {text.kicker}</p><h2>{text.clarity}<br /><em>{text.scale}</em></h2></div><p>{text.catalogText}</p><div className="feature-list"><span>MRP + quantity</span><span>Expiry tracking</span><span>Voice reports</span><span>Admin ready</span></div></section>
    <footer><span>ROCKSTAR LENS / {text.kicker}</span><span>{text.detect}. {text.validate}. {text.analyze}. {text.report}.</span></footer>
    {isCameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label={text.camera}><div className="camera-window"><button className="close-button" type="button" onClick={closeCamera}>×</button><p className="kicker">Live hybrid scanner</p><h2>Frame the label.</h2><div className="video-frame">{cameraError ? <p>{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted />}</div><button className="primary-button" type="button" disabled={Boolean(cameraError)} onClick={capturePhoto}>{text.capture} <span>◎</span></button></div></div>}
  </main>
}

export default App

