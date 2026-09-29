import mammoth from 'mammoth'

export type FileKind = 'pdf' | 'docx'

const MIN_TEXT_LENGTH = 30

export class ExtractionError extends Error {}

export function fileKindFromName(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx')) return 'docx'
  return null
}

export async function extractText(buffer: Buffer, kind: FileKind): Promise<string> {
  let text: string

  if (kind === 'pdf') {
    // pdfjs-dist (via pdf-parse) references `DOMMatrix` at module load time.
    // In Node it tries to polyfill that from the optional `@napi-rs/canvas`
    // native binding, which Vercel's serverless bundler doesn't reliably
    // include. Supplying a plain-JS DOMMatrix ourselves, before pdf-parse is
    // ever imported, makes pdfjs-dist skip that native-canvas path entirely
    // — we only need text extraction, never actual canvas rendering.
    if (!(globalThis as { DOMMatrix?: unknown }).DOMMatrix) {
      const { default: DOMMatrixPolyfill } = await import('dommatrix')
      ;(globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill
    }
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText()
      text = result.text
    } finally {
      await parser.destroy()
    }
  } else {
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  }

  const trimmed = text.trim()
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new ExtractionError(
      'Could not extract readable text from this file. It may be a scanned or image-only document, which is not supported.'
    )
  }
  return trimmed
}
