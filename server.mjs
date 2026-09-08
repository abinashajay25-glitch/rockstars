import { createReadStream, existsSync, promises as fs } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 5173)
const maxImageBytes = 15 * 1024 * 1024
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVAPI_KEY
const nvidiaModel = process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct'
const elevenLabsKey = process.env.ELEVENLABS_API_KEY
const elevenLabsVoice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

const parseMultipartImage = async (request) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxImageBytes) throw new Error('Image is too large. Please use an image under 15 MB.')
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)
  const contentType = request.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=([^;]+)/)
  if (!boundaryMatch) throw new Error('Expected a multipart image upload.')
  const boundary = Buffer.from(`--${boundaryMatch[1].replace(/^"|"$/g, '')}`)
  const start = body.indexOf(Buffer.from('\r\n\r\n'))
  if (start === -1) throw new Error('The uploaded image could not be read.')
  const header = body.subarray(0, start).toString()
  const end = body.indexOf(boundary, start + 4)
  const image = body.subarray(start + 4, end === -1 ? body.length : end - 2)
  const typeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i)
  const imageType = typeMatch?.[1]?.trim() || 'image/jpeg'
  if (!image.length) throw new Error('Please choose an image first.')
  return { image, imageType }
}

const schemaPrompt = `You are an AI packaged commodity compliance inspector. Inspect the product label and return ONLY valid JSON matching this shape:
{"productName":"string","category":"string","brand":"string","summary":"string","compliance":[{"label":"MRP|Net Quantity|Mfg / Expiry Date|Manufacturer|Consumer Care|Country of Origin|Label Legibility","status":"PASS|FAIL|REVIEW","value":"string","confidence":"HIGH|MEDIUM|LOW"}],"health":{"ingredients":["string"],"nutriScore":"A|B|C|D|E|UNKNOWN","allergens":["string"],"additives":["string"]},"technology":{"specifications":["string"]},"market":{"observedPrice":"string","pricePerUnit":"string","brandVerification":"VERIFIED|UNVERIFIED|REVIEW","comparisons":[{"seller":"string","price":"string","unitPrice":"string"}],"recommendations":["string"]},"report":{"findings":["string"],"actions":["string"]}}
Read only visible evidence. Use UNKNOWN or REVIEW when a field is not legible; never invent a price, barcode, expiry, manufacturer, or certification. For non-food items, leave health arrays empty and use UNKNOWN for nutriScore.`

const extractJsonObject = (content) => {
  const text = String(content || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

const cleanJson = (content) => {
  const text = typeof content === 'string' ? content.trim() : JSON.stringify(content || '')
  const json = extractJsonObject(text)
  if (json) {
    try { return JSON.parse(json) } catch { /* Fall through to an evidence-only report. */ }
  }
  return {
    productName: 'Image inspection',
    category: 'Packaged commodity',
    brand: 'Not confirmed',
    summary: text || 'The model returned no readable inspection details.',
    compliance: [],
    health: { ingredients: [], nutriScore: 'UNKNOWN', allergens: [], additives: [] },
    technology: { specifications: [] },
    market: { observedPrice: 'Not visible', pricePerUnit: 'Not available', brandVerification: 'REVIEW', comparisons: [], recommendations: [] },
    report: { findings: ['The model response was returned as visible text rather than structured fields.'], actions: ['Review the label manually and run the inspection again if structured fields are needed.'] },
  }
}

const normalizeReport = (report) => ({
  productName: report.productName || 'Unidentified packaged commodity',
  category: report.category || 'Commodity',
  brand: report.brand || 'Not visible',
  summary: report.summary || 'The label was inspected against the seven-point compliance checklist.',
  compliance: Array.isArray(report.compliance) ? report.compliance : [],
  health: report.health || { ingredients: [], nutriScore: 'UNKNOWN', allergens: [], additives: [] },
  technology: report.technology || { specifications: [] },
  market: report.market || { observedPrice: 'Not visible', pricePerUnit: 'Not available', brandVerification: 'REVIEW', comparisons: [], recommendations: [] },
  report: report.report || { findings: [], actions: [] },
})

const localizedPrompt = (language) => language === 'தமிழ்'
  ? `${schemaPrompt}\nWrite every human-readable value in Tamil.`
  : language === 'हिन्दी'
    ? `${schemaPrompt}\nWrite every human-readable value in Hindi.`
    : schemaPrompt

const analyzeWithGemini = async (imageData, prompt) => {
  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: imageData.type, data: imageData.base64 } }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
  })
  const payload = await upstream.json()
  if (!upstream.ok) throw new Error(payload.error?.message || 'Gemini image analysis failed.')
  return cleanJson(payload.candidates?.[0]?.content?.parts?.[0]?.text)
}

const analyzeWithNvidia = async (imageData, prompt) => {
  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${nvidiaKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: nvidiaModel, temperature: 0.1, max_tokens: 1800, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: `${prompt}\nReturn one JSON object only. Do not add markdown or explanatory text.` }, { type: 'image_url', image_url: { url: `data:${imageData.type};base64,${imageData.base64}` } }] }] }),
  })
  const payload = await upstream.json()
  if (!upstream.ok) throw new Error(payload.error?.message || 'NVIDIA image analysis failed.')
  return cleanJson(payload.choices?.[0]?.message?.content)
}

const analyze = async (request, response) => {
  if (!geminiKey && !nvidiaKey) return sendJson(response, 503, { error: 'No vision model is configured. In Render, add NVIDIA_API_KEY with your nvapi key, then redeploy the service.' })
  try {
    const { image, imageType } = await parseMultipartImage(request)
    const imageData = { type: imageType, base64: image.toString('base64') }
    const provider = geminiKey ? 'gemini' : 'nvidia'
    const prompt = localizedPrompt(request.headers['x-report-language'] || 'English')
    const report = geminiKey ? await analyzeWithGemini(imageData, prompt) : await analyzeWithNvidia(imageData, prompt)
    return sendJson(response, 200, { provider, ...normalizeReport(report) })
  } catch (error) {
    return sendJson(response, 502, { error: error instanceof Error ? error.message : 'The inspection service could not analyze this image.' })
  }
}

const parseJsonBody = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const voiceReport = async (request, response) => {
  if (!elevenLabsKey) return sendJson(response, 503, { error: 'ELEVENLABS_API_KEY is not configured on the backend.' })
  try {
    const { text } = await parseJsonBody(request)
    if (!text) return sendJson(response, 400, { error: 'Report text is required.' })
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoice}`, { method: 'POST', headers: { 'xi-api-key': elevenLabsKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: String(text).slice(0, 5000), model_id: 'eleven_multilingual_v2' }) })
    if (!upstream.ok) return sendJson(response, upstream.status, { error: 'ElevenLabs voice generation failed.' })
    response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' })
    response.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) { sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid voice report request.' }) }
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const serveFile = async (request, response) => {
  const requestPath = request.url === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname
  const candidate = normalize(join(dist, requestPath))
  const filePath = candidate.startsWith(dist) && existsSync(candidate) ? candidate : join(dist, 'index.html')
  try { const stats = await fs.stat(filePath); if (!stats.isFile()) throw new Error('Not a file'); response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' }); createReadStream(filePath).pipe(response) } catch { response.writeHead(404); response.end('Not found') }
}

createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/analyze') return analyze(request, response)
  if (request.method === 'POST' && request.url === '/api/voice-report') return voiceReport(request, response)
  if (request.method === 'GET') return serveFile(request, response)
  response.writeHead(405); response.end('Method not allowed')
}).listen(port, () => console.log(`Lens compliance service running at http://localhost:${port}`))