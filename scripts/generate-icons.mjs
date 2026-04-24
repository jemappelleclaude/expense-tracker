/**
 * Generates pwa-192x192.png and pwa-512x512.png in public/.
 * Pure Node.js — no extra dependencies.
 *
 * Icon design: dark (#18181b) background, green (#22c55e) circle,
 * white ₹ symbol drawn from a 9×10 bitmap scaled to the icon size.
 */

import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

// ── CRC32 ──────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[i] = c
}
function crc32(buf) {
  let v = 0xffffffff
  for (const b of buf) v = CRC_TABLE[(v ^ b) & 0xff] ^ (v >>> 8)
  return (v ^ 0xffffffff) >>> 0
}

// ── PNG helpers ────────────────────────────────────────────────────────────────
function u32(n) {
  return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  return Buffer.concat([u32(d.length), t, d, u32(crc32(Buffer.concat([t, d])))])
}

// ── ₹ bitmap (9 wide × 10 tall, 1 = foreground) ───────────────────────────────
// Designed on a grid then hand-tuned.
const RUPEE = [
  [0,1,1,1,1,1,1,0,0],  // top bar
  [0,1,0,0,0,0,0,1,0],  // bowl top
  [0,1,1,1,1,1,1,0,0],  // second bar (full)
  [0,1,1,1,1,1,0,0,0],  // third bar  (shorter — the ₹ notch)
  [0,1,0,0,0,0,0,0,0],  // stem only
  [0,1,0,0,1,0,0,0,0],  // diagonal row 1
  [0,1,0,0,0,1,0,0,0],  // diagonal row 2
  [0,1,0,0,0,0,1,0,0],  // diagonal row 3
  [0,1,0,0,0,0,0,1,0],  // diagonal row 4
  [0,1,0,0,0,0,0,0,1],  // diagonal row 5 (bottom)
]

const BM_ROWS = RUPEE.length      // 10
const BM_COLS = RUPEE[0].length   // 9

// ── Icon pixel function ────────────────────────────────────────────────────────
function getPixel(px, py, size) {
  const cx = size / 2
  const cy = size / 2

  // Background color (#18181b)
  const BG = [0x18, 0x18, 0x1b]
  // Circle fill (#22c55e)
  const GREEN = [0x22, 0xc5, 0x5e]
  // Symbol color
  const WHITE = [0xff, 0xff, 0xff]

  // Outer circle (45% radius) — the visible icon shape
  const r = size * 0.46
  const dx = px - cx, dy = py - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > r) return BG

  // ₹ bitmap — centred, scaled so the glyph is 50% of icon height
  const glyphH = size * 0.52
  const cellH  = glyphH / BM_ROWS
  const cellW  = cellH               // square cells for now
  const glyphW = cellW * BM_COLS

  // Top-left of glyph, shifted slightly left of true centre for optical balance
  const gx0 = cx - glyphW * 0.42
  const gy0 = cy - glyphH * 0.50

  const col = Math.floor((px - gx0) / cellW)
  const row = Math.floor((py - gy0) / cellH)

  if (row >= 0 && row < BM_ROWS && col >= 0 && col < BM_COLS) {
    if (RUPEE[row][col] === 1) return WHITE
  }

  return GREEN
}

// ── PNG builder ────────────────────────────────────────────────────────────────
function buildPNG(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.concat([
    u32(size), u32(size),
    Buffer.from([8, 2, 0, 0, 0]),  // 8-bit RGB, no interlace
  ])

  // Build raw scan-lines (filter byte 0 = None, then RGB triples)
  const bytesPerRow = 1 + size * 3
  const raw = Buffer.allocUnsafe(size * bytesPerRow)
  for (let y = 0; y < size; y++) {
    raw[y * bytesPerRow] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = getPixel(x, y, size)
      const o = y * bytesPerRow + 1 + x * 3
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b
    }
  }

  const idat = deflateSync(raw, { level: 6 })

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Write files ────────────────────────────────────────────────────────────────
for (const size of [192, 512]) {
  const name = `pwa-${size}x${size}.png`
  const buf  = buildPNG(size)
  writeFileSync(join(PUBLIC, name), buf)
  console.log(`✓ ${name}  (${(buf.length / 1024).toFixed(1)} KB)`)
}
