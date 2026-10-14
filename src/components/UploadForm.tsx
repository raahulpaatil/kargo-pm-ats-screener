'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { RoleToggle } from '@/components/RoleToggle'
import { runWithConcurrency } from '@/lib/concurrency'
import { setScreenState } from '@/lib/screen-state'
import type { Role } from '@/lib/rubric'

type FileStatus = {
  file: File
  state: 'pending' | 'uploading' | 'scoring' | 'done' | 'error'
  error?: string
  candidateId?: string
}

const CONCURRENCY = 5

export function UploadForm() {
  const [role, setRole] = useState<Role>('PM')
  const [files, setFiles] = useState<FileStatus[]>([])
  const [running, setRunning] = useState(false)
  const [batchId, setBatchId] = useState<string | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(Array.from(list).map((file) => ({ file, state: 'pending' })))
  }

  async function scoreOne(entry: FileStatus, batchId: string | undefined): Promise<FileStatus> {
    try {
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? { ...f, state: 'uploading' } : f)))
      const blob = await upload(entry.file.name, entry.file, {
        access: 'private',
        handleUploadUrl: '/api/blob-token',
      })
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? { ...f, state: 'scoring' } : f)))
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blobUrl: blob.url, fileName: entry.file.name, role, batchId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const failed: FileStatus = { ...entry, state: 'error', error: body.error || 'Scoring failed.' }
        setFiles((prev) => prev.map((f) => (f.file === entry.file ? failed : f)))
        return failed
      }
      const json = await res.json()
      const done: FileStatus = { ...entry, state: 'done', candidateId: json.id }
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? done : f)))
      return done
    } catch {
      const failed: FileStatus = { ...entry, state: 'error', error: 'Upload failed.' }
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? failed : f)))
      return failed
    }
  }

  async function retryOne(entry: FileStatus) {
    setFiles((prev) => prev.map((f) => (f.file === entry.file ? { ...f, state: 'pending', error: undefined } : f)))
    await scoreOne(entry, batchId)
  }

  async function handleStart() {
    if (files.length === 0) return
    setRunning(true)
    const newBatchId = files.length > 1 ? crypto.randomUUID() : undefined
    setBatchId(newBatchId)
    const results = await runWithConcurrency(files, CONCURRENCY, (entry) => scoreOne(entry, newBatchId))
    setRunning(false)

    const allDone = results.every((r) => r.state === 'done')
    if (files.length === 1 && allDone) {
      router.push(`/candidate/${results[0].candidateId}`)
    } else if (files.length > 1 && newBatchId && allDone) {
      router.push(`/batch/${newBatchId}`)
    }
  }

  const doneCount = files.filter((f) => f.state === 'done').length
  const hasErrors = files.some((f) => f.state === 'error')
  const failedCount = files.filter((f) => f.state === 'error').length

  // Mirror progress onto the 3D monitor's terminal screen.
  useEffect(() => {
    const active = files.find((f) => f.state === 'uploading' || f.state === 'scoring')
    setScreenState({
      role,
      total: files.length,
      done: doneCount,
      failed: failedCount,
      current: active?.file.name,
      mode: running
        ? 'running'
        : files.length === 0
          ? 'idle'
          : failedCount > 0
            ? 'error'
            : doneCount === files.length
              ? 'done'
              : 'queued',
    })
  }, [files, role, running, doneCount, failedCount])
  const canViewBatch = Boolean(batchId) && files.length > 1 && doneCount > 0 && !running

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-center">
        <RoleToggle role={role} onChange={setRole} />
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload resumes: drop PDF or DOCX files here, or press Enter to browse"
        className="group relative border-2 border-dashed border-line rounded-md px-6 py-12 text-center cursor-pointer bg-canvas/70 hover:border-accent focus-visible:border-accent transition-colors"
      >
        <p className="pixel text-2xl text-accent mb-2">
          C:\&gt; INSERT RESUME<span className="blink" aria-hidden="true">_</span>
        </p>
        <p className="text-ink text-lg mb-1">Drop resumes here or click to upload</p>
        <p className="text-subtle">PDF or DOCX, one or many</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-3 bg-canvas/70 border border-line rounded-md px-4 py-3">
              <span className="text-ink truncate min-w-0">{f.file.name}</span>
              {f.state === 'error' ? (
                <button onClick={() => retryOne(f)} className="pixel text-lg text-danger shrink-0 cursor-pointer hover:underline">
                  {f.error} · Retry
                </button>
              ) : (
                <span className={`pixel text-lg uppercase shrink-0 ${f.state === 'done' ? 'text-good' : 'text-subtle'}`}>
                  {f.state === 'done' ? '[ OK ]' : f.state}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={handleStart}
          disabled={running}
          className="mt-6 w-full bg-ink text-canvas rounded-md py-3 text-lg font-semibold hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
        >
          {running ? `Scoring ${doneCount}/${files.length}…` : `Score ${files.length} resume${files.length > 1 ? 's' : ''}`}
        </button>
      )}

      {!running && hasErrors && (
        <p role="status" className="mt-3 text-center text-sm text-subtle">
          Some files failed. Retry them above, or continue to the batch with the ones that succeeded.
        </p>
      )}

      {canViewBatch && (
        <button
          onClick={() => router.push(`/batch/${batchId}`)}
          className="mt-3 w-full border border-line text-ink rounded-md py-3 font-medium hover:border-accent transition-colors cursor-pointer"
        >
          View batch results ({doneCount}/{files.length} done)
        </button>
      )}
    </div>
  )
}
