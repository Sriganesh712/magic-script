/**
 * Screenplay HTML ↔ Semantic Element Converter
 * Implements EXP-007 HTML conversion specifications.
 * 
 * Bridges Tiptap/ProseMirror DOM output with internal ScreenplayElement model:
 * - htmlToElements: converts editor HTML into typed ScreenplayElement array
 * - elementsToHtml: converts typed elements into Tiptap-compatible HTML markup
 * - Preserves all metadata, element types, and semantic attributes
 */

import type {
  EntityId,
  Timestamp,
  ScreenplayElement,
  SceneHeadingElement,
  ActionElement,
  CharacterElement,
  DialogueElement,
  ParentheticalElement,
  TransitionElement,
  ShotElement,
  SectionElement,
  PageBreakElement,
  DualDialogueStartElement,
  DualDialogueEndElement,
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
// Helper Functions
// ============================================================================

function generateId(): EntityId {
  return `id_${Date.now()}_${Math.random().toString(36).substring(2, 11)}` as EntityId
}

function getTimestamp(): Timestamp {
  return Date.now() as Timestamp
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function unescapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// ============================================================================
// Elements to HTML
// ============================================================================

/**
 * Converts an array of ScreenplayElement objects into Tiptap-compatible HTML.
 * 
 * @param elements Array of ScreenplayElements
 * @returns HTML string matching ScreenplayNodes schema
 */
export function elementsToHtml(elements: ScreenplayElement[]): string {
  const htmlParts: string[] = []

  for (const el of elements) {
    if (isSceneHeading(el)) {
      const loc = el.location ? el.location.toUpperCase() : ''
      const time = el.timeOfDay ? ` - ${el.timeOfDay.toUpperCase()}` : ''
      const text = `${el.interior}. ${loc}${time}`.trim()
      const sceneNumAttr = el.sceneNumber != null ? ` data-scene-number="${el.sceneNumber}"` : ''

      htmlParts.push(
        `<p class="screenplay-element" data-type="scene-heading" data-interior="${escapeHtml(el.interior)}" data-location="${escapeHtml(el.location)}" data-time-of-day="${escapeHtml(el.timeOfDay)}"${sceneNumAttr} data-id="${el.id}">${escapeHtml(text)}</p>`
      )
      continue
    }

    if (isAction(el)) {
      htmlParts.push(
        `<p class="screenplay-element" data-type="action" data-id="${el.id}">${escapeHtml(el.text)}</p>`
      )
      continue
    }

    if (isCharacter(el)) {
      let charName = el.name.toUpperCase()
      const extAttr = el.extension ? ` data-extension="${escapeHtml(el.extension)}"` : ''
      const charIdAttr = el.characterId ? ` data-character-id="${el.characterId}"` : ''
      if (el.extension) {
        charName += ` (${el.extension.toUpperCase()})`
      }

      htmlParts.push(
        `<p class="screenplay-element" data-type="character" data-name="${escapeHtml(el.name)}"${extAttr}${charIdAttr} data-id="${el.id}">${escapeHtml(charName)}</p>`
      )
      continue
    }

    if (isDialogue(el)) {
      const charIdAttr = el.characterId ? ` data-character-id="${el.characterId}"` : ''
      const dualAttr = el.isDual ? ` data-is-dual="true"` : ''
      const pairAttr = el.dualPairId ? ` data-dual-pair-id="${el.dualPairId}"` : ''

      htmlParts.push(
        `<p class="screenplay-element" data-type="dialogue"${charIdAttr}${dualAttr}${pairAttr} data-id="${el.id}">${escapeHtml(el.text)}</p>`
      )
      continue
    }

    if (isParenthetical(el)) {
      let pText = el.text.trim()
      if (!pText.startsWith('(') || !pText.endsWith(')')) {
        pText = `(${pText})`
      }
      const charIdAttr = el.characterId ? ` data-character-id="${el.characterId}"` : ''

      htmlParts.push(
        `<p class="screenplay-element" data-type="parenthetical"${charIdAttr} data-id="${el.id}">${escapeHtml(pText)}</p>`
      )
      continue
    }

    if (isTransition(el)) {
      const typeAttr = el.transitionType ? ` data-transition-type="${escapeHtml(el.transitionType)}"` : ''
      htmlParts.push(
        `<p class="screenplay-element" data-type="transition"${typeAttr} data-id="${el.id}">${escapeHtml(el.text)}</p>`
      )
      continue
    }

    if (isShot(el)) {
      const typeAttr = el.shotType ? ` data-shot-type="${escapeHtml(el.shotType)}"` : ''
      htmlParts.push(
        `<p class="screenplay-element" data-type="shot"${typeAttr} data-id="${el.id}">${escapeHtml(el.text)}</p>`
      )
      continue
    }

    if (isSection(el)) {
      htmlParts.push(
        `<p class="screenplay-element" data-type="section" data-level="${el.level || 1}" data-id="${el.id}">${escapeHtml(el.title)}</p>`
      )
      continue
    }

    if (isPageBreak(el)) {
      htmlParts.push(
        `<hr class="screenplay-element" data-type="page-break" data-forced="${el.forced !== false}" data-id="${el.id}" />`
      )
      continue
    }

    if (isDualDialogueStart(el)) {
      htmlParts.push(
        `<div class="screenplay-element" data-type="dual-dialogue-start" data-left-character-id="${el.leftCharacterId}" data-right-character-id="${el.rightCharacterId}" data-id="${el.id}"></div>`
      )
      continue
    }

    if (isDualDialogueEnd(el)) {
      htmlParts.push(
        `<div class="screenplay-element" data-type="dual-dialogue-end" data-id="${el.id}"></div>`
      )
      continue
    }
  }

  return htmlParts.join('\n')
}

// ============================================================================
// HTML to Elements
// ============================================================================

/**
 * Parses Tiptap editor HTML markup into an array of typed ScreenplayElement objects.
 * 
 * @param html HTML string from editor or external source
 * @returns Array of typed ScreenplayElements
 */
export function htmlToElements(html: string): ScreenplayElement[] {
  if (!html || html.trim().length === 0) {
    return []
  }

  if (typeof DOMParser !== 'undefined') {
    return parseHtmlWithDOM(html)
  }

  return parseHtmlWithRegex(html)
}

function parseHtmlWithDOM(html: string): ScreenplayElement[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild || doc.body
  const elements: ScreenplayElement[] = []
  let lastCharacterId: EntityId = generateId()

  const children = Array.from(container.children)

  for (const el of children) {
    const rawType = el.getAttribute('data-type')
    const tag = el.tagName.toLowerCase()
    const text = (el.textContent || '').trim()
    const elementId = (el.getAttribute('data-id') || el.id || generateId()) as EntityId
    const now = getTimestamp()

    // Determine type: from data-type attribute, or inferred from tag / text
    let type = rawType
    if (!type) {
      if (tag === 'hr') {
        type = 'page-break'
      } else if (text.startsWith('INT.') || text.startsWith('EXT.') || text.startsWith('INT/EXT')) {
        type = 'scene-heading'
      } else if (text.endsWith('TO:') && text.length < 35) {
        type = 'transition'
      } else if (text.startsWith('(') && text.endsWith(')')) {
        type = 'parenthetical'
      } else if (isAllUpper(text) && text.length < 35 && !text.includes('.')) {
        type = 'character'
      } else {
        type = 'action'
      }
    }

    switch (type) {
      case 'scene-heading': {
        const intAttr = el.getAttribute('data-interior') as any
        const locAttr = el.getAttribute('data-location')
        const timeAttr = el.getAttribute('data-time-of-day')
        const sceneNumAttr = el.getAttribute('data-scene-number')

        let interior = intAttr || 'INT'
        let location = locAttr || ''
        let timeOfDay = timeAttr || ''

        // Fallback: parse from text if attributes are missing
        if (!locAttr) {
          const parsed = parseSceneHeadingText(text)
          interior = parsed.interior
          location = parsed.location
          timeOfDay = parsed.timeOfDay
        }

        const sceneNumber = sceneNumAttr ? parseInt(sceneNumAttr, 10) : undefined

        elements.push({
          id: elementId,
          type: 'scene-heading',
          interior,
          location: location.toUpperCase(),
          timeOfDay: timeOfDay.toUpperCase(),
          sceneNumber: isNaN(sceneNumber as any) ? undefined : sceneNumber,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as SceneHeadingElement)
        break
      }

      case 'character': {
        const nameAttr = el.getAttribute('data-name')
        const extAttr = el.getAttribute('data-extension')
        const charIdAttr = el.getAttribute('data-character-id') as EntityId | null

        let name = nameAttr || text
        let extension = extAttr || undefined

        if (!extAttr && name.includes('(')) {
          const extMatch = name.match(/\(([^)]+)\)/)
          if (extMatch) {
            extension = extMatch[1].trim()
            name = name.replace(/\([^)]+\)/, '').trim()
          }
        }

        const charId = charIdAttr || generateId()
        lastCharacterId = charId

        elements.push({
          id: elementId,
          type: 'character',
          name: name.toUpperCase(),
          extension,
          characterId: charId,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as CharacterElement)
        break
      }

      case 'dialogue': {
        const charIdAttr = (el.getAttribute('data-character-id') || lastCharacterId) as EntityId
        const isDualAttr = el.getAttribute('data-is-dual') === 'true'
        const pairIdAttr = el.getAttribute('data-dual-pair-id') as EntityId | null

        elements.push({
          id: elementId,
          type: 'dialogue',
          text,
          characterId: charIdAttr,
          isDual: isDualAttr,
          dualPairId: pairIdAttr || undefined,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as DialogueElement)
        break
      }

      case 'parenthetical': {
        const charIdAttr = (el.getAttribute('data-character-id') || lastCharacterId) as EntityId
        let pText = text
        if (pText.startsWith('(') && pText.endsWith(')')) {
          pText = pText.slice(1, -1).trim()
        }

        elements.push({
          id: elementId,
          type: 'parenthetical',
          text: pText,
          characterId: charIdAttr,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as ParentheticalElement)
        break
      }

      case 'transition': {
        const transType = (el.getAttribute('data-transition-type') || 'CUSTOM') as any
        elements.push({
          id: elementId,
          type: 'transition',
          text,
          transitionType: transType,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as TransitionElement)
        break
      }

      case 'shot': {
        const shotType = (el.getAttribute('data-shot-type') || 'CUSTOM') as any
        elements.push({
          id: elementId,
          type: 'shot',
          text,
          shotType,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as ShotElement)
        break
      }

      case 'section': {
        const levelAttr = el.getAttribute('data-level')
        const level = levelAttr ? parseInt(levelAttr, 10) : 1
        elements.push({
          id: elementId,
          type: 'section',
          title: text,
          level: isNaN(level) ? 1 : level,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as SectionElement)
        break
      }

      case 'page-break': {
        const forced = el.getAttribute('data-forced') !== 'false'
        elements.push({
          id: elementId,
          type: 'page-break',
          forced,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as PageBreakElement)
        break
      }

      case 'dual-dialogue-start': {
        const leftId = (el.getAttribute('data-left-character-id') || generateId()) as EntityId
        const rightId = (el.getAttribute('data-right-character-id') || generateId()) as EntityId
        elements.push({
          id: elementId,
          type: 'dual-dialogue-start',
          leftCharacterId: leftId,
          rightCharacterId: rightId,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as DualDialogueStartElement)
        break
      }

      case 'dual-dialogue-end': {
        elements.push({
          id: elementId,
          type: 'dual-dialogue-end',
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as DualDialogueEndElement)
        break
      }

      case 'action':
      default: {
        elements.push({
          id: elementId,
          type: 'action',
          text,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as ActionElement)
        break
      }
    }
  }

  return elements
}

function parseHtmlWithRegex(html: string): ScreenplayElement[] {
  const elements: ScreenplayElement[] = []
  const tagRegex = /<(p|hr|div)([^>]*)>(?:([\s\S]*?)<\/\1>)?/gi
  let lastCharacterId: EntityId = generateId()
  const now = getTimestamp()

  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const attrs = match[2]
    const content = match[3] || ''
    const text = unescapeHtml(content.replace(/<[^>]*>/g, '').trim())

    const typeMatch = attrs.match(/data-type="([^"]+)"/)
    let type = typeMatch ? typeMatch[1] : ''
    const idMatch = attrs.match(/data-id="([^"]+)"/) || attrs.match(/id="([^"]+)"/)
    const elementId = (idMatch ? idMatch[1] : generateId()) as EntityId

    if (!type) {
      if (tag === 'hr') type = 'page-break'
      else if (/^INT\.|^EXT\.|^INT\/EXT/i.test(text)) type = 'scene-heading'
      else if (text.endsWith('TO:') && text.length < 35) type = 'transition'
      else if (text.startsWith('(') && text.endsWith(')')) type = 'parenthetical'
      else if (isAllUpper(text) && text.length < 35 && !text.includes('.')) type = 'character'
      else type = 'action'
    }

    switch (type) {
      case 'scene-heading': {
        const intMatch = attrs.match(/data-interior="([^"]+)"/)
        const locMatch = attrs.match(/data-location="([^"]+)"/)
        const timeMatch = attrs.match(/data-time-of-day="([^"]+)"/)
        const numMatch = attrs.match(/data-scene-number="([^"]+)"/)

        let interior = (intMatch ? intMatch[1] : 'INT') as any
        let location = locMatch ? locMatch[1] : ''
        let timeOfDay = timeMatch ? timeMatch[1] : ''

        if (!location) {
          const parsed = parseSceneHeadingText(text)
          interior = parsed.interior
          location = parsed.location
          timeOfDay = parsed.timeOfDay
        }

        elements.push({
          id: elementId,
          type: 'scene-heading',
          interior,
          location: location.toUpperCase(),
          timeOfDay: timeOfDay.toUpperCase(),
          sceneNumber: numMatch ? parseInt(numMatch[1], 10) : undefined,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as SceneHeadingElement)
        break
      }

      case 'character': {
        const nameMatch = attrs.match(/data-name="([^"]+)"/)
        const extMatch = attrs.match(/data-extension="([^"]+)"/)
        const charIdMatch = attrs.match(/data-character-id="([^"]+)"/)

        let name = nameMatch ? nameMatch[1] : text
        let extension = extMatch ? extMatch[1] : undefined

        if (!extension && name.includes('(')) {
          const m = name.match(/\(([^)]+)\)/)
          if (m) {
            extension = m[1].trim()
            name = name.replace(/\([^)]+\)/, '').trim()
          }
        }

        const charId = (charIdMatch ? charIdMatch[1] : generateId()) as EntityId
        lastCharacterId = charId

        elements.push({
          id: elementId,
          type: 'character',
          name: name.toUpperCase(),
          extension,
          characterId: charId,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as CharacterElement)
        break
      }

      case 'dialogue': {
        const charIdMatch = attrs.match(/data-character-id="([^"]+)"/)
        const isDualMatch = /data-is-dual="true"/.test(attrs)

        elements.push({
          id: elementId,
          type: 'dialogue',
          text,
          characterId: (charIdMatch ? charIdMatch[1] : lastCharacterId) as EntityId,
          isDual: isDualMatch,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as DialogueElement)
        break
      }

      case 'parenthetical': {
        let pText = text
        if (pText.startsWith('(') && pText.endsWith(')')) {
          pText = pText.slice(1, -1).trim()
        }
        elements.push({
          id: elementId,
          type: 'parenthetical',
          text: pText,
          characterId: lastCharacterId,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as ParentheticalElement)
        break
      }

      case 'transition': {
        elements.push({
          id: elementId,
          type: 'transition',
          text,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as TransitionElement)
        break
      }

      case 'shot': {
        elements.push({
          id: elementId,
          type: 'shot',
          text,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as ShotElement)
        break
      }

      case 'section': {
        const lvlMatch = attrs.match(/data-level="([^"]+)"/)
        elements.push({
          id: elementId,
          type: 'section',
          title: text,
          level: lvlMatch ? parseInt(lvlMatch[1], 10) : 1,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as SectionElement)
        break
      }

      case 'page-break': {
        elements.push({
          id: elementId,
          type: 'page-break',
          forced: true,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as PageBreakElement)
        break
      }

      case 'action':
      default: {
        elements.push({
          id: elementId,
          type: 'action',
          text,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        } as ActionElement)
        break
      }
    }
  }

  return elements
}

function parseSceneHeadingText(text: string) {
  let interior: 'INT' | 'EXT' | 'INT/EXT' = 'INT'
  if (/^EXT\b/i.test(text)) {
    interior = 'EXT'
  } else if (/^(INT\/EXT|INT\.\/EXT|I\/E)\b/i.test(text)) {
    interior = 'INT/EXT'
  }

  const prefixStripped = text.replace(/^(INT|EXT|INT\/EXT|INT\.\/EXT|I\/E|EST)\.?\s+/i, '').trim()
  let location = prefixStripped
  let timeOfDay = ''

  const dashIdx = prefixStripped.lastIndexOf(' - ')
  if (dashIdx !== -1) {
    location = prefixStripped.slice(0, dashIdx).trim()
    timeOfDay = prefixStripped.slice(dashIdx + 3).trim()
  }

  return { interior, location, timeOfDay }
}

function isAllUpper(str: string): boolean {
  const letters = str.replace(/[^a-zA-Z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase()
}
