/**
 * Production Extraction Engine (REV-001, REV-002, REV-003)
 * Automatically extracts Characters, Locations, and Scene Cards from screenplay elements.
 * Preserves user annotations while updating counts and cross-references.
 */

import type {
  EntityId,
  Timestamp,
  ScreenplayElement,
  Character,
  Location,
  SceneCard,
  SceneHeadingElement,
} from '@/types'
import { isSceneHeading, isCharacter, isDialogue } from '@/types'
import { db, generateId } from '@/lib/db'

// ============================================================================
// Character Extraction
// ============================================================================

export interface ExtractedCharacterData {
  name: string
  dialogueCount: number
  sceneCount: number
  firstAppearance?: EntityId
  lastAppearance?: EntityId
  scenes: Set<EntityId>
}

/**
 * Extracts character profiles, dialogue frequencies, and scene appearances from screenplay elements.
 */
export function extractCharactersFromElements(
  elements: ScreenplayElement[],
  projectId: EntityId,
  existingCharacters: Character[] = []
): Character[] {
  const charMap = new Map<string, ExtractedCharacterData>()
  const existingMap = new Map<string, Character>(
    existingCharacters.map((c) => [c.name.trim().toUpperCase(), c])
  )

  let currentSceneId: EntityId | undefined = undefined

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]

    if (isSceneHeading(el)) {
      currentSceneId = el.id
      continue
    }

    if (isCharacter(el)) {
      const normalizedName = el.name.trim().toUpperCase()
      if (!normalizedName) continue

      if (!charMap.has(normalizedName)) {
        charMap.set(normalizedName, {
          name: normalizedName,
          dialogueCount: 0,
          sceneCount: 0,
          firstAppearance: currentSceneId,
          lastAppearance: currentSceneId,
          scenes: new Set<EntityId>(),
        })
      }

      const data = charMap.get(normalizedName)!
      if (currentSceneId) {
        data.scenes.add(currentSceneId)
        data.lastAppearance = currentSceneId
      }

      // Parentheticals may appear between a character cue and its dialogue.
      let nextIndex = i + 1
      while (nextIndex < elements.length && elements[nextIndex].type === 'parenthetical') {
        nextIndex++
      }
      if (nextIndex < elements.length && isDialogue(elements[nextIndex])) {
        data.dialogueCount++
      }
    }
  }

  const result: Character[] = []
  const now = Date.now() as Timestamp

  for (const [name, data] of charMap.entries()) {
    const existing = existingMap.get(name)

    if (existing) {
      result.push({
        ...existing,
        dialogueCount: data.dialogueCount,
        sceneCount: data.scenes.size,
        firstAppearance: existing.firstAppearance || data.firstAppearance,
        lastAppearance: data.lastAppearance || existing.lastAppearance,
        updatedAt: now,
      })
    } else {
      result.push({
        id: generateId(),
        projectId,
        name,
        description: '',
        arcs: [],
        dialogueCount: data.dialogueCount,
        sceneCount: data.scenes.size,
        firstAppearance: data.firstAppearance,
        lastAppearance: data.lastAppearance,
        color: getRandomCharacterColor(name),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Preserve any manually created characters that may not currently have dialogue in the draft
  for (const [name, existing] of existingMap.entries()) {
    if (!charMap.has(name)) {
      result.push({
        ...existing,
        dialogueCount: 0,
        sceneCount: 0,
      })
    }
  }

  return result.sort((a, b) => b.dialogueCount - a.dialogueCount || a.name.localeCompare(b.name))
}

// ============================================================================
// Location Extraction
// ============================================================================

export interface ExtractedLocationData {
  name: string
  type: 'INT' | 'EXT' | 'INT/EXT'
  sceneIds: EntityId[]
}

/**
 * Extracts unique locations and scene associations from scene heading elements.
 */
export function extractLocationsFromElements(
  elements: ScreenplayElement[],
  projectId: EntityId,
  existingLocations: Location[] = []
): Location[] {
  const locMap = new Map<string, ExtractedLocationData>()
  const existingMap = new Map<string, Location>(
    existingLocations.map((loc) => [loc.name.trim().toUpperCase(), loc])
  )

  for (const el of elements) {
    if (isSceneHeading(el)) {
      const heading = el as SceneHeadingElement
      const rawLocation = heading.location?.trim().toUpperCase() || 'UNKNOWN LOCATION'
      let type: 'INT' | 'EXT' | 'INT/EXT' = 'INT'

      const interiorUpper = heading.interior?.trim().toUpperCase() || ''
      if (interiorUpper.includes('EXT') && interiorUpper.includes('INT')) {
        type = 'INT/EXT'
      } else if (interiorUpper.startsWith('EXT')) {
        type = 'EXT'
      } else {
        type = 'INT'
      }

      if (!locMap.has(rawLocation)) {
        locMap.set(rawLocation, {
          name: rawLocation,
          type,
          sceneIds: [],
        })
      }

      const data = locMap.get(rawLocation)!
      data.sceneIds.push(heading.id)
    }
  }

  const result: Location[] = []
  const now = Date.now() as Timestamp

  for (const [name, data] of locMap.entries()) {
    const existing = existingMap.get(name)

    if (existing) {
      result.push({
        ...existing,
        type: data.type,
        sceneIds: data.sceneIds,
        updatedAt: now,
      })
    } else {
      result.push({
        id: generateId(),
        projectId,
        name,
        type: data.type,
        description: '',
        sceneIds: data.sceneIds,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Preserve any manually created locations
  for (const [name, existing] of existingMap.entries()) {
    if (!locMap.has(name)) {
      result.push({
        ...existing,
        sceneIds: [],
      })
    }
  }

  return result.sort((a, b) => b.sceneIds.length - a.sceneIds.length || a.name.localeCompare(b.name))
}

// ============================================================================
// Scene Card Extraction & Bidirectional Sync
// ============================================================================

/**
 * Extracts and updates scene cards from screenplay elements, tracking characters present in each scene.
 */
export function extractSceneCardsFromElements(
  elements: ScreenplayElement[],
  projectId: EntityId,
  screenplayId: EntityId,
  existingCards: SceneCard[] = [],
  characters: Character[] = []
): SceneCard[] {
  const existingMap = new Map<EntityId, SceneCard>(
    existingCards.map((c) => [c.elementId, c])
  )
  const charNameToId = new Map<string, EntityId>(
    characters.map((c) => [c.name.trim().toUpperCase(), c.id])
  )

  const cards: SceneCard[] = []
  let currentCard: SceneCard | null = null
  let currentChars = new Set<EntityId>()
  let order = 0
  const now = Date.now() as Timestamp

  for (const el of elements) {
    if (isSceneHeading(el)) {
      // Finalize previous card if active
      if (currentCard) {
        currentCard.characters = Array.from(currentChars)
        cards.push(currentCard)
      }

      const heading = el as SceneHeadingElement
      const existing = existingMap.get(heading.id)
      const locStr = `${heading.interior || 'INT'}. ${heading.location || 'UNKNOWN LOCATION'}`

      currentCard = {
        id: existing?.id || generateId(),
        projectId,
        screenplayId,
        elementId: heading.id,
        order: order++,
        summary: existing?.summary || '',
        location: locStr,
        timeOfDay: heading.timeOfDay || 'DAY',
        characters: [],
        notes: existing?.notes || '',
        color: existing?.color || undefined,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }

      currentChars = new Set<EntityId>()
    } else if (isCharacter(el) && currentCard) {
      const name = el.name.trim().toUpperCase()
      const charId = charNameToId.get(name)
      if (charId) {
        currentChars.add(charId)
      }
    }
  }

  // Finalize last scene card
  if (currentCard) {
    currentCard.characters = Array.from(currentChars)
    cards.push(currentCard)
  }

  return cards
}

// ============================================================================
// IndexedDB Synchronizer
// ============================================================================

/**
 * Automatically synchronizes characters, locations, and scene cards with IndexedDB.
 */
export async function syncScriptWithProductionDB(
  elements: ScreenplayElement[],
  projectId: EntityId,
  screenplayId: EntityId
): Promise<{
  characters: Character[]
  locations: Location[]
  sceneCards: SceneCard[]
}> {
  // Fetch existing entities
  const [existingChars, existingLocs, existingCards] = await Promise.all([
    db.characters.where('projectId').equals(projectId).toArray(),
    db.locations.where('projectId').equals(projectId).toArray(),
    db.sceneCards.where('screenplayId').equals(screenplayId).sortBy('order'),
  ])

  // Extract updated entities
  const characters = extractCharactersFromElements(elements, projectId, existingChars)
  const locations = extractLocationsFromElements(elements, projectId, existingLocs)
  const sceneCards = extractSceneCardsFromElements(
    elements,
    projectId,
    screenplayId,
    existingCards,
    characters
  )

  // Atomic database persist
  await db.transaction('rw', [db.characters, db.locations, db.sceneCards], async () => {
    // Put all characters
    if (characters.length > 0) {
      await db.characters.bulkPut(characters)
    }

    // Put all locations
    if (locations.length > 0) {
      await db.locations.bulkPut(locations)
    }

    // Replace scene cards for this screenplay
    await db.sceneCards.where('screenplayId').equals(screenplayId).delete()
    if (sceneCards.length > 0) {
      await db.sceneCards.bulkAdd(sceneCards)
    }
  })

  return { characters, locations, sceneCards }
}

// ============================================================================
// Helpers
// ============================================================================

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
]

function getRandomCharacterColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % PALETTE.length
  return PALETTE[index]
}
