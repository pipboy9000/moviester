// Checks every youtubeId referenced in src/data/movies.ts against YouTube's
// embed player endpoint and reports which videos will not play when embedded
// (deleted, private, or embedding disabled by the uploader).
//
// Usage: node scripts/check-youtube-embeds.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const moviesPath = path.join(here, '..', 'src', 'data', 'movies.ts')

const source = await readFile(moviesPath, 'utf8')

// Pair each youtubeId with its nearest movieQid for readable reporting.
const entryPattern = /\{\s*movieQid:\s*'([^']+)',\s*youtubeId:\s*'([^']+)'/g
const idPattern = /youtubeId:\s*'([^']+)'/g

const qidById = new Map()
for (const match of source.matchAll(entryPattern)) {
  if (!qidById.has(match[2])) qidById.set(match[2], match[1])
}

const ids = [...new Set([...source.matchAll(idPattern)].map((m) => m[1]))]
console.log(`Found ${ids.length} unique YouTube IDs in movies.ts\n`)

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function extractPlayability(html) {
  const marker = '"playabilityStatus":'
  const start = html.indexOf(marker)
  if (start === -1) return null
  let i = start + marker.length
  if (html[i] !== '{') return null
  let depth = 0
  const objStart = i
  for (; i < html.length; i++) {
    const ch = html[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  try {
    return JSON.parse(html.slice(objStart, i))
  } catch {
    return null
  }
}

// oEmbed: 200 = exists + embedding allowed, 401 = embedding disabled, 4xx = gone.
// Watch page playabilityStatus catches age gates (LOGIN_REQUIRED), which block
// signed-out embed viewers even when oEmbed says 200.
async function checkOne(id) {
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { headers: { 'User-Agent': UA } },
    )
    if (oembed.status === 401) {
      return { id, ok: false, category: 'embed-disabled', detail: 'embedding disabled by request (oEmbed 401)' }
    }
    if (!oembed.ok) {
      return { id, ok: false, category: 'unavailable', detail: `video unavailable (oEmbed ${oembed.status})` }
    }
    const meta = await oembed.json()

    const watch = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { 'User-Agent': UA } })
    if (!watch.ok) {
      return { id, ok: false, category: 'unavailable', detail: `watch page HTTP ${watch.status}` }
    }
    const ps = extractPlayability(await watch.text())
    if (!ps) {
      return { id, ok: true, category: 'ok', detail: `ok (watch page unparseable) | ${meta.title} | ${meta.author_name}` }
    }
    if (ps.status === 'LOGIN_REQUIRED') {
      return { id, ok: false, category: 'age-gated', detail: `LOGIN_REQUIRED: ${ps.reason || 'sign-in required'} | ${meta.title} | ${meta.author_name}` }
    }
    if (ps.status !== 'OK') {
      return { id, ok: false, category: 'unavailable', detail: `${ps.status}: ${ps.reason || ''} | ${meta.title} | ${meta.author_name}` }
    }
    return { id, ok: true, category: 'ok', detail: `ok | ${meta.title} | ${meta.author_name}` }
  } catch (err) {
    return { id, ok: false, category: 'error', detail: `fetch error: ${err.message}` }
  }
}

// Simple concurrency pool so we do not hammer YouTube.
const CONCURRENCY = 8
const results = []
let cursor = 0
async function worker() {
  while (cursor < ids.length) {
    const id = ids[cursor++]
    results.push(await checkOne(id))
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const failures = results.filter((r) => !r.ok)
for (const f of failures) {
  const qid = qidById.get(f.id)
  console.log(`${f.category.padEnd(14)} ${f.id}${qid ? ` (${qid})` : ''} -> ${f.detail}`)
}
console.log(`\n${failures.length} of ${results.length} videos are not cleanly embeddable.`)
const byCategory = failures.reduce((acc, f) => {
  acc[f.category] = (acc[f.category] || 0) + 1
  return acc
}, {})
console.log('Breakdown:', byCategory)
