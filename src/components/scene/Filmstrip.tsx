'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { cssFontFamily } from '@/components/scene/terminal-screen'

export type FilmFrame = {
  id: string
  name: string
  score: number
  verdict: string
  role: string
  href: string
}

const FRAME_W = 520
const FRAME_H = 360
const SPROCKET = 54
const FRAME_ANGLE = 0.5
const RADIUS = 3.4
// Muted navy / plum / coral / maroon panels, as on 5aitec's work reel.
const PANELS = ['#1f2a44', '#3b2442', '#b4483c', '#6b2f2a', '#2c3a2e']

function drawStrip(frames: FilmFrame[], placeholders: number) {
  const count = Math.max(frames.length, placeholders)
  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W * count
  canvas.height = FRAME_H + SPROCKET * 2
  const c = canvas.getContext('2d')!
  const serif = cssFontFamily('--font-stix', '"Times New Roman", serif')
  const pixel = cssFontFamily('--font-vt323', 'ui-monospace, monospace')

  c.fillStyle = '#0c0a0a'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // Sprocket holes along both edges.
  c.fillStyle = '#e9dfcf'
  const holeStep = 40
  for (let x = 14; x < canvas.width; x += holeStep) {
    roundRect(c, x, 16, 20, 22, 4)
    roundRect(c, x, canvas.height - 38, 20, 22, 4)
  }

  for (let i = 0; i < count; i++) {
    const f = frames[i]
    const x = i * FRAME_W + 14
    const y = SPROCKET
    const w = FRAME_W - 28
    const h = FRAME_H
    c.fillStyle = f ? PANELS[i % PANELS.length] : '#1a1514'
    c.fillRect(x, y, w, h)

    // Light falloff on each frame, like projected film.
    const g = c.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.75)
    g.addColorStop(0, 'rgba(255, 240, 220, 0.16)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0.35)')
    c.fillStyle = g
    c.fillRect(x, y, w, h)

    c.fillStyle = '#fcf9f3'
    c.textBaseline = 'alphabetic'
    if (!f) {
      c.font = `40px ${pixel}`
      c.globalAlpha = 0.55
      c.fillText('NO TAPE YET', x + 28, y + h / 2 + 12)
      c.globalAlpha = 1
      continue
    }
    c.font = `30px ${pixel}`
    c.fillText(`#${String(i + 1).padStart(2, '0')} · ${f.role}`, x + 28, y + 46)
    c.font = `bold 132px ${serif}`
    c.fillText(String(f.score), x + 24, y + 196)
    c.font = `30px ${pixel}`
    c.fillText(`/100 · ${f.verdict.toUpperCase()}`, x + 30, y + 236)
    c.font = `italic 40px ${serif}`
    c.fillText(fit(c, f.name, w - 56), x + 28, y + h - 36)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, count }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fill()
}

function fit(c: CanvasRenderingContext2D, text: string, max: number) {
  if (c.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

// Curved reel of candidate frames on an open cylinder. `index` selects the
// frame turned toward the camera; clicking a frame calls onPick.
export function Filmstrip({
  frames,
  index,
  onPick,
  autoSpin = false,
  ...props
}: ThreeElements['group'] & {
  frames: FilmFrame[]
  index: number
  onPick?: (i: number) => void
  autoSpin?: boolean
}) {
  const reel = useRef<THREE.Group>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && setFontsReady(true))
    return () => {
      live = false
    }
  }, [])

  const strip = useMemo(() => {
    if (typeof document === 'undefined') return null
    return drawStrip(frames, 6)
    // Redraw once web fonts have loaded so canvas text uses STIX/VT323.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, fontsReady])

  useEffect(() => () => strip?.texture.dispose(), [strip])

  const count = strip?.count ?? 6
  const thetaLength = count * FRAME_ANGLE
  const thetaStart = -thetaLength / 2

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  useFrame(({ clock }, delta) => {
    const g = reel.current
    if (!g) return
    const target = -(thetaStart + (index + 0.5) * FRAME_ANGLE)
    const sway = autoSpin ? Math.sin(clock.elapsedTime * 0.35) * 0.05 : 0
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target + sway, 4, delta)
  })

  function handleClick(e: ThreeEvent<MouseEvent>) {
    if (!e.uv || !onPick) return
    e.stopPropagation()
    const i = Math.min(count - 1, Math.floor(e.uv.x * count))
    if (i < frames.length) onPick(i)
  }

  if (!strip) return null

  return (
    <group {...props}>
      <group rotation={[0.1, 0, -0.14]}>
        <group ref={reel} position={[0, 0, -RADIUS]}>
          <mesh
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <cylinderGeometry
              args={[RADIUS, RADIUS, (FRAME_H + SPROCKET * 2) / (FRAME_W / (RADIUS * FRAME_ANGLE)), 64, 1, true, thetaStart, thetaLength]}
            />
            <meshStandardMaterial
              map={strip.texture}
              side={THREE.DoubleSide}
              roughness={0.45}
              metalness={0.1}
              emissive="#ffffff"
              emissiveMap={strip.texture}
              emissiveIntensity={0.35}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}
