'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Sparkles, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { RetroComputer } from '@/components/scene/RetroComputer'
import { Filmstrip, type FilmFrame } from '@/components/scene/Filmstrip'
import { useReducedMotion, useTheme } from '@/lib/theme'

// Camera stops, one per page section ([data-scene-stop] in DOM order).
// `wide` is used on landscape screens, `tall` on portrait/mobile.
type Stop = { pos: [number, number, number]; look: [number, number, number] }
const STOPS: { wide: Stop; tall: Stop }[] = [
  // Hero: computer sits under the headline in a pool of light.
  { wide: { pos: [0, 2.2, 8.6], look: [0, 2.35, 0] }, tall: { pos: [0, 2.6, 11.5], look: [0, 2.9, 0] } },
  // Upload: three-quarter view, computer on the left, form on the right.
  { wide: { pos: [-1.5, 2.0, 5.6], look: [1.45, 1.15, 0] }, tall: { pos: [0, 1.9, 9], look: [0, -0.3, 0] } },
  // Recent: rise up to the filmstrip reel floating above.
  { wide: { pos: [0, 9.2, 5.4], look: [0, 9, -0.6] }, tall: { pos: [0, 9.2, 7.8], look: [0, 9, -0.6] } },
]

const smooth = (t: number) => t * t * (3 - 2 * t)
const CA_OFFSET = new THREE.Vector2(0.0011, 0.0007)
const scratch = new THREE.Vector3()

function readScrollStop(): number {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-scene-stop]'))
  if (els.length < 2) return 0
  const mid = window.scrollY + window.innerHeight * 0.5
  const centers = els.map((el) => el.offsetTop + el.offsetHeight * 0.5)
  if (mid <= centers[0]) return 0
  for (let i = 0; i < centers.length - 1; i++) {
    if (mid <= centers[i + 1]) return i + (mid - centers[i]) / (centers[i + 1] - centers[i])
  }
  return centers.length - 1
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const look = useRef(new THREE.Vector3(...STOPS[0].wide.look))
  const pointer = useRef({ x: 0, y: 0 })
  const progress = useRef(0)

  useEffect(() => {
    const onScroll = () => (progress.current = readScrollStop())
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  const goalPos = useRef(new THREE.Vector3())
  const goalLook = useRef(new THREE.Vector3())

  useFrame(({ camera, size }, delta) => {
    const tall = size.width / size.height < 0.9
    const p = Math.min(progress.current, STOPS.length - 1)
    const i = Math.min(Math.floor(p), STOPS.length - 2)
    const t = smooth(p - i)
    const a = tall ? STOPS[i].tall : STOPS[i].wide
    const b = tall ? STOPS[i + 1].tall : STOPS[i + 1].wide

    goalPos.current.set(...a.pos).lerp(scratch.set(...b.pos), t)
    goalLook.current.set(...a.look).lerp(scratch.set(...b.look), t)
    if (!reduced) {
      goalPos.current.x += pointer.current.x * 0.18
      goalPos.current.y -= pointer.current.y * 0.1
    }

    if (reduced) {
      camera.position.copy(goalPos.current)
      look.current.copy(goalLook.current)
    } else {
      // Frame-rate independent easing gives the cinematic "scrub" lag.
      camera.position.x = THREE.MathUtils.damp(camera.position.x, goalPos.current.x, 3.2, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, goalPos.current.y, 3.2, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, goalPos.current.z, 3.2, delta)
      look.current.x = THREE.MathUtils.damp(look.current.x, goalLook.current.x, 3.2, delta)
      look.current.y = THREE.MathUtils.damp(look.current.y, goalLook.current.y, 3.2, delta)
      look.current.z = THREE.MathUtils.damp(look.current.z, goalLook.current.z, 3.2, delta)
    }
    camera.lookAt(look.current)
  })

  return null
}

function Floor({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[30, 48]} />
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
    </mesh>
  )
}

export function HomeScene({
  frames,
  frameIndex,
  onPickFrame,
}: {
  frames: FilmFrame[]
  frameIndex: number
  onPickFrame: (i: number) => void
}) {
  const theme = useTheme()
  const reduced = useReducedMotion()
  const [dpr, setDpr] = useState(1.5)
  const [fx, setFx] = useState(true)
  const light = theme === 'light'

  const bg = light ? '#e7dccb' : '#060505'
  const floor = light ? '#d8cbb7' : '#0f0c0c'

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ fov: 38, near: 0.1, far: 60, position: STOPS[0].wide.pos }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1)
          setFx(false)
        }}
        onIncline={() => setDpr(1.5)}
      />
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 7, 22]} />

      <ambientLight intensity={light ? 0.9 : 0.12} />
      {/* Overhead key light: the theatrical pool the computer sits in. */}
      <spotLight
        position={[0.4, 7.5, 2.4]}
        angle={0.42}
        penumbra={0.85}
        intensity={light ? 60 : 95}
        decay={2}
        color="#ffe6c8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      {/* Cool plum rim from behind, as in the reference photo-lighting. */}
      <pointLight position={[-3, 2.5, -3]} intensity={light ? 4 : 9} color="#7d5a8c" />
      {/* Warm spill that lights the filmstrip. */}
      <pointLight position={[0, 11, 2.5]} intensity={light ? 6 : 14} color="#ffd9b0" distance={9} />

      <Suspense fallback={null}>
        <RetroComputer position={[0, 0, 0]} rotation={[0, -0.12, 0]} />
        <Filmstrip
          frames={frames}
          index={frameIndex}
          onPick={onPickFrame}
          autoSpin={!reduced}
          position={[0, 9, -0.6]}
        />
      </Suspense>

      <Floor color={floor} />
      <ContactShadows position={[0, 0.002, 0]} opacity={light ? 0.35 : 0.7} scale={8} blur={2.4} far={3} />
      {!reduced && (
        <Sparkles count={110} scale={[10, 12, 6]} position={[0, 5.5, 0]} size={1.6} speed={0.18} opacity={0.35} color="#ffe9cc" />
      )}

      <CameraRig reduced={reduced} />

      {fx && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={light ? 0.35 : 0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={CA_OFFSET}
            radialModulation
            modulationOffset={0.25}
          />
          <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={light ? 0.06 : 0.12} />
          <Vignette eskil={false} offset={0.22} darkness={light ? 0.35 : 0.85} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
