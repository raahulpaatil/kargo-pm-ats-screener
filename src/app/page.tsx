import Link from 'next/link'
import { UploadForm } from '@/components/UploadForm'
import { TopBar } from '@/components/TopBar'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas py-6 px-4">
      <div className="max-w-xl mx-auto">
        <TopBar close={false}>
          <Link href="/candidates" className="text-accent text-sm font-medium hover:underline mr-2">
            View all candidates →
          </Link>
        </TopBar>
      </div>
      <h1 className="text-3xl font-semibold text-ink text-center mb-2 mt-6">PM / SPM Resume Screener</h1>
      <p className="text-subtle text-center mb-10">Score candidates against Kargo&apos;s shortlisting rubric.</p>
      <UploadForm />
    </main>
  )
}
