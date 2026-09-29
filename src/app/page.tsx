import { UploadForm } from '@/components/UploadForm'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas py-16 px-4">
      <h1 className="text-3xl font-semibold text-ink text-center mb-2">PM / SPM Resume Screener</h1>
      <p className="text-subtle text-center mb-10">Score candidates against Kargo&apos;s shortlisting rubric.</p>
      <UploadForm />
    </main>
  )
}
