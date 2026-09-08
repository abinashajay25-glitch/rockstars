import { createReadStream, existsSync, promises as fs } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 5173)
const apiKey = process.env.NVIDIA_API_KEY
const model = process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct'
const maxImageBytes = 15 * 1024 * 1024
const catalog = [
  { id: 'rider-01', name: 'No Rules Rider Jacket', category: 'Outerwear', price: '$248', color: 'Black / Bone', officialUrl: 'https://store.rockstargames.com/', competitor: 'StyleMarket', competitorPrice: '$279' },
  { id: 'circuit-02', name: 'Circuit 01 Tee', category: 'Tees', price: '$58', color: 'Washed black', officialUrl: 'https://store.rockstargames.com/', competitor: 'StreetSupply', competitorPrice: '$64' },
  { id: 'void-03', name: 'Void Utility Cargo', category: 'Bottoms', price: '$138', color: 'Graphite', officialUrl: 'https://store.rockstargames.com/', competitor: 'Urban Archive', competitorPrice: '$155' },
  { id: 'signal-04', name: 'Signal Runner', category: 'Footwear', price: '$176', color: 'Black / Volt', officialUrl: 'https://store.rockstargames.com/', competitor: 'Motion Dept.', competitorPrice: '$189' },
]

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

const parseModelResponse = (content) => {
  const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary || 'The image was analyzed.',
      details: Array.isArray(parsed.details) ? parsed.details : [],
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    }
  } catch {
    return { summary: content, details: [], observations: [], nextSteps: [] }
  }
}

const analyze = async (request, response) => {
  if (!apiKey) return sendJson(response, 500, { error: 'NVIDIA_API_KEY is not configured on the backend.' })

  try {
    const { image, imageType } = await parseMultipartImage(request)
    const imageData = `data:${imageType};base64,${image.toString('base64')}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000)
    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image in depth. Describe only evidence supported by what is visible. Return valid JSON with exactly these string-array fields: summary (string), details (array), observations (array), nextSteps (array). Do not include confidence scores, percentages, probability language, or numeric certainty. Mention ambiguity plainly when something cannot be confirmed.' },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        }],
      }),
    })
    clearTimeout(timeout)

    const payload = await upstream.json()
    if (!upstream.ok) return sendJson(response, upstream.status, { error: payload.error?.message || 'NVIDIA image analysis failed.' })
    return sendJson(response, 200, parseModelResponse(payload.choices?.[0]?.message?.content || 'No analysis was returned.'))
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'NVIDIA image analysis timed out. Check the API endpoint, model availability, or network connection.'
      : error instanceof Error ? error.message : 'Invalid image request.'
    return sendJson(response, 502, { error: message })
  }
}

const parseJsonBody = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const addCatalogItem = async (request, response) => {
  try {
    const input = await parseJsonBody(request)
    if (!input.name || !input.category) return sendJson(response, 400, { error: 'name and category are required.' })
    const item = { id: input.id || `item-${Date.now()}`, name: input.name, category: input.category, price: input.price || '—', color: input.color || 'Unspecified' }
    catalog.push(item)
    return sendJson(response, 201, item)
  } catch { return sendJson(response, 400, { error: 'Invalid catalog JSON.' }) }
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

const serveFile = async (request, response) => {
  const requestPath = request.url === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname
  const candidate = normalize(join(dist, requestPath))
  const filePath = candidate.startsWith(dist) && existsSync(candidate) ? candidate : join(dist, 'index.html')
  try {
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) throw new Error('Not a file')
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' })
    createReadStream(filePath).pipe(response)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
}

createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/analyze') return analyze(request, response)
  if (request.method === 'GET' && request.url === '/api/catalog') return sendJson(response, 200, { items: catalog })
  if (request.method === 'POST' && request.url === '/api/catalog') return addCatalogItem(request, response)
  if (request.method === 'GET') return serveFile(request, response)
  response.writeHead(405)
  response.end('Method not allowed')
}).listen(port, () => console.log(`Vision Desk running at http://localhost:${port}`))
