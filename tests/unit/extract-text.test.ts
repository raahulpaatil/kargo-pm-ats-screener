import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { extractText, fileKindFromName, ExtractionError } from '@/lib/extract-text'

async function makePdf(text: string | null): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  if (text) {
    const font = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText(text, { x: 50, y: page.getHeight() - 50, size: 12, font })
  }
  const bytes = await doc.save()
  return Buffer.from(bytes)
}

async function makeDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  })
  return Packer.toBuffer(doc)
}

describe('fileKindFromName', () => {
  it('recognizes .pdf', () => expect(fileKindFromName('resume.pdf')).toBe('pdf'))
  it('recognizes .docx case-insensitively', () => expect(fileKindFromName('Resume.DOCX')).toBe('docx'))
  it('returns null for unsupported extensions', () => expect(fileKindFromName('resume.txt')).toBeNull())
})

describe('extractText', () => {
  it('extracts text from a PDF', async () => {
    const buf = await makePdf('Product Manager with 5 years of experience shipping features and killing underperforming ones based on data.')
    const text = await extractText(buf, 'pdf')
    expect(text).toContain('Product Manager')
  })

  it('extracts text from a DOCX', async () => {
    const buf = await makeDocx('Senior Product Manager who owned integration architecture decisions across three platform teams.')
    const text = await extractText(buf, 'docx')
    expect(text).toContain('Senior Product Manager')
  })

  it('throws ExtractionError on a near-empty PDF (scanned/image-only)', async () => {
    const buf = await makePdf(null)
    await expect(extractText(buf, 'pdf')).rejects.toThrow(ExtractionError)
  })
})
