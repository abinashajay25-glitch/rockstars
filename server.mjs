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
const astraKey = process.env.ASTRA_API_KEY || process.env.OPENAI_API_KEY
const astraUrl = process.env.ASTRA_API_URL || 'https://api.openai.com/v1/chat/completions'
const astraModel = process.env.ASTRA_MODEL || 'gpt-4o-mini'
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

const schemaPrompt = `You are an AI packaged commodity compliance inspector for India's SIH26034 challenge. Inspect the product label and return ONLY valid JSON matching this shape:
{"productName":"string","category":"string","brand":"string","summary":"string","compliance":[{"label":"MRP|Net Quantity|Mfg / Expiry Date|Manufacturer|Consumer Care|Country of Origin|Label Legibility","status":"PASS|FAIL|REVIEW","value":"string","confidence":"HIGH|MEDIUM|LOW"}],"health":{"ingredients":["string"],"nutriScore":"A|B|C|D|E|UNKNOWN","allergens":["string"],"additives":["string"]},"technology":{"specifications":["string"]},"market":{"observedPrice":"string","pricePerUnit":"string","brandVerification":"VERIFIED|UNVERIFIED|REVIEW","comparisons":[{"seller":"string","price":"string","unitPrice":"string"}],"recommendations":["string"]},"report":{"findings":["string"],"actions":["string"]}}
Read only visible evidence. Use UNKNOWN or REVIEW when a field is not legible; never invent a price, barcode, expiry, manufacturer, or certification. For non-food items, leave health arrays empty and use UNKNOWN for nutriScore.`

const cleanJson = (content) => {
  const match = String(content || '').match(/\{[\s\S]*\}/)
  if (!match) throw new Error('The model returned no structured inspection report.')
  return JSON.parse(match[0])
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

const analyzeWithGemini = async (imageData) => {
  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: schemaPrompt }, { inline_data: { mime_type: imageData.type, data: imageData.base64 } }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
  })
  const payload = await upstream.json()
  if (!upstream.ok) throw new Error(payload.error?.message || 'Gemini image analysis failed.')
  return cleanJson(payload.candidates?.[0]?.content?.parts?.[0]?.text)
}

const analyzeWithAstra = async (imageData) => {
  const upstream = await fetch(astraUrl, {
    method: 'POST', headers: { Authorization: `Bearer ${astraKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: astraModel, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: schemaPrompt }, { type: 'image_url', image_url: { url: `data:${imageData.type};base64,${imageData.base64}` } }] }] }),
  })
  const payload = await upstream.json()
  if (!upstream.ok) throw new Error(payload.error?.message || 'Astra image analysis failed.')
  return cleanJson(payload.choices?.[0]?.message?.content)
}

const analyze = async (request, response) => {
  if (!geminiKey && !astraKey) return sendJson(response, 503, { error: 'No vision provider is configured. Add GEMINI_API_KEY or ASTRA_API_KEY to the server environment.' })
  try {
    const { image, imageType } = await parseMultipartImage(request)
    const imageData = { type: imageType, base64: image.toString('base64') }
    const report = geminiKey ? await analyzeWithGemini(imageData) : await analyzeWithAstra(imageData)
    return sendJson(response, 200, { provider: geminiKey ? 'gemini' : 'astra', ...normalizeReport(report) })
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