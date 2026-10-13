/**
 * Fountain Screenplay Markup Parser
 * Implements EXP-004 Fountain import specifications.
 * 
 * Complies with official Fountain 1.1 syntax (https://fountain.io/syntax):
 * - Key-value title page parsing
 * - Standard and forced scene headings with scene numbers (#1#)
 * - Character cues with extensions and dual dialogue carets (^)
 * - Parentheticals and dialogue blocks
 * - Transitions (standard TO: and forced >)
 * - Section headers (#, ##, ###)
 * - Page breaks (===)
 * - Action paragraphs (standard and forced !)
 * - Graceful error handling and non-fatal warnings
 */

import type {
  EntityId,
  Timestamp,
  ImportResult,
  ImportWarning,
  ImportError,
  ScreenplayDocument,
  ScreenplayElement,
  SceneHeadingElement,
  ActionElement,
  CharacterElement,
  DialogueElement,
  ParentheticalElement,
  TransitionElement,
  SectionElement,
  PageBreakElement,
} from '@/types'

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): EntityId {
  return `id_${Date.now()}_${Math.random().toString(36).substring(2, 11)}` as EntityId
}

function getTimestamp(): Timestamp {
  return Date.now() as Timestamp
}

// ============================================================================
// Fountain Parser
// ============================================================================

/**
 * Imports and parses a Fountain formatted text string into a ScreenplayDocument.
 * 
 * @param text Fountain formatted screenplay text
 * @returns ImportResult with document and any warnings or errors
 */
export function importFountain(text: string): ImportResult {
  const warnings: ImportWarning[] = []
  const errors: ImportError[] = []

  if (!text || text.trim().length === 0) {
    return {
      success: true,
      document: {
        id: generateId(),
        projectId: generateId(),
        draftId: generateId(),
        metadata: { title: 'Untitled' },
        elements: [],
        schemaVersion: 1,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
      },
      warnings: [{ code: 'EMPTY_DOCUMENT', message: 'Fountain text input is empty' }],
      errors: [],
    }
  }

  // Normalize line breaks
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalizedText.split('\n')

  // --------------------------------------------------------------------------
  // Phase 1: Parse Title Page Metadata
  // --------------------------------------------------------------------------
  const metadata: Record<string, string> = {}
  let lineIdx = 0

  // Title page keys match "Key: Value" at the very start of the file
  const titleKeyRegex = /^([A-Za-z0-9\s_-]+):\s*(.*)$/

  let parsingTitlePage = false
  let currentTitleKey = ''

  while (lineIdx < rawLines.length) {
    const line = rawLines[lineIdx]
    const trimmed = line.trim()

    if (!parsingTitlePage && trimmed === '') {
      lineIdx++
      continue
    }

    const keyMatch = line.match(titleKeyRegex)
    if (keyMatch) {
      parsingTitlePage = true
      currentTitleKey = keyMatch[1].trim().toLowerCase()
      metadata[currentTitleKey] = keyMatch[2].trim()
      lineIdx++
    } else if (parsingTitlePage && (line.startsWith(' ') || line.startsWith('\t'))) {
      // Indented continuation of multi-line value
      if (currentTitleKey) {
        metadata[currentTitleKey] += '\n' + trimmed
      }
      lineIdx++
    } else if (parsingTitlePage && trimmed === '') {
      // Blank line terminates title page
      lineIdx++
      break
    } else {
      // Non-title page content encountered
      break
    }
  }

  // --------------------------------------------------------------------------
  // Phase 2: Split Body into Paragraph Blocks
  // --------------------------------------------------------------------------
  const bodyLines = rawLines.slice(lineIdx)
  const blocks: string[][] = []
  let currentBlock: string[] = []

  for (const line of bodyLines) {
    if (line.trim() === '') {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock)
        currentBlock = []
      }
    } else {
      currentBlock.push(line)
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock)
  }

  // --------------------------------------------------------------------------
  // Phase 3: Parse Blocks into ScreenplayElements
  // --------------------------------------------------------------------------
  const elements: ScreenplayElement[] = []
  let lastCharacterId: EntityId = generateId()

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b]
    const firstLine = block[0].trim()

    // 1. Page Break (===)
    if (/^={3,}$/.test(firstLine)) {
      elements.push({
        id: generateId(),
        type: 'page-break',
        forced: true,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        schemaVersion: 1,
      } as PageBreakElement)
      continue
    }

    // 2. Section Header (# Act I)
    const sectionMatch = firstLine.match(/^(#{1,6})\s+(.+)$/)
    if (sectionMatch) {
      elements.push({
        id: generateId(),
        type: 'section',
        title: sectionMatch[2].trim(),
        level: sectionMatch[1].length,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        schemaVersion: 1,
      } as SectionElement)
      continue
    }

    // 3. Synopses (= ...)
    if (firstLine.startsWith('=')) {
      warnings.push({
        code: 'SYNOPSIS_IGNORED',
        message: `Synopsis noted: "${firstLine.slice(1).trim()}"`,
        location: { line: b, column: 1 },
      })
      continue
    }

    // 4. Notes ([[ ... ]])
    if (firstLine.startsWith('[[') && firstLine.endsWith(']]')) {
      warnings.push({
        code: 'NOTE_IGNORED',
        message: `Fountain note: "${firstLine.slice(2, -2).trim()}"`,
        location: { line: b, column: 1 },
      })
      continue
    }

    // 5. Forced Scene Heading (.LOCATION)
    if (firstLine.startsWith('.') && !firstLine.startsWith('..')) {
      const headingContent = firstLine.slice(1).trim()
      const headingEl = parseSceneHeadingText(headingContent)
      elements.push(headingEl)
      continue
    }

    // 6. Standard Scene Heading (INT., EXT., etc.)
    const sceneHeadingRegex = /^(INT|EXT|INT\/EXT|INT\.\/EXT|I\/E|EST)\.?\s+(.+)$/i
    if (sceneHeadingRegex.test(firstLine)) {
      const headingEl = parseSceneHeadingText(firstLine)
      elements.push(headingEl)
      continue
    }

    // 7. Forced Transition (> ...)
    if (firstLine.startsWith('>') && !firstLine.endsWith('<')) {
      const transText = firstLine.slice(1).trim()
      elements.push({
        id: generateId(),
        type: 'transition',
        text: transText,
        transitionType: getTransitionType(transText),
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        schemaVersion: 1,
      } as TransitionElement)
      continue
    }

    // 8. Standard Transition (CUT TO:)
    if (block.length === 1 && isTransitionLine(firstLine)) {
      elements.push({
        id: generateId(),
        type: 'transition',
        text: firstLine,
        transitionType: getTransitionType(firstLine),
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        schemaVersion: 1,
      } as TransitionElement)
      continue
    }

    // 9. Character and Dialogue Block
    // Character cues are uppercase (or forced with @) and followed by dialogue in the same block
    if (isCharacterCue(firstLine) && block.length > 1) {
      const charEl = parseCharacterCue(firstLine)
      lastCharacterId = charEl.id
      elements.push(charEl)

      // Parse remaining lines in this block (dialogue & parentheticals)
      let dLineIdx = 1
      while (dLineIdx < block.length) {
        const line = block[dLineIdx].trim()

        if (line.startsWith('(') && line.endsWith(')')) {
          // Parenthetical
          elements.push({
            id: generateId(),
            type: 'parenthetical',
            text: line.slice(1, -1).trim(),
            characterId: lastCharacterId,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp(),
            schemaVersion: 1,
          } as ParentheticalElement)
          dLineIdx++
        } else {
          // Collect dialogue lines until next parenthetical or end of block
          const dialogueLines: string[] = []
          while (dLineIdx < block.length && !(block[dLineIdx].trim().startsWith('(') && block[dLineIdx].trim().endsWith(')'))) {
            dialogueLines.push(block[dLineIdx].trim())
            dLineIdx++
          }

          if (dialogueLines.length > 0) {
            elements.push({
              id: generateId(),
              type: 'dialogue',
              text: dialogueLines.join('\n'),
              characterId: lastCharacterId,
              isDual: charEl.name.endsWith('^'),
              createdAt: getTimestamp(),
              updatedAt: getTimestamp(),
              schemaVersion: 1,
            } as DialogueElement)
          }
        }
      }
      continue
    }

    // 10. Action Paragraph (default)
    let actionText = block.map(l => l.trim()).join(' ')

    // Forced action with leading !
    if (actionText.startsWith('!')) {
      actionText = actionText.slice(1).trim()
    }
    // Centered text with > ... <
    else if (actionText.startsWith('>') && actionText.endsWith('<')) {
      actionText = actionText.slice(1, -1).trim()
    }

    elements.push({
      id: generateId(),
      type: 'action',
      text: actionText,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
      schemaVersion: 1,
    } as ActionElement)
  }

  // --------------------------------------------------------------------------
  // Phase 4: Construct Document
  // --------------------------------------------------------------------------
  const doc: ScreenplayDocument = {
    id: generateId(),
    projectId: generateId(),
    draftId: generateId(),
    metadata: {
      title: metadata['title'] || 'Untitled Screenplay',
      author: metadata['author'] || metadata['authors'] || '',
      contact: metadata['contact'] || '',
      draftDate: metadata['draft date'] || metadata['date'] || '',
    },
    elements,
    schemaVersion: 1,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
  }

  return {
    success: true,
    document: doc,
    warnings,
    errors,
  }
}

// ============================================================================
// Parsing Helpers
// ============================================================================

function parseSceneHeadingText(raw: string): SceneHeadingElement {
  let text = raw.trim()
  let sceneNumber: number | undefined

  // Check for scene number at end of line: #12# or #1A#
  const sceneNumMatch = text.match(/\s+#([^#]+)#$/)
  if (sceneNumMatch) {
    const numParsed = parseInt(sceneNumMatch[1], 10)
    if (!isNaN(numParsed)) {
      sceneNumber = numParsed
    }
    text = text.replace(/\s+#([^#]+)#$/, '').trim()
  }

  // Determine interior
  let interior: 'INT' | 'EXT' | 'INT/EXT' = 'INT'
  if (/^EXT\b/i.test(text)) {
    interior = 'EXT'
  } else if (/^(INT\/EXT|INT\.\/EXT|I\/E)\b/i.test(text)) {
    interior = 'INT/EXT'
  }

  // Strip prefix
  const prefixStripped = text.replace(/^(INT|EXT|INT\/EXT|INT\.\/EXT|I\/E|EST)\.?\s+/i, '').trim()

  // Split location and time of day
  let location = prefixStripped
  let timeOfDay = ''

  const dashIdx = prefixStripped.lastIndexOf(' - ')
  if (dashIdx !== -1) {
    location = prefixStripped.slice(0, dashIdx).trim()
    timeOfDay = prefixStripped.slice(dashIdx + 3).trim()
  }

  return {
    id: generateId(),
    type: 'scene-heading',
    interior,
    location: location.toUpperCase(),
    timeOfDay: timeOfDay.toUpperCase(),
    sceneNumber,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    schemaVersion: 1,
  }
}

function isTransitionLine(line: string): boolean {
  const upper = line.trim().toUpperCase()
  return upper.endsWith('TO:') && upper.length < 40
}

function getTransitionType(text: string): TransitionElement['transitionType'] {
  const upper = text.toUpperCase()
  if (upper.includes('CUT TO:')) return 'CUT_TO'
  if (upper.includes('FADE IN:')) return 'FADE_IN'
  if (upper.includes('FADE OUT')) return 'FADE_OUT'
  if (upper.includes('FADE TO:')) return 'FADE_TO'
  if (upper.includes('DISSOLVE TO:')) return 'DISSOLVE_TO'
  if (upper.includes('SMASH CUT')) return 'SMASH_CUT'
  if (upper.includes('MATCH CUT')) return 'MATCH_CUT'
  if (upper.includes('JUMP CUT')) return 'JUMP_CUT'
  return 'CUSTOM'
}

function isCharacterCue(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  // Forced character cue with @
  if (trimmed.startsWith('@')) return true

  // Standard character cue:
  // Must be uppercase with optional extension in parentheses and optional caret
  const charRegex = /^[A-Z0-9\s.,'—\-]+(?:\s*\([^)]+\))*\s*\^?$/
  if (!charRegex.test(trimmed)) return false

  // Transitions and scene headings should not be mistaken for characters
  if (trimmed.endsWith('TO:')) return false
  if (/^(INT|EXT|INT\/EXT|I\/E)\.?\s+/i.test(trimmed)) return false

  return true
}

function parseCharacterCue(line: string): CharacterElement {
  let raw = line.trim()

  // Remove forced @ prefix
  if (raw.startsWith('@')) {
    raw = raw.slice(1).trim()
  }

  // Remove dual dialogue caret
  let isDual = false
  if (raw.endsWith('^')) {
    isDual = true
    raw = raw.slice(0, -1).trim()
  }

  // Extract extension in parentheses (V.O., O.S., etc.)
  let name = raw
  let extension: string | undefined

  const extMatch = raw.match(/\s*\(([^)]+)\)$/)
  if (extMatch) {
    extension = extMatch[1].trim()
    name = raw.slice(0, extMatch.index).trim()
  }

  return {
    id: generateId(),
    type: 'character',
    name: name.toUpperCase() + (isDual ? ' ^' : ''),
    extension,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    schemaVersion: 1,
  }
}
