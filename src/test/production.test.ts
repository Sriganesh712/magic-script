import { describe, it, expect } from 'vitest'
import {
  extractCharactersFromElements,
  extractLocationsFromElements,
  extractSceneCardsFromElements,
  diffRevisionDocuments,
  filterNotes,
} from '@/lib/production'
import type {
  EntityId,
  Timestamp,
  ScreenplayElement,
  Character,
  Location,
  SceneCard,
  Note,
  ScreenplayDocument,
} from '@/types'

describe('Production Engine (REV-001, REV-002, REV-003, REV-004, REV-005)', () => {
  const dummyProjectId = 'proj_test_1' as EntityId
  const dummyDraftId = 'draft_test_1' as EntityId
  const dummyDocId = 'doc_test_1' as EntityId
  const dummyTime = 1700000000000 as Timestamp

  const sampleElements: ScreenplayElement[] = [
    {
      id: 'sh_1' as EntityId,
      type: 'scene-heading',
      interior: 'INT',
      location: 'COFFEE SHOP',
      timeOfDay: 'DAY',
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'act_1' as EntityId,
      type: 'action',
      text: 'Rain lashes against the cafe window. Maya sips an espresso.',
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'char_1' as EntityId,
      type: 'character',
      name: 'MAYA',
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'dia_1' as EntityId,
      type: 'dialogue',
      text: 'Did you bring the files?',
      characterId: 'char_1' as EntityId,
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'char_2' as EntityId,
      type: 'character',
      name: 'LEO',
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'dia_2' as EntityId,
      type: 'dialogue',
      text: 'Always.',
      characterId: 'char_2' as EntityId,
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'sh_2' as EntityId,
      type: 'scene-heading',
      interior: 'EXT',
      location: 'ALLEYWAY',
      timeOfDay: 'NIGHT',
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'char_3' as EntityId,
      type: 'character',
      name: 'MAYA',
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
    {
      id: 'dia_3' as EntityId,
      type: 'dialogue',
      text: 'Someone is following us.',
      characterId: 'char_3' as EntityId,
      createdAt: dummyTime,
      updatedAt: dummyTime,
      schemaVersion: 1,
    },
  ]

  describe('Character Extraction (REV-002)', () => {
    it('extracts characters and calculates dialogue and scene frequencies', () => {
      const chars = extractCharactersFromElements(sampleElements, dummyProjectId)
      expect(chars).toHaveLength(2)

      const maya = chars.find((c) => c.name === 'MAYA')
      const leo = chars.find((c) => c.name === 'LEO')

      expect(maya).toBeDefined()
      expect(maya?.dialogueCount).toBe(2)
      expect(maya?.sceneCount).toBe(2)
      expect(maya?.firstAppearance).toBe('sh_1')
      expect(maya?.lastAppearance).toBe('sh_2')

      expect(leo).toBeDefined()
      expect(leo?.dialogueCount).toBe(1)
      expect(leo?.sceneCount).toBe(1)
      expect(leo?.firstAppearance).toBe('sh_1')
      expect(leo?.lastAppearance).toBe('sh_1')
    })

    it('preserves existing character profile metadata such as description and arcs', () => {
      const existing: Character[] = [
        {
          id: 'char_existing_1' as EntityId,
          projectId: dummyProjectId,
          name: 'MAYA',
          description: 'A cybersecurity operative on the run.',
          arcs: ['Trusts no one', 'Learns to trust Leo'],
          dialogueCount: 0,
          sceneCount: 0,
          color: '#3b82f6',
          createdAt: dummyTime,
          updatedAt: dummyTime,
        },
      ]

      const chars = extractCharactersFromElements(sampleElements, dummyProjectId, existing)
      const maya = chars.find((c) => c.name === 'MAYA')

      expect(maya?.id).toBe('char_existing_1')
      expect(maya?.description).toBe('A cybersecurity operative on the run.')
      expect(maya?.arcs).toEqual(['Trusts no one', 'Learns to trust Leo'])
      expect(maya?.dialogueCount).toBe(2)
    })
  })

  describe('Location Extraction (REV-003)', () => {
    it('extracts unique locations with INT/EXT classification', () => {
      const locs = extractLocationsFromElements(sampleElements, dummyProjectId)
      expect(locs).toHaveLength(2)

      const coffeeShop = locs.find((l) => l.name === 'COFFEE SHOP')
      const alleyway = locs.find((l) => l.name === 'ALLEYWAY')

      expect(coffeeShop).toBeDefined()
      expect(coffeeShop?.type).toBe('INT')
      expect(coffeeShop?.sceneIds).toEqual(['sh_1'])

      expect(alleyway).toBeDefined()
      expect(alleyway?.type).toBe('EXT')
      expect(alleyway?.sceneIds).toEqual(['sh_2'])
    })

    it('correctly classifies INT/EXT hybrid locations', () => {
      const hybridElements: ScreenplayElement[] = [
        {
          id: 'sh_hybrid' as EntityId,
          type: 'scene-heading',
          interior: 'INT/EXT',
          location: 'GETAWAY CAR',
          timeOfDay: 'DAY',
          createdAt: dummyTime,
          updatedAt: dummyTime,
          schemaVersion: 1,
        },
      ]

      const locs = extractLocationsFromElements(hybridElements, dummyProjectId)
      expect(locs[0].type).toBe('INT/EXT')
      expect(locs[0].name).toBe('GETAWAY CAR')
    })
  })

  describe('Scene Card Extraction (REV-001)', () => {
    it('creates ordered scene cards and tracks characters in each scene', () => {
      const chars = extractCharactersFromElements(sampleElements, dummyProjectId)
      const cards = extractSceneCardsFromElements(
        sampleElements,
        dummyProjectId,
        dummyDocId,
        [],
        chars
      )

      expect(cards).toHaveLength(2)
      expect(cards[0].order).toBe(0)
      expect(cards[0].elementId).toBe('sh_1')
      expect(cards[0].location).toBe('INT. COFFEE SHOP')
      expect(cards[0].timeOfDay).toBe('DAY')

      expect(cards[1].order).toBe(1)
      expect(cards[1].elementId).toBe('sh_2')
      expect(cards[1].location).toBe('EXT. ALLEYWAY')
      expect(cards[1].timeOfDay).toBe('NIGHT')

      // Characters in Scene 1 (Maya & Leo)
      expect(cards[0].characters.length).toBe(2)
      // Characters in Scene 2 (Maya only)
      expect(cards[1].characters.length).toBe(1)
    })

    it('preserves existing card user annotations (summary, notes, color)', () => {
      const existingCards: SceneCard[] = [
        {
          id: 'card_custom_1' as EntityId,
          projectId: dummyProjectId,
          screenplayId: dummyDocId,
          elementId: 'sh_1' as EntityId,
          order: 0,
          summary: 'Maya meets Leo to exchange the decryptor drive.',
          notes: 'Ensure tense pacing and low lighting.',
          color: '#ef4444',
          characters: [],
          createdAt: dummyTime,
          updatedAt: dummyTime,
        },
      ]

      const cards = extractSceneCardsFromElements(
        sampleElements,
        dummyProjectId,
        dummyDocId,
        existingCards
      )

      expect(cards[0].id).toBe('card_custom_1')
      expect(cards[0].summary).toBe('Maya meets Leo to exchange the decryptor drive.')
      expect(cards[0].notes).toBe('Ensure tense pacing and low lighting.')
      expect(cards[0].color).toBe('#ef4444')
    })
  })

  describe('Revision Diff Engine (REV-005)', () => {
    it('computes element and word changes between document revisions', () => {
      const docOld: ScreenplayDocument = {
        id: dummyDocId,
        projectId: dummyProjectId,
        draftId: dummyDraftId,
        metadata: { title: 'Spy Thriller' },
        elements: sampleElements,
        schemaVersion: 1,
        createdAt: dummyTime,
        updatedAt: dummyTime,
      }

      // Modified document: replace "Always." with "Always have it ready." and add a new action
      const modifiedElements: ScreenplayElement[] = [
        sampleElements[0],
        sampleElements[1],
        sampleElements[2],
        sampleElements[3],
        sampleElements[4],
        {
          id: 'dia_2' as EntityId,
          type: 'dialogue',
          text: 'Always have it ready.',
          characterId: 'char_2' as EntityId,
          createdAt: dummyTime,
          updatedAt: dummyTime,
          schemaVersion: 1,
        },
        sampleElements[6],
        sampleElements[7],
        sampleElements[8],
        {
          id: 'act_2' as EntityId,
          type: 'action',
          text: 'Footsteps echo in the dark corridor.',
          createdAt: dummyTime,
          updatedAt: dummyTime,
          schemaVersion: 1,
        },
      ]

      const docNew: ScreenplayDocument = {
        ...docOld,
        elements: modifiedElements,
      }

      const diff = diffRevisionDocuments(docOld, docNew)

      expect(diff.stats.wordsAdded).toBeGreaterThan(0)
      expect(diff.stats.elementsChanged).toBeGreaterThan(0)
      expect(diff.items.length).toBeGreaterThan(0)

      const modifiedItem = diff.items.find((item) => item.type === 'modified')
      expect(modifiedItem).toBeDefined()
      expect(modifiedItem?.oldText).toBe('Always.')
      expect(modifiedItem?.newText).toBe('Always have it ready.')

      const addedItem = diff.items.find((item) => item.type === 'added')
      expect(addedItem).toBeDefined()
      expect(addedItem?.newText).toContain('Footsteps echo')
    })
  })

  describe('Notes Engine (REV-004)', () => {
    it('filters notes by search query and note type', () => {
      const notes: Note[] = [
        {
          id: 'note_1' as EntityId,
          projectId: dummyProjectId,
          content: 'Need to research encrypted USB protocols',
          type: 'research',
          createdAt: dummyTime,
          updatedAt: dummyTime,
        },
        {
          id: 'note_2' as EntityId,
          projectId: dummyProjectId,
          content: 'Fix dialogue rhythm in scene 2',
          type: 'todo',
          createdAt: dummyTime,
          updatedAt: dummyTime,
        },
        {
          id: 'note_3' as EntityId,
          projectId: dummyProjectId,
          content: 'Idea: What if Leo is a double agent?',
          type: 'idea',
          createdAt: dummyTime,
          updatedAt: dummyTime,
        },
      ]

      const searchResult = filterNotes(notes, 'research')
      expect(searchResult).toHaveLength(1)
      expect(searchResult[0].id).toBe('note_1')

      const typeFilterResult = filterNotes(notes, '', 'todo')
      expect(typeFilterResult).toHaveLength(1)
      expect(typeFilterResult[0].id).toBe('note_2')

      const allResult = filterNotes(notes, '', 'all')
      expect(allResult).toHaveLength(3)
    })
  })
})
