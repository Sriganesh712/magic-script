/**
 * Screenplay PDF Generator
 * Implements EXP-002 PDF export specifications.
 * 
 * Uses jsPDF with Courier font, deterministic pagination engine,
 * professional screenplay margins, top-right page numbering (starting page 2),
 * optional title page, optional scene numbers, and optional watermark.
 */

import { jsPDF } from 'jspdf'
import type {
  ScreenplayDocument,
  ExportOptions,
  PageFormatSettings,
  SceneHeadingElement,
} from '@/types'
import {
  DEFAULT_PAGE_FORMAT,
  isSceneHeading,
  isAction,
  isCharacter,
  isDialogue,
  isParenthetical,
  isTransition,
  isShot,
  isSection,
  isPageBreak,
} from '@/types'
import { paginateScreenplay } from './page-layout'
import type { PageElement } from './page-layout'

// ============================================================================
// PDF Export Function
// ============================================================================

/**
 * Generates a professionally formatted Screenplay PDF from a ScreenplayDocument.
 * 
 * @param document The ScreenplayDocument to export
 * @param options Export options (margins, title page, page numbers, etc.)
 * @returns Promise resolving to the PDF Blob
 */
export async function exportToPDF(
  document: ScreenplayDocument,
  options: ExportOptions
): Promise<Blob> {
  const settings: PageFormatSettings = {
    ...DEFAULT_PAGE_FORMAT,
    ...options.pageFormat,
  }

  const isA4 = settings.paperSize === 'A4'
  const pageWidth = isA4 ? 8.27 : 8.5
  const pageHeight = isA4 ? 11.69 : 11.0

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: isA4 ? 'a4' : 'letter',
  })

  // Set Courier 12pt font
  doc.setFont('courier', 'normal')
  doc.setFontSize(settings.fontSize || 12)

  // 1 line = 1/6 inch at standard 6 lpi
  const lineHeightInches = (1.0 / 6.0) * (settings.lineHeight || 1.0)
  // Font baseline offset in inches (~0.12 in for 12pt font)
  const baselineOffset = 0.11

  let isFirstDocPage = true

  // ==========================================================================
  // Render Title Page (if requested)
  // ==========================================================================
  if (options.includeTitlePage) {
    isFirstDocPage = false

    // Watermark on title page if specified
    if (options.watermark) {
      renderWatermark(doc, options.watermark, pageWidth, pageHeight)
    }

    const title = document.metadata.title || 'UNTITLED'
    const author = document.metadata.author || ''
    const contact = document.metadata.contact || ''
    const draftDate = document.metadata.draftDate || ''

    // Title centered at ~3.5-4.0 inches
    doc.setFont('courier', 'bold')
    doc.setFontSize(16)
    doc.text(title.toUpperCase(), pageWidth / 2, 4.0, { align: 'center' })

    // "written by" or "by" centered
    doc.setFont('courier', 'normal')
    doc.setFontSize(12)
    doc.text('written by', pageWidth / 2, 4.8, { align: 'center' })

    // Author
    if (author) {
      doc.text(author, pageWidth / 2, 5.3, { align: 'center' })
    }

    // Contact and Date at bottom left
    const bottomY = pageHeight - 1.5
    let currentBottomY = bottomY

    if (draftDate) {
      doc.text(draftDate, settings.margins.left, currentBottomY)
      currentBottomY += 0.25
    }

    if (contact) {
      const contactLines = contact.split('\n')
      for (const cLine of contactLines) {
        doc.text(cLine, settings.margins.left, currentBottomY)
        currentBottomY += 0.2
      }
    }
  }

  // ==========================================================================
  // Paginate Elements
  // ==========================================================================
  const pages = paginateScreenplay(document.elements, settings)

  // ==========================================================================
  // Render Script Pages
  // ==========================================================================
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx]

    if (!isFirstDocPage) {
      doc.addPage()
    }
    isFirstDocPage = false

    // Watermark
    if (options.watermark) {
      renderWatermark(doc, options.watermark, pageWidth, pageHeight)
    }

    // Page number (top right at 0.5", starting on page 2)
    if (options.includePageNumbers !== false && page.pageNumber > 1) {
      doc.setFont('courier', 'normal')
      doc.setFontSize(settings.fontSize || 12)
      const pageNumStr = `${page.pageNumber}.`
      const pageNumX = pageWidth - settings.margins.right
      const pageNumY = 0.5
      doc.text(pageNumStr, pageNumX, pageNumY, { align: 'right' })
    }

    // Render elements on this page
    for (const pageEl of page.elements) {
      renderPageElement(doc, pageEl, settings, pageWidth, lineHeightInches, baselineOffset, options)
    }
  }

  // Produce PDF Blob
  const arrayBuffer = doc.output('arraybuffer')
  return new Blob([arrayBuffer], { type: 'application/pdf' })
}

// ============================================================================
// Element Renderer
// ============================================================================

function renderPageElement(
  doc: jsPDF,
  pageEl: PageElement,
  settings: PageFormatSettings,
  pageWidth: number,
  lineHeightInches: number,
  baselineOffset: number,
  options: ExportOptions
): void {
  const el = pageEl.element
  if (isPageBreak(el)) return

  const lines = pageEl.lines || []
  if (lines.length === 0) return

  // Calculate starting Y position based on startLine
  const startY = settings.margins.top + (pageEl.startLine - 1) * lineHeightInches + baselineOffset

  // Determine font styling
  if (isSceneHeading(el) && settings.sceneHeadingStyle === 'bold') {
    doc.setFont('courier', 'bold')
  } else if (isSection(el)) {
    doc.setFont('courier', 'bold')
  } else {
    doc.setFont('courier', 'normal')
  }

  doc.setFontSize(settings.fontSize || 12)

  // Determine X coordinate and alignment
  if (isSceneHeading(el)) {
    const headingEl = el as SceneHeadingElement
    const x = settings.margins.left

    // Optional Scene Numbers (on both left and right margin)
    if (options.includeSceneNumbers && headingEl.sceneNumber) {
      const sceneNumStr = String(headingEl.sceneNumber)
      doc.text(sceneNumStr, x - 0.4, startY)
      doc.text(sceneNumStr, pageWidth - settings.margins.right + 0.1, startY)
    }

    for (let l = 0; l < lines.length; l++) {
      const lineY = startY + l * lineHeightInches
      doc.text(lines[l], x, lineY)
    }
  } else if (isAction(el) || isShot(el) || isSection(el)) {
    const x = settings.margins.left
    for (let l = 0; l < lines.length; l++) {
      const lineY = startY + l * lineHeightInches
      doc.text(lines[l], x, lineY)
    }
  } else if (isCharacter(el)) {
    const x = settings.characterIndent || 3.7
    for (let l = 0; l < lines.length; l++) {
      const lineY = startY + l * lineHeightInches
      doc.text(lines[l], x, lineY)
    }
  } else if (isDialogue(el)) {
    const x = settings.dialogueIndent || 2.5
    for (let l = 0; l < lines.length; l++) {
      const lineY = startY + l * lineHeightInches
      const lineText = lines[l]
      // Center (MORE) if present
      if (lineText === '(MORE)') {
        const moreX = settings.characterIndent || 3.7
        doc.text(lineText, moreX, lineY)
      } else {
        doc.text(lineText, x, lineY)
      }
    }
  } else if (isParenthetical(el)) {
    const x = settings.parentheticalIndent || 3.1
    for (let l = 0; l < lines.length; l++) {
      const lineY = startY + l * lineHeightInches
      doc.text(lines[l], x, lineY)
    }
  } else if (isTransition(el)) {
    const rightMarginX = pageWidth - settings.margins.right
    for (let l = 0; l < lines.length; l++) {
      const lineY = startY + l * lineHeightInches
      doc.text(lines[l], rightMarginX, lineY, { align: 'right' })
    }
  }
}

// ============================================================================
// Watermark Renderer
// ============================================================================

function renderWatermark(doc: jsPDF, watermark: string, pageWidth: number, pageHeight: number): void {
  const currentFont = doc.getFont()
  const currentSize = doc.getFontSize()

  doc.setTextColor(215, 215, 215)
  doc.setFont('courier', 'bold')
  doc.setFontSize(48)

  doc.text(watermark.toUpperCase(), pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
  })

  // Reset font and color
  doc.setTextColor(0, 0, 0)
  doc.setFont(currentFont.fontName, currentFont.fontStyle)
  doc.setFontSize(currentSize)
}
