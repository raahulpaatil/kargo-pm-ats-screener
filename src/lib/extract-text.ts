import { PDFParse } from 'pdf-parse'
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
