/**
 * Final Draft XML (.fdx) Parser
 * Implements EXP-006 Final Draft XML import specifications.
 * 
 * Parses Final Draft 8+ XML files into ScreenplayDocument:
 * - Extracts Content paragraphs (Scene Heading, Action, Character, Dialogue, Parenthetical, Transition, Shot)
 * - Detects PageBreak="Yes" attributes and dual dialogue flags
 * - Parses TitlePage metadata (title, author, contact, draft date)
 * - Reports warnings for unsupported tags or paragraph types
 * - Supports browser DOMParser and environment-agnostic XML fallback
 */

import type {
  EntityId,
  Timestamp,
  ImportResult,
  ImportWarning,
  ScreenplayDocument,
  ScreenplayElement,
  SceneHeadingElement,
  ActionElement,
  CharacterElement,
  DialogueElement,
  ParentheticalElement,
  TransitionElement,
  ShotElement,
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

function unescapeXml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

// ============================================================================
// FDX Parser
// ============================================================================

/**
 * Parses Final Draft XML into a ScreenplayDocument.
 * 
 * @param xml The Final Draft .fdx XML content string
 * @returns ImportResult with document and any warnings or errors
 */
export function importFDX(xml: string): ImportResult {
  const warnings: ImportWarning[] = []

  if (!xml || xml.trim().length === 0) {
    return {
      success: false,
      warnings: [],
      errors: [{ code: 'EMPTY_XML', message: 'Final Draft XML input is empty' }],
    }
  }

  try {
    // Attempt DOMParser if available (browser and jsdom)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')

      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        // Fall back to regex parser if DOMParser fails
        warnings.push({
          code: 'DOM_PARSER_WARNING',
          message: 'DOMParser encountered syntax warnings, attempting fallback parser',
        })
        return parseFDXWithRegex(xml, warnings)
      }

      return parseFDXFromDOM(doc, warnings)
    }

    // Otherwise use regex parser
    return parseFDXWithRegex(xml, warnings)
  } catch (err: any) {
    return {
      success: false,
      warnings,
      errors: [{ code: 'PARSE_FAILED', message: err?.message || 'Failed to parse FDX XML' }],
    }
  }
}

// ============================================================================
// DOM-based Parser
// ============================================================================

function parseFDXFromDOM(xmlDoc: Document, warnings: ImportWarning[]): ImportResult {
  const elements: ScreenplayElement[] = []
  let lastCharacterId: EntityId = generateId()

  // Parse Title Page
  const titlePageEl = xmlDoc.querySelector('TitlePage')
  let title = 'Untitled Screenplay'
  let author = ''
  let contact = ''
  let draftDate = ''

  if (titlePageEl) {
    const paragraphs = titlePageEl.querySelectorAll('Paragraph')

    let isPastWrittenBy = false
    for (let p = 0; p < paragraphs.length; p++) {
      const pNode = paragraphs[p]
      const textNodes = pNode.querySelectorAll('Text')
      let text = ''
      textNodes.forEach(t => { text += t.textContent || '' })
      text = text.trim()

      if (!text) continue

      if (text.toLowerCase() === 'written by' || text.toLowerCase() === 'by') {
        isPastWrittenBy = true
        continue
      }

      if (!isPastWrittenBy && title === 'Untitled Screenplay' && text.length > 0) {
        title = text
      } else if (isPastWrittenBy && !author) {
        author = text
      } else if (pNode.getAttribute('Alignment') === 'Left') {
        if (!draftDate && /\b(19\d\d|20\d\d|[A-Z][a-z]+ \d{1,2}, \d{4})\b/.test(text)) {
          draftDate = text
        } else {
          contact = contact ? `${contact}\n${text}` : text
        }
      }
    }
  }

  // Parse Content Paragraphs
  const contentEl = xmlDoc.querySelector('Content')
  if (!contentEl) {
    warnings.push({ code: 'NO_CONTENT', message: 'No <Content> element found in FDX XML' })
  }

  const paragraphNodes = contentEl ? contentEl.querySelectorAll('Paragraph') : xmlDoc.querySelectorAll('Paragraph')

  for (let pIdx = 0; pIdx < paragraphNodes.length; pIdx++) {
    const pNode = paragraphNodes[pIdx]
    const pType = (pNode.getAttribute('Type') || 'Action').trim()
    const isPageBreak = pNode.getAttribute('PageBreak') === 'Yes'
    const isDual = pNode.getAttribute('DualDialogue') === 'Yes'

    // Extract text content from all <Text> children
    const textNodes = pNode.querySelectorAll('Text')
    let text = ''
    textNodes.forEach(t => { text += t.textContent || '' })
    text = text.trim()

    // Page Break attribute takes precedence if text is empty or explicitly page-break
    if (isPageBreak && text === '') {
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

    switch (pType) {
      case 'Scene Heading': {
        const sceneNumAttr = pNode.getAttribute('Number')
        const sceneNumber = sceneNumAttr ? parseInt(sceneNumAttr, 10) : undefined
        elements.push(parseSceneHeading(text, isNaN(sceneNumber as any) ? undefined : sceneNumber))
        break
      }

      case 'Character': {
        const charEl = parseCharacter(text, isDual)
        lastCharacterId = charEl.id
        elements.push(charEl)
        break
      }

      case 'Dialogue': {
        elements.push({
          id: generateId(),
          type: 'dialogue',
          text,
          characterId: lastCharacterId,
          isDual,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as DialogueElement)
        break
      }

      case 'Parenthetical': {
        let pText = text
        if (pText.startsWith('(') && pText.endsWith(')')) {
          pText = pText.slice(1, -1).trim()
        }
        elements.push({
          id: generateId(),
          type: 'parenthetical',
          text: pText,
          characterId: lastCharacterId,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as ParentheticalElement)
        break
      }

      case 'Transition': {
        elements.push({
          id: generateId(),
          type: 'transition',
          text,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as TransitionElement)
        break
      }

      case 'Shot': {
        elements.push({
          id: generateId(),
          type: 'shot',
          text,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as ShotElement)
        break
      }

      case 'Action':
      case 'General': {
        if (text) {
          elements.push({
            id: generateId(),
            type: 'action',
            text,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp(),
            schemaVersion: 1,
          } as ActionElement)
        }
        break
      }

      default: {
        warnings.push({
          code: 'UNSUPPORTED_PARAGRAPH_TYPE',
          message: `Mapping unsupported paragraph type "${pType}" to Action`,
          location: { line: pIdx, column: 1 },
        })
        if (text) {
          elements.push({
            id: generateId(),
            type: 'action',
            text,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp(),
            schemaVersion: 1,
          } as ActionElement)
        }
        break
      }
    }

    if (isPageBreak && text !== '') {
      elements.push({
        id: generateId(),
        type: 'page-break',
        forced: true,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        schemaVersion: 1,
      } as PageBreakElement)
    }
  }

  const document: ScreenplayDocument = {
    id: generateId(),
    projectId: generateId(),
    draftId: generateId(),
    metadata: {
      title,
      author,
      contact,
      draftDate,
    },
    elements,
    schemaVersion: 1,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
  }

  return {
    success: true,
    document,
    warnings,
    errors: [],
  }
}

// ============================================================================
// Regex Fallback Parser
// ============================================================================

function parseFDXWithRegex(xml: string, warnings: ImportWarning[]): ImportResult {
  const elements: ScreenplayElement[] = []
  let lastCharacterId: EntityId = generateId()

  // Match TitlePage
  let title = 'Untitled Screenplay'
  let author = ''
  let contact = ''
  let draftDate = ''

  const titlePageMatch = xml.match(/<TitlePage>([\s\S]*?)<\/TitlePage>/)
  if (titlePageMatch) {
    const pMatches = titlePageMatch[1].matchAll(/<Paragraph([^>]*)>([\s\S]*?)<\/Paragraph>/g)
    let isPastWrittenBy = false

    for (const p of pMatches) {
      const pAttrs = p[1]
      const pBody = p[2]
      const textMatch = pBody.match(/<Text[^>]*>([\s\S]*?)<\/Text>/)
      if (!textMatch) continue
      const t = unescapeXml(textMatch[1]).trim()
      if (!t) continue

      if (t.toLowerCase() === 'written by' || t.toLowerCase() === 'by') {
        isPastWrittenBy = true
        continue
      }

      if (!isPastWrittenBy && title === 'Untitled Screenplay') {
        title = t
      } else if (isPastWrittenBy && !author) {
        author = t
      } else if (pAttrs.includes('Alignment="Left"')) {
        if (!draftDate && /\b(19\d\d|20\d\d|[A-Z][a-z]+ \d{1,2}, \d{4})\b/.test(t)) {
          draftDate = t
        } else {
          contact = contact ? `${contact}\n${t}` : t
        }
      }
    }
  }

  // Match Content Paragraphs
  const contentMatch = xml.match(/<Content>([\s\S]*?)<\/Content>/)
  const contentBody = contentMatch ? contentMatch[1] : xml

  const paragraphRegex = /<Paragraph([^>]*)>([\s\S]*?)<\/Paragraph>/g
  const matches = contentBody.matchAll(paragraphRegex)

  for (const m of matches) {
    const attrs = m[1]
    const inner = m[2]

    const typeMatch = attrs.match(/Type="([^"]+)"/)
    const pType = typeMatch ? typeMatch[1] : 'Action'
    const isPageBreak = /PageBreak="Yes"/.test(attrs)
    const isDual = /DualDialogue="Yes"/.test(attrs)

    // Extract all Text contents
    const textMatches = inner.matchAll(/<Text[^>]*>([\s\S]*?)<\/Text>/g)
    let text = ''
    for (const tm of textMatches) {
      text += unescapeXml(tm[1])
    }
    text = text.trim()

    if (isPageBreak && text === '') {
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

    switch (pType) {
      case 'Scene Heading': {
        const numMatch = attrs.match(/Number="([^"]+)"/)
        const sceneNumber = numMatch ? parseInt(numMatch[1], 10) : undefined
        elements.push(parseSceneHeading(text, isNaN(sceneNumber as any) ? undefined : sceneNumber))
        break
      }

      case 'Character': {
        const charEl = parseCharacter(text, isDual)
        lastCharacterId = charEl.id
        elements.push(charEl)
        break
      }

      case 'Dialogue': {
        elements.push({
          id: generateId(),
          type: 'dialogue',
          text,
          characterId: lastCharacterId,
          isDual,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as DialogueElement)
        break
      }

      case 'Parenthetical': {
        let pText = text
        if (pText.startsWith('(') && pText.endsWith(')')) {
          pText = pText.slice(1, -1).trim()
        }
        elements.push({
          id: generateId(),
          type: 'parenthetical',
          text: pText,
          characterId: lastCharacterId,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as ParentheticalElement)
        break
      }

      case 'Transition': {
        elements.push({
          id: generateId(),
          type: 'transition',
          text,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as TransitionElement)
        break
      }

      case 'Shot': {
        elements.push({
          id: generateId(),
          type: 'shot',
          text,
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
          schemaVersion: 1,
        } as ShotElement)
        break
      }

      case 'Action':
      case 'General': {
        if (text) {
          elements.push({
            id: generateId(),
            type: 'action',
            text,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp(),
            schemaVersion: 1,
          } as ActionElement)
        }
        break
      }

      default: {
        if (text) {
          elements.push({
            id: generateId(),
            type: 'action',
            text,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp(),
            schemaVersion: 1,
          } as ActionElement)
        }
        break
      }
    }

    if (isPageBreak && text !== '') {
      elements.push({
        id: generateId(),
        type: 'page-break',
        forced: true,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        schemaVersion: 1,
      } as PageBreakElement)
    }
  }

  const document: ScreenplayDocument = {
    id: generateId(),
    projectId: generateId(),
    draftId: generateId(),
    metadata: {
      title,
      author,
      contact,
      draftDate,
    },
    elements,
    schemaVersion: 1,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
  }

  return {
    success: true,
    document,
    warnings,
    errors: [],
  }
}

// ============================================================================
// Element Parsers
// ============================================================================

function parseSceneHeading(raw: string, sceneNumber?: number): SceneHeadingElement {
  let text = raw.trim()

  let interior: 'INT' | 'EXT' | 'INT/EXT' = 'INT'
  if (/^EXT\b/i.test(text)) {
    interior = 'EXT'
  } else if (/^(INT\/EXT|INT\.\/EXT|I\/E)\b/i.test(text)) {
    interior = 'INT/EXT'
  }

  // Strip prefix
  const prefixStripped = text.replace(/^(INT|EXT|INT\/EXT|INT\.\/EXT|I\/E)\.?\s+/i, '').trim()

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

function parseCharacter(raw: string, _isDual = false): CharacterElement {
  let name = raw.trim()
  let extension: string | undefined

  const extMatch = name.match(/\s*\(([^)]+)\)$/)
  if (extMatch) {
    extension = extMatch[1].trim()
    name = name.slice(0, extMatch.index).trim()
  }

  return {
    id: generateId(),
    type: 'character',
    name: name.toUpperCase(),
    extension,
    characterId: generateId(),
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
    schemaVersion: 1,
  }
}
