// Tiny pub/sub that lets the DOM upload form drive what the 3D monitor shows.
// Read inside the render loop via getScreenState(), so no React re-renders.

export type ScreenState = {
  mode: 'idle' | 'queued' | 'running' | 'done' | 'error'
  role: 'PM' | 'SPM'
  total: number
  done: number
  failed: number
  current?: string
}

let state: ScreenState = { mode: 'idle', role: 'PM', total: 0, done: 0, failed: 0 }
const listeners = new Set<() => void>()

export function getScreenState(): ScreenState {
  return state
}

export function setScreenState(patch: Partial<ScreenState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeScreenState(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
