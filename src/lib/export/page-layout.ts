/**
 * Deterministic Screenplay Pagination Engine
 * Implements EXP-001 pagination specifications.
 * 
 * Screenplay standard formatting metrics:
 * - Font: Courier 12pt (monospace, 10 characters per inch)
 * - Vertical line pitch: 6 lines per inch (1 line = 1/6" = 12pt)
 * - US Letter (8.5" x 11"): 1.0" top/bottom margins = 9.0" printable = 54 lines/page
 * - A4 (8.27" x 11.69"): 1.0" top/bottom margins = 9.69" printable = ~58 lines/page
 * 
 * Rules enforced:
 * - Deterministic: same input always produces same output
 * - Scene heading orphan prevention: never left alone at bottom of page (< 2 subsequent lines)
 * - Character cue orphan prevention: never left alone at bottom of page
 * - Dialogue split: splits only if >= 2 lines on current page and >= 2 lines on next page
 * - Appends (MORE) to split dialogue on current page, SARAH (CONT'D) on next page
 * - Explicit page breaks respected
 * - Pure mathematical calculation; no browser DOM measurement
 */

import type {
  ScreenplayElement,
  PageFormatSettings,
  ActionElement,
  CharacterElement,
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
  isDualDialogueStart,
  isDualDialogueEnd,
} from '@/types'

// ============================================================================
// Types
// ============================================================================

/** Element positioned on a page with line numbers */
export interface PageElement {
  /** The screenplay element (original or modified for continuation) */
  element: ScreenplayElement
  /** 1-based start line on this page */
  startLine: number
  /** 1-based end line on this page */
  endLine: number
  /** Whether this element is continued from a previous page */
  isContinuation?: boolean
  /** Wrapped lines of text rendered on this page */
  lines?: string[]
}

/** Represents a single paginated page */
export interface Page {
  /** 1-based page number */
  pageNumber: number
  /** Elements appearing on this page */
  elements: PageElement[]
}

// ============================================================================
// Text Wrapping Utility
// ============================================================================

/**
 * Deterministically wraps text into lines fitting within maxChars width.
 * Splits on word boundaries. Breaks words only if they exceed maxChars.
 */
export function wrapText(text: string, maxChars: number): string[] {
  if (!text || text.trim().length === 0) {
    return ['']
  }

  const effectiveMax = Math.max(1, maxChars)
  const paragraphs = text.split('\n')
  const result: string[] = []

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) {
      result.push('')
      continue
    }

    const words = trimmed.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      if (!currentLine) {
        if (word.length > effectiveMax) {
          let remaining = word
          while (remaining.length > effectiveMax) {
            result.push(remaining.slice(0, effectiveMax))
            remaining = remaining.slice(effectiveMax)
          }
          currentLine = remaining
        } else {
          currentLine = word
        }
      } else if (currentLine.length + 1 + word.length <= effectiveMax) {
        currentLine += ' ' + word
      } else {
        result.push(currentLine)
        if (word.length > effectiveMax) {
          let remaining = word
          while (remaining.length > effectiveMax) {
            result.push(remaining.slice(0, effectiveMax))
            remaining = remaining.slice(effectiveMax)
          }
          currentLine = remaining
        } else {
          currentLine = word
        }
      }
    }

    if (currentLine) {
      result.push(currentLine)
    }
  }

  return result.length > 0 ? result : ['']
}

// ============================================================================
// Layout Helpers
// ============================================================================

/**
 * Calculates printable height in lines based on paper size and margins.
 */
export function getLinesPerPage(settings: PageFormatSettings): number {
  const paperHeightInches = settings.paperSize === 'A4' ? 11.69 : 11.0
  const usableHeightInches = paperHeightInches - settings.margins.top - settings.margins.bottom
  const linesPerInch = 6.0 / (settings.lineHeight || 1.0)
  return Math.floor(usableHeightInches * linesPerInch)
}

/**
 * Calculates max characters per line for an element type.
 */
export function getMaxCharsForElement(type: string, settings: PageFormatSettings): number {
  const paperWidthInches = settings.paperSize === 'A4' ? 8.27 : 8.5
  const fullWidthInches = paperWidthInches - settings.margins.left - settings.margins.right
  const charsPerInch = 10 // Courier 12pt is 10 cpi

  switch (type) {
    case 'scene-heading':
    case 'action':
    case 'shot':
    case 'section':
    case 'transition':
      return Math.floor(fullWidthInches * charsPerInch)

    case 'character':
      // Indent at 3.7", typically ~35 characters max
      return 35

    case 'dialogue':
      return Math.floor((settings.dialogueWidth || 3.5) * charsPerInch)

    case 'parenthetical':
      return Math.floor((settings.parentheticalWidth || 2.0) * charsPerInch)

    default:
      return Math.floor(fullWidthInches * charsPerInch)
  }
}

/**
 * Formats element text representation.
 */
export function getElementText(el: ScreenplayElement): string {
  if (isSceneHeading(el)) {
    const loc = el.location ? el.location.toUpperCase() : ''
    const time = el.timeOfDay ? ` - ${el.timeOfDay.toUpperCase()}` : ''
    return `${el.interior}. ${loc}${time}`.trim()
  }
  if (isAction(el)) return el.text
  if (isCharacter(el)) {
    const name = el.name ? el.name.toUpperCase() : ''
    const ext = el.extension ? ` (${el.extension.toUpperCase()})` : ''
    return `${name}${ext}`
  }
  if (isDialogue(el)) return el.text
  if (isParenthetical(el)) {
    const t = el.text.trim()
    if (t.startsWith('(') && t.endsWith(')')) return t
    return `(${t})`
  }
  if (isTransition(el)) return el.text.toUpperCase()
  if (isShot(el)) return el.text.toUpperCase()
  if (isSection(el)) return el.title
  return ''
}

/**
 * Determines leading blank line spacing required before an element.
 */
function getLeadingBlankLines(
  currentElement: ScreenplayElement,
  previousElement: ScreenplayElement | null,
  isTopPage: boolean
): number {
  if (isTopPage) return 0

  if (!previousElement) return 0

  // Dialogue immediately follows Character or Parenthetical
  if (isDialogue(currentElement)) {
    if (isCharacter(previousElement) || isParenthetical(previousElement)) {
      return 0
    }
    return 1
  }

  // Parenthetical immediately follows Character or Dialogue
  if (isParenthetical(currentElement)) {
    if (isCharacter(previousElement) || isDialogue(previousElement)) {
      return 0
    }
    return 1
  }

  // Dual dialogue start
  if (isDualDialogueStart(currentElement)) return 1

  // Dual dialogue elements inside container
  if (isDualDialogueEnd(currentElement)) return 0

  // Standard elements: Scene Heading, Action, Character, Transition, Shot, Section
  return 1
}

// ============================================================================
// Pagination Engine
// ============================================================================

/**
 * Deterministically paginates screenplay elements into pages.
 * 
 * @param elements Array of screenplay elements
 * @param settings Page format settings (defaults to DEFAULT_PAGE_FORMAT)
 * @returns Array of Paginated Page objects
 */
export function paginateScreenplay(
  elements: ScreenplayElement[],
  settings: PageFormatSettings = DEFAULT_PAGE_FORMAT
): Page[] {
  const maxLinesPerPage = getLinesPerPage(settings)
  const pages: Page[] = []

  let currentPageNumber = 1
  let currentLine = 1 // 1-indexed, ranges from 1 to maxLinesPerPage
  let currentPageElements: PageElement[] = []
  let previousElement: ScreenplayElement | null = null

  /** Finalizes the current page and initializes the next */
  const advanceToNewPage = () => {
    pages.push({
      pageNumber: currentPageNumber,
      elements: currentPageElements,
    })
    currentPageNumber++
    currentLine = 1
    currentPageElements = []
    previousElement = null
  }

  const elementList = [...elements]
  let i = 0
  while (i < elementList.length) {
    const el = elementList[i]

    // Handle Page Break
    if (isPageBreak(el)) {
      currentPageElements.push({
        element: el,
        startLine: currentLine,
        endLine: currentLine,
      })
      advanceToNewPage()
      i++
      continue
    }

    // Handle Dual Dialogue Start & End markers
    if (isDualDialogueStart(el) || isDualDialogueEnd(el)) {
      currentPageElements.push({
        element: el,
        startLine: currentLine,
        endLine: currentLine,
      })
      previousElement = el
      i++
      continue
    }

    // Calculate lines required for this element
    const maxChars = getMaxCharsForElement(el.type, settings)
    const text = getElementText(el)
    const wrappedLines = wrapText(text, maxChars)
    const contentLineCount = Math.max(1, wrappedLines.length)

    // Calculate leading blank lines
    const isTopPage = currentLine === 1
    const blankLines = getLeadingBlankLines(el, previousElement, isTopPage)
    const totalLinesNeeded = blankLines + contentLineCount

    // ------------------------------------------------------------------------
    // Rule: Scene Heading Orphan Prevention
    // A scene heading cannot sit at the bottom of a page without at least
    // 2 lines of subsequent action or character/dialogue.
    // ------------------------------------------------------------------------
    if (isSceneHeading(el)) {
      const minRequired = blankLines + contentLineCount + 1 + 2 // blank + heading + blank + 2 lines content
      if (currentLine + minRequired - 1 > maxLinesPerPage && !isTopPage) {
        advanceToNewPage()
        continue // Re-evaluate at top of new page
      }
    }

    // ------------------------------------------------------------------------
    // Rule: Character Cue Orphan Prevention
    // A character cue cannot be placed on a page without at least 2 lines of
    // dialogue following it on the same page.
    // ------------------------------------------------------------------------
    if (isCharacter(el)) {
      // Look ahead to check dialogue
      const nextEl = i + 1 < elementList.length ? elementList[i + 1] : null
      let requiredForDialogue = 2 // standard min lines of dialogue
      if (nextEl && isDialogue(nextEl)) {
        const dLines = wrapText(getElementText(nextEl), getMaxCharsForElement('dialogue', settings))
        requiredForDialogue = Math.min(dLines.length, 2)
      } else if (nextEl && isParenthetical(nextEl)) {
        requiredForDialogue = 3 // paren (1) + at least 1-2 dialogue
      }

      const totalNeeded = blankLines + contentLineCount + requiredForDialogue
      if (currentLine + totalNeeded - 1 > maxLinesPerPage && !isTopPage) {
        advanceToNewPage()
        continue // Re-evaluate at top of new page
      }
    }

    // ------------------------------------------------------------------------
    // Element fits completely on current page
    // ------------------------------------------------------------------------
    if (currentLine + totalLinesNeeded - 1 <= maxLinesPerPage) {
      const elementStartLine = currentLine + blankLines
      const elementEndLine = elementStartLine + contentLineCount - 1

      currentPageElements.push({
        element: el,
        startLine: elementStartLine,
        endLine: elementEndLine,
        lines: wrappedLines,
      })

      currentLine = elementEndLine + 1
      previousElement = el
      i++
      continue
    }

    // ------------------------------------------------------------------------
    // Element exceeds current page
    // ------------------------------------------------------------------------

    // If we're already at top of page and a single element exceeds the page height,
    // we must place what fits or force it.
    const availableLines = maxLinesPerPage - currentLine + 1 - blankLines

    // Dialogue split rule
    if (isDialogue(el)) {
      // A dialogue block can split if:
      // 1. At least 2 lines fit on current page before (MORE)
      // 2. At least 2 lines carry over to next page after (CONT'D)
      // We need room for: dialogue lines + 1 line for '(MORE)'
      const linesForCurrentPage = availableLines - 1 // reserve 1 line for (MORE)

      if (linesForCurrentPage >= 2 && contentLineCount - linesForCurrentPage >= 2 && !isTopPage) {
        // Split dialogue
        const currentPartLines = wrappedLines.slice(0, linesForCurrentPage)
        currentPartLines.push('(MORE)')

        const remainingPartLines = wrappedLines.slice(linesForCurrentPage)

        const elementStartLine = currentLine + blankLines
        const elementEndLine = elementStartLine + currentPartLines.length - 1

        currentPageElements.push({
          element: el,
          startLine: elementStartLine,
          endLine: elementEndLine,
          lines: currentPartLines,
        })

        advanceToNewPage()

        // On next page, insert Character (CONT'D)
        const charName = previousElement && isCharacter(previousElement)
          ? previousElement.name
          : 'CHARACTER'

        const contdCharacter: CharacterElement = {
          id: `${el.id}_contd_char` as any,
          type: 'character',
          name: `${charName} (CONT'D)`,
          createdAt: el.createdAt,
          updatedAt: el.updatedAt,
          schemaVersion: el.schemaVersion,
        }

        currentPageElements.push({
          element: contdCharacter,
          startLine: 1,
          endLine: 1,
          isContinuation: true,
          lines: [`${charName} (CONT'D)`],
        })

        // Insert remaining dialogue
        const nextPartStart = 2
        const nextPartEnd = nextPartStart + remainingPartLines.length - 1

        currentPageElements.push({
          element: el,
          startLine: nextPartStart,
          endLine: nextPartEnd,
          isContinuation: true,
          lines: remainingPartLines,
        })

        currentLine = nextPartEnd + 1
        previousElement = el
        i++
        continue
      }
    }

    // Action paragraph split rule:
    // Can split if at least 2 lines fit on this page and at least 2 lines remain
    if (isAction(el) && availableLines >= 2 && contentLineCount - availableLines >= 2 && !isTopPage) {
      const currentPartLines = wrappedLines.slice(0, availableLines)
      const remainingPartLines = wrappedLines.slice(availableLines)

      const elementStartLine = currentLine + blankLines
      const elementEndLine = elementStartLine + currentPartLines.length - 1

      currentPageElements.push({
        element: el,
        startLine: elementStartLine,
        endLine: elementEndLine,
        lines: currentPartLines,
      })

      advanceToNewPage()

      // Place remainder on new page
      const nextPartStart = 1
      const nextPartEnd = nextPartStart + remainingPartLines.length - 1

      currentPageElements.push({
        element: el,
        startLine: nextPartStart,
        endLine: nextPartEnd,
        isContinuation: true,
        lines: remainingPartLines,
      })

      currentLine = nextPartEnd + 1
      previousElement = el
      i++
      continue
    }

    // Default: push element entirely to next page
    if (!isTopPage) {
      advanceToNewPage()
      continue // Re-evaluate on new page
    } else {
      // Element is larger than a single entire page!
      // Must take what fits on this page and continue the rest
      const linesThisPage = wrappedLines.slice(0, maxLinesPerPage)
      const linesRemainder = wrappedLines.slice(maxLinesPerPage)

      currentPageElements.push({
        element: el,
        startLine: 1,
        endLine: maxLinesPerPage,
        lines: linesThisPage,
      })

      advanceToNewPage()

      // Remaining lines become a synthetic action element or continue on next iteration
      const remainderEl: ActionElement = {
        id: `${el.id}_contd` as any,
        type: 'action',
        text: linesRemainder.join(' '),
        createdAt: el.createdAt,
        updatedAt: el.updatedAt,
        schemaVersion: el.schemaVersion,
      }

      elementList.splice(i + 1, 0, remainderEl)
      i++
    }
  }

  // Push the final page if it contains elements or if document is empty
  if (currentPageElements.length > 0 || pages.length === 0) {
    pages.push({
      pageNumber: currentPageNumber,
      elements: currentPageElements,
    })
  }

  return pages
}
