import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { loadEnv } from 'vite'

const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 2000
const TOP_CHUNKS = 8
const DEFAULT_MODEL = 'gpt-4o-mini'

type ChatRole = 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }
type KnowledgeChunk = { id: string; source: string; text: string }
type KnowledgeFile = { chunks?: KnowledgeChunk[] }

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const limit = 64 * 1024

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

function scoreChunk(queryTokens: string[], chunkText: string): number {
  if (queryTokens.length === 0) return 0
  const hay = chunkText.toLowerCase()
  let score = 0
  for (const token of queryTokens) {
    if (hay.includes(token)) score += 1
  }
  return score
}

function retrieveChunks(chunks: KnowledgeChunk[], query: string, topN: number): KnowledgeChunk[] {
  const tokens = tokenize(query)
  if (chunks.length === 0) return []

  const scored = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(tokens, `${chunk.source} ${chunk.text}`) }))
    .sort((a, b) => b.score - a.score)

  const positive = scored.filter((s) => s.score > 0).slice(0, topN)
  if (positive.length > 0) return positive.map((s) => s.chunk)

  // Fall back to first N chunks (includes site summary) when no keyword match
  return chunks.slice(0, Math.min(topN, chunks.length))
}

function validateMessages(raw: unknown): ChatMessage[] | string {
  if (!raw || typeof raw !== 'object' || !('messages' in raw)) {
    return 'Missing messages'
  }
  const messages = (raw as { messages: unknown }).messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages must be a non-empty array'
  }
  if (messages.length > MAX_MESSAGES) {
    return `At most ${MAX_MESSAGES} messages allowed`
  }

  const out: ChatMessage[] = []
  for (const item of messages) {
    if (!item || typeof item !== 'object') return 'Invalid message'
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if (role !== 'user' && role !== 'assistant') return 'Invalid message role'
    if (typeof content !== 'string' || !content.trim()) return 'Invalid message content'
    if (content.length > MAX_CONTENT_LENGTH) {
      return `Each message must be at most ${MAX_CONTENT_LENGTH} characters`
    }
    out.push({ role, content: content.trim() })
  }

  if (out[out.length - 1]?.role !== 'user') {
    return 'Last message must be from the user'
  }

  return out
}

async function loadKnowledge(root: string): Promise<KnowledgeChunk[]> {
  const filePath = path.join(root, 'api', 'site-knowledge.json')
  const raw = await readFile(filePath, 'utf8')
  const data = JSON.parse(raw) as KnowledgeFile
  return Array.isArray(data.chunks) ? data.chunks : []
}

async function callOpenAI(
  apiKey: string,
  model: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI ${response.status}: ${text}`)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('Empty response from OpenAI')
  return reply
}

function buildSystemPrompt(contextChunks: KnowledgeChunk[]): string {
  const context = contextChunks
    .map((c) => `[${c.source}]\n${c.text}`)
    .join('\n\n---\n\n')

  return [
    'You are the FindShow site assistant.',
    'Answer questions using ONLY the site context below.',
    'If the answer is not in the context, say you do not know based on the site content.',
    'Do not invent streaming availability for specific titles unless it appears in the context.',
    'Keep answers concise and helpful.',
    'When relevant, briefly mention Sources using the bracketed file paths from the context.',
    '',
    'SITE CONTEXT:',
    context || '(no context available)',
  ].join('\n')
}

function createChatMiddleware(
  root: string,
  apiKey: string,
  model: string,
): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/chat')) {
      next()
      return
    }

    const url = readUrl(req)
    if (url.pathname !== '/api/chat') {
      next()
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    try {
      if (!apiKey) {
        sendJson(res, 500, {
          error: 'OPENAI_API_KEY is not configured. Add it to your .env file.',
        })
        return
      }

      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.includes('application/json')) {
        sendJson(res, 415, { error: 'Content-Type must be application/json' })
        return
      }

      let body: unknown
      try {
        body = JSON.parse(await readBody(req))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON'
        sendJson(res, 400, { error: message })
        return
      }

      const messages = validateMessages(body)
      if (typeof messages === 'string') {
        sendJson(res, 400, { error: messages })
        return
      }

      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const query = lastUser?.content ?? ''

      let chunks: KnowledgeChunk[] = []
      try {
        chunks = await loadKnowledge(root)
      } catch {
        sendJson(res, 500, {
          error: 'Site knowledge index missing. Run npm run build:knowledge.',
        })
        return
      }

      const retrieved = retrieveChunks(chunks, query, TOP_CHUNKS)
      const system = buildSystemPrompt(retrieved)
      const reply = await callOpenAI(apiKey, model, system, messages)
      const sources = [...new Set(retrieved.map((c) => c.source))]

      sendJson(res, 200, { reply, sources })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      sendJson(res, 502, { error: message })
    }
  }
}

export function chatApiPlugin(): Plugin {
  return {
    name: 'chat-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      const apiKey = env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
      const model = env.OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL
      server.middlewares.use(createChatMiddleware(server.config.root, apiKey, model))
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      const apiKey = env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
      const model = env.OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL
      server.middlewares.use(createChatMiddleware(server.config.root, apiKey, model))
    },
  }
}
