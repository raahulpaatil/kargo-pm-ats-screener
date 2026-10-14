'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { getScreenState, subscribeScreenState } from '@/lib/screen-state'
import { TerminalScreen } from '@/components/scene/terminal-screen'

// A late-70s all-in-one terminal (keyboard deck + wedge monitor), built
// entirely from extruded profiles and instanced keys. No external model.

const WIDTH = 2.3
const PLASTIC = '#8f8a83'
const PLASTIC_DARK = '#6d6862'
const KEY = '#2b2826'
const BEZEL = '#161312'

// Side profile (z, y) extruded along x, centred on the x axis.
function profileGeometry(points: [number, number][], width: number, bevel = 0.03) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)))
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  })
  // Shape is drawn in (x=z, y=y); rotate so shape-x maps to world z and the
  // extrusion runs along world x, then centre it.
  geo.rotateY(-Math.PI / 2)
  geo.translate(width / 2, 0, 0)
  geo.computeVertexNormals()
  return geo
}

// Slightly bulged plane, like curved CRT glass.
function crtGlassGeometry(w: number, h: number, bulge: number) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 18)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2)
    const y = pos.getY(i) / (h / 2)
    pos.setZ(i, bulge * (1 - 0.5 * (x * x + y * y)))
  }
  geo.computeVertexNormals()
  return geo
}

// Deck: flat shelf at the back for the monitor, keyboard slope at the front.
const DECK_SLOPE = Math.atan2(0.22, 1.0)
const deckY = (z: number) => 0.2 + (0.75 - z) * 0.22

export function RetroComputer(props: ThreeElements['group']) {
  const screen = useMemo(() => new TerminalScreen(), [])
  const keys = useRef<THREE.InstancedMesh>(null)
  const dirty = useRef(true)
  const lastDraw = useRef(0)

  const deck = useMemo(() => profileGeometry([[0.75, 0], [-1.75, 0], [-1.75, 0.42], [-0.25, 0.42], [0.75, 0.2]], WIDTH), [])
  const housing = useMemo(
    () => profileGeometry([[0.5, 0], [-0.95, 0], [-0.95, 0.55], [-0.62, 1.32], [-0.42, 1.46], [0.36, 1.56]], WIDTH * 0.92, 0.05),
    []
  )
  const glass = useMemo(() => crtGlassGeometry(1.5, 1.12, 0.04), [])

  useEffect(() => subscribeScreenState(() => (dirty.current = true)), [])
  useEffect(() => {
    document.fonts?.ready.then(() => {
      screen.refreshFonts()
      dirty.current = true
    })
    return () => screen.dispose()
  }, [screen])

  // Lay out a 5x14 key grid plus a space bar on the sloped deck.
  useLayoutEffect(() => {
    const mesh = keys.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-DECK_SLOPE, 0, 0))
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    let i = 0
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 14; col++) {
        const z = 0.62 - row * 0.15
        const y = deckY(z) + 0.035
        p.set(-0.98 + col * 0.15 + (row % 2) * 0.04, y, z)
        s.set(1, 1, 1)
        mesh.setMatrixAt(i++, m.compose(p, q, s))
      }
    }
    // Space bar.
    p.set(0, deckY(0.7) + 0.035, 0.7)
    s.set(6, 1, 1)
    mesh.setMatrixAt(i, m.compose(p, q, s))
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Redraw on state change, and ~8fps for cursor blink/spinner.
    if (dirty.current || t - lastDraw.current > 0.125) {
      screen.redraw(getScreenState(), t)
      dirty.current = false
      lastDraw.current = t
    }
  })

  // Monitor front face runs from (z 0.5, y 0) up to (z 0.36, y 1.56): leaning back.
  const faceTilt = Math.atan2(0.5 - 0.36, 1.56)

  return (
    <group {...props}>
      <mesh geometry={deck} castShadow receiveShadow>
        <meshStandardMaterial color={PLASTIC} roughness={0.72} metalness={0.05} />
      </mesh>
      <instancedMesh ref={keys} args={[undefined, undefined, 71]} castShadow>
        <boxGeometry args={[0.12, 0.05, 0.12]} />
        <meshStandardMaterial color={KEY} roughness={0.55} />
      </instancedMesh>

      <group position={[0, 0.42, -0.78]}>
        <mesh geometry={housing} castShadow receiveShadow>
          <meshStandardMaterial color={PLASTIC} roughness={0.68} metalness={0.05} />
        </mesh>
        {/* Recessed bezel + glass on the front face */}
        <group position={[0, 0.84, 0.43 + 0.05]} rotation={[-faceTilt, 0, 0]}>
          <mesh position={[0, 0, -0.01]}>
            <boxGeometry args={[1.78, 1.36, 0.04]} />
            <meshStandardMaterial color={BEZEL} roughness={0.4} />
          </mesh>
          <mesh geometry={glass} position={[0, 0, 0.012]}>
            <meshBasicMaterial map={screen.texture} toneMapped={false} />
          </mesh>
        </group>
        {/* Vent slots on top */}
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[-0.45 + i * 0.15, 1.49 + 0.06, -0.1]} rotation={[-0.17, 0, 0]}>
            <boxGeometry args={[0.07, 0.01, 0.5]} />
            <meshStandardMaterial color={PLASTIC_DARK} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
