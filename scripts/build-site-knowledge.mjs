import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_PATH = path.join(ROOT, 'api', 'site-knowledge.json')
const CHUNK_SIZE = 600
const CHUNK_OVERLAP = 80

/** @param {string} dir */
async function walkFiles(dir) {
  /** @type {string[]} */
  const files = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

/** @param {string} text */
function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} source
 * @param {string} text
 * @param {number} startId
 */
function chunkText(source, text, startId) {
  const cleaned = normalizeWhitespace(text)
  if (!cleaned) return { chunks: [], nextId: startId }

  /** @type {{ id: string, source: string, text: string }[]} */
  const chunks = []
  let id = startId

  if (cleaned.length <= CHUNK_SIZE) {
    chunks.push({ id: `c${id++}`, source, text: cleaned })
    return { chunks, nextId: id }
  }

  let start = 0
  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length)
    if (end < cleaned.length) {
      const space = cleaned.lastIndexOf(' ', end)
      if (space > start + CHUNK_SIZE / 2) end = space
    }
    const slice = cleaned.slice(start, end).trim()
    if (slice) {
      chunks.push({ id: `c${id++}`, source, text: slice })
    }
    if (end >= cleaned.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }

  return { chunks, nextId: id }
}

/** @param {string} html */
function extractFromHtml(html) {
  const parts = []
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (title?.[1]) parts.push(title[1])
  const metaDesc = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i,
  )
  if (metaDesc?.[1]) parts.push(metaDesc[1])
  return parts.join('\n')
}

/** @param {string} text */
function looksLikeUiCopy(text) {
  const t = text.trim()
  if (t.length < 3 || t.length > 300) return false
  if (!/[A-Za-z]/.test(t)) return false
  if (
    /[{}=;]|=>|import |export |from '|from "|className|useState|useEffect|return\s*\(/.test(
      t,
    )
  ) {
    return false
  }
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(t)) return false // CSS class-like
  if (t.includes('${')) return false
  // Prefer natural language / labels over code fragments
  if (!/[\s.…!?]|^(Stream|Free|Rent|Buy|Search|Remove|Close|Send|Hide)/i.test(t)) {
    return t.split(/\s+/).length >= 2
  }
  return true
}

/**
 * Extract user-visible strings from TSX: JSX text, placeholder, aria-label, etc.
 * @param {string} source
 */
function extractFromTsx(source) {
  /** @type {string[]} */
  const parts = []

  for (const match of source.matchAll(
    /(?:placeholder|aria-label|title|alt)=["']([^"']+)["']/g,
  )) {
    if (looksLikeUiCopy(match[1])) parts.push(match[1])
  }

  // JSX text nodes: >visible text<
  for (const match of source.matchAll(/>(\s*[^<>{}\n][^<>{}]*?)\s*</g)) {
    const text = match[1].trim()
    if (looksLikeUiCopy(text)) parts.push(text)
  }

  // String children in JSX expressions: {'...'} or {"..."}
  for (const match of source.matchAll(/\{\s*['"]([^'"]{3,300})['"]\s*\}/g)) {
    if (looksLikeUiCopy(match[1])) parts.push(match[1])
  }

  // Template / const UI strings that contain spaces (sentences)
  for (const match of source.matchAll(
    /(?:const|let)\s+[A-Z_][A-Z0-9_]*\s*=\s*['"`]([^'"`]{10,300})['"`]/g,
  )) {
    if (looksLikeUiCopy(match[1])) parts.push(match[1])
  }

  return [...new Set(parts)].join('\n')
}

/** @param {string} css */
function extractFromCss(css) {
  const parts = []
  for (const match of css.matchAll(/content:\s*["']([^"']+)["']/g)) {
    if (match[1] && looksLikeUiCopy(match[1])) {
      parts.push(match[1])
    }
  }
  return parts.join('\n')
}

async function main() {
  /** @type {{ id: string, source: string, text: string }[]} */
  const allChunks = []
  let nextId = 1

  const summary = [
    'FindShow helps users find which streaming service a TV show or movie is on in the US.',
    'Search by show or movie name to see Netflix, Hulu, Disney+, Max, Prime Video, and more.',
    'Documentaries indexed as movies are included in search.',
    'Streaming availability is powered by JustWatch via TMDB (The Movie Database).',
    'Provider categories include: Stream with subscription (flatrate), Free with ads, Free, Rent, and Buy.',
    'Every page has navigation for Home, Currently Watching, and Movies and Shows to watch.',
    'The home page has a Find a Show or Movie search box and an Enter email box with an optional First name.',
    'Currently Watching stores TV shows with the streaming services the user selects when adding them.',
    'Movies and Shows to watch is a separate list for both movies and TV shows.',
    'From search, adding to a list prompts for email if the user has not entered one yet.',
    'Lists are saved by email with no password; first name is optional for a future public list search feature. Saves are private by default for now.',
    'The site focuses on US streaming availability.',
    'A Site help chat answers questions using public site documentation and UI copy, not live TMDB lookups for arbitrary titles.',
  ].join(' ')
  const summaryResult = chunkText('site-summary', summary, nextId)
  nextId = summaryResult.nextId
  allChunks.push(...summaryResult.chunks)

  const staticSources = [
    { rel: 'README.md', kind: 'md' },
    { rel: 'index.html', kind: 'html' },
  ]

  for (const { rel, kind } of staticSources) {
    const abs = path.join(ROOT, rel)
    let raw
    try {
      raw = await readFile(abs, 'utf8')
    } catch {
      continue
    }
    const text = kind === 'html' ? extractFromHtml(raw) : raw
    const { chunks, nextId: id } = chunkText(rel.replace(/\\/g, '/'), text, nextId)
    nextId = id
    allChunks.push(...chunks)
  }

  const srcDir = path.join(ROOT, 'src')
  const srcFiles = await walkFiles(srcDir)
  for (const abs of srcFiles.sort()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/')
    const ext = path.extname(abs)
    if (ext !== '.tsx' && ext !== '.css') continue

    const raw = await readFile(abs, 'utf8')
    const text = ext === '.tsx' ? extractFromTsx(raw) : extractFromCss(raw)
    const { chunks, nextId: id } = chunkText(rel, text, nextId)
    nextId = id
    allChunks.push(...chunks)
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString(),
    chunks: allChunks,
  }
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${allChunks.length} chunks to ${path.relative(ROOT, OUT_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
