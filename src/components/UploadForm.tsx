'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { RoleToggle } from '@/components/RoleToggle'
import { runWithConcurrency } from '@/lib/concurrency'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const batchIdRef = useRef<string | undefined>(undefined)
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
    await scoreOne(entry, batchIdRef.current)
  }

  async function handleStart() {
    if (files.length === 0) return
    setRunning(true)
    batchIdRef.current = files.length > 1 ? crypto.randomUUID() : undefined
    const results = await runWithConcurrency(files, CONCURRENCY, (entry) => scoreOne(entry, batchIdRef.current))
    setRunning(false)

    const allDone = results.every((r) => r.state === 'done')
    if (files.length === 1 && allDone) {
      router.push(`/candidate/${results[0].candidateId}`)
    } else if (files.length > 1 && batchIdRef.current) {
      router.push(`/batch/${batchIdRef.current}`)
    }
  }

  const doneCount = files.filter((f) => f.state === 'done').length

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex justify-center">
        <RoleToggle role={role} onChange={setRole} />
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl2 p-12 text-center cursor-pointer bg-surface hover:border-accent transition"
      >
        <p className="text-ink font-medium mb-1">Drop resumes here or click to upload</p>
        <p className="text-subtle text-sm">PDF or DOCX, one or many</p>
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
          {files.map((f) => (
            <div key={f.file.name} className="flex items-center justify-between bg-surface shadow-soft rounded-lg px-4 py-3 text-sm">
              <span className="text-ink">{f.file.name}</span>
              {f.state === 'error' ? (
                <button onClick={() => retryOne(f)} className="text-danger font-medium">
                  {f.error} · Retry
                </button>
              ) : (
                <span className="text-subtle capitalize">{f.state}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={handleStart}
          disabled={running}
          className="mt-6 w-full bg-accent text-white rounded-lg py-3 font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {running ? `Scoring ${doneCount}/${files.length}…` : `Score ${files.length} resume${files.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}
