import * as THREE from 'three'
import type { ScreenState } from '@/lib/screen-state'

const W = 640
const H = 480
const BG = '#120907'
const PHOSPHOR = '#ffe7c2'
const DIM = 'rgba(255, 231, 194, 0.55)'
const SPINNER = ['|', '/', '-', '\\']

export function cssFontFamily(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value ? `${value}, ${fallback}` : fallback
}

// Canvas-backed texture for the 3D monitor: a DOS-style terminal that mirrors
// the upload form's state. redraw() is cheap and called a few times a second.
export class TerminalScreen {
  readonly texture: THREE.CanvasTexture
  private ctx: CanvasRenderingContext2D
  private font = 'monospace'

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    this.ctx = canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
    this.refreshFonts()
  }

  refreshFonts() {
    this.font = cssFontFamily('--font-vt323', 'ui-monospace, monospace')
  }

  redraw(s: ScreenState, tick: number) {
    const c = this.ctx
    c.fillStyle = BG
    c.fillRect(0, 0, W, H)

    // Phosphor bloom behind the text.
    const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7)
    g.addColorStop(0, 'rgba(255, 190, 140, 0.10)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)

    c.fillStyle = PHOSPHOR
    c.shadowColor = 'rgba(255, 220, 180, 0.9)'
    c.shadowBlur = 8
    c.textBaseline = 'top'

    const line = (text: string, row: number, size = 34, color = PHOSPHOR) => {
      c.font = `${size}px ${this.font}`
      c.fillStyle = color
      c.fillText(text, 40, 44 + row * 40)
    }
    const cursor = Math.floor(tick * 2) % 2 === 0 ? '_' : ' '
    const role = s.role === 'PM' ? 'PRODUCT MANAGER' : 'SENIOR PRODUCT MANAGER'

    line('KARGO RESUME SCREENER V2.0', 0, 36)
    line('(C) KARGO HIRING. 5-METRIC RUBRIC.', 1, 28, DIM)
    line(`ROLE: ${role}`, 3, 30)

    if (s.mode === 'idle') {
      line(`C:\\> INSERT RESUME${cursor}`, 5, 40)
      line('DROP PDF OR DOCX INTO THE TRAY.', 7, 28, DIM)
    } else if (s.mode === 'queued') {
      line(`${s.total} FILE${s.total === 1 ? '' : 'S'} LOADED.`, 5, 40)
      line(`PRESS [SCORE] TO RUN${cursor}`, 7, 30, DIM)
    } else if (s.mode === 'running') {
      const spin = SPINNER[Math.floor(tick * 8) % SPINNER.length]
      line(`SCORING ${s.done}/${s.total} ${spin}`, 5, 40)
      if (s.current) line(trim(s.current, 30).toUpperCase(), 6, 26, DIM)
      this.bar(s.total ? s.done / s.total : 0, 8)
    } else if (s.mode === 'done') {
      line(`COMPLETE ${s.done}/${s.total}`, 5, 40)
      this.bar(1, 7)
      line(`OPENING REPORT${cursor}`, 9, 30, DIM)
    } else {
      line(`${s.failed} FAILED. ${s.done} SCORED.`, 5, 40)
      line(`RETRY BELOW THE TRAY${cursor}`, 7, 30, DIM)
    }

    // Baked scanlines so the screen reads as a CRT even without post FX.
    c.shadowBlur = 0
    c.fillStyle = 'rgba(0, 0, 0, 0.22)'
    for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2)

    this.texture.needsUpdate = true
  }

  private bar(fraction: number, row: number) {
    const c = this.ctx
    const segments = 20
    const x = 40
    const y = 44 + row * 40
    const w = W - 80
    c.strokeStyle = PHOSPHOR
    c.lineWidth = 3
    c.strokeRect(x, y, w, 34)
    const seg = (w - 8) / segments
    const filled = Math.round(fraction * segments)
    c.fillStyle = PHOSPHOR
    for (let i = 0; i < filled; i++) c.fillRect(x + 4 + i * seg + 1, y + 5, seg - 3, 24)
  }

  dispose() {
    this.texture.dispose()
  }
}

function trim(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
