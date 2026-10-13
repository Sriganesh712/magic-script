/**
 * Fountain Screenplay Markup Exporter
 * Implements EXP-003 Fountain export specifications.
 * 
 * Complies with official Fountain 1.1 syntax (https://fountain.io/syntax):
 * - Key-value title page metadata
 * - Standard and forced scene headings with scene numbers (#1#)
 * - Uppercase character cues with extensions and dual dialogue carets (^)
 * - Dialogue and parentheticals
 * - Standard (TO:) and forced (> ...) transitions
 * - Action paragraphs with forced action (!) when uppercase
 * - Section headers (#)
 * - Page breaks (===)
 */

import type {
  ScreenplayDocument,
  SceneHeadingElement,
  CharacterElement,
  ParentheticalElement,
} from '@/types'
import {
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
// Fountain Exporter
// ============================================================================

/**
 * Converts a ScreenplayDocument into a Fountain formatted text string.
 * 
 * @param document Screenplay document to export
 * @returns Plain text formatted in Fountain syntax
 */
export function exportToFountain(document: ScreenplayDocument): string {
  const parts: string[] = []

  // --------------------------------------------------------------------------
  // Title Page
  // --------------------------------------------------------------------------
  const metadata = document.metadata
  const titlePageLines: string[] = []

  if (metadata.title) {
    titlePageLines.push(`Title: ${metadata.title}`)
  }
  if (metadata.author) {
    titlePageLines.push(`Credit: written by`)
    titlePageLines.push(`Author: ${metadata.author}`)
  }
  if (metadata.draftDate) {
    titlePageLines.push(`Draft date: ${metadata.draftDate}`)
  }
  if (metadata.contact) {
    titlePageLines.push(`Contact:\n  ${metadata.contact.replace(/\n/g, '\n  ')}`)
  }

  if (titlePageLines.length > 0) {
    parts.push(titlePageLines.join('\n'))
    parts.push('') // Blank line separating title page from body
  }

  // --------------------------------------------------------------------------
  // Screenplay Body Elements
  // --------------------------------------------------------------------------
  const elements = document.elements

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]

    if (isDualDialogueStart(el) || isDualDialogueEnd(el)) {
      continue
    }

    if (isPageBreak(el)) {
      parts.push('\n===\n')
      continue
    }

    if (isSection(el)) {
      const hashes = '#'.repeat(Math.max(1, Math.min(el.level || 1, 6)))
      parts.push(`\n${hashes} ${el.title}\n`)
      continue
    }

    if (isSceneHeading(el)) {
      const headingText = formatSceneHeading(el)
      parts.push(`\n${headingText}\n`)
      continue
    }

    if (isTransition(el)) {
      const text = el.text.trim().toUpperCase()
      if (text.endsWith('TO:')) {
        parts.push(`\n${text}\n`)
      } else {
        parts.push(`\n> ${text}\n`)
      }
      continue
    }

    if (isShot(el)) {
      parts.push(`\n.${el.text.trim().toUpperCase()}\n`)
      continue
    }

    if (isCharacter(el)) {
      const charName = formatCharacter(el)
      parts.push(`\n${charName}`)
      continue
    }

    if (isParenthetical(el)) {
      const paren = formatParenthetical(el)
      parts.push(paren)
      continue
    }

    if (isDialogue(el)) {
      parts.push(el.text)
      continue
    }

    if (isAction(el)) {
      const text = el.text.trim()
      // If action line is entirely uppercase, prefix with ! to avoid being parsed as character
      if (isAllUpper(text) && text.length > 0) {
        parts.push(`\n!${text}\n`)
      } else {
        parts.push(`\n${text}\n`)
      }
      continue
    }
  }

  // Join and normalize excessive newlines (max 2 consecutive newlines)
  const result = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return result + '\n'
}

// ============================================================================
// Element Formatters
// ============================================================================

function formatSceneHeading(el: SceneHeadingElement): string {
  const loc = el.location ? el.location.toUpperCase() : ''
  const time = el.timeOfDay ? ` - ${el.timeOfDay.toUpperCase()}` : ''
  let heading = `${el.interior}. ${loc}${time}`.trim()

  // Standard scene heading prefixes
  const standardPrefix = /^(INT|EXT|INT\/EXT|INT\.\/EXT|I\/E)\.?\s+/i
  if (!standardPrefix.test(heading)) {
    heading = `.${heading}`
  }

  if (el.sceneNumber != null) {
    heading += ` #${el.sceneNumber}#`
  }

  return heading
}

function formatCharacter(el: CharacterElement): string {
  let name = el.name.trim().toUpperCase()
  if (el.extension) {
    name += ` (${el.extension.trim().toUpperCase()})`
  }
  return name
}

function formatParenthetical(el: ParentheticalElement): string {
  const text = el.text.trim()
  if (text.startsWith('(') && text.endsWith(')')) {
    return text
  }
  return `(${text})`
}

function isAllUpper(str: string): boolean {
  const letters = str.replace(/[^a-zA-Z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase()
}
