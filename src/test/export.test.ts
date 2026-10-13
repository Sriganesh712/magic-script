/**
 * Test Suite for Screenplay Studio Pagination and Export Engine
 * EXP-001 through EXP-007
 */

import { describe, it, expect } from 'vitest'
import type {
  EntityId,
  Timestamp,
  ScreenplayDocument,
  ScreenplayElement,
  SceneHeadingElement,
  ActionElement,
  CharacterElement,
  DialogueElement,
  ParentheticalElement,
  TransitionElement,
  PageBreakElement,
} from '@/types'
import { DEFAULT_PAGE_FORMAT } from '@/types'
import {
  paginateScreenplay,
  wrapText,
  getLinesPerPage,
  exportToPDF,
  exportToFountain,
  importFountain,
  exportToFDX,
  importFDX,
  htmlToElements,
  elementsToHtml,
} from '@/lib/export'

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestDocument(elements: ScreenplayElement[] = []): ScreenplayDocument {
  const now = Date.now() as Timestamp
  return {
    id: 'doc_1' as EntityId,
    projectId: 'proj_1' as EntityId,
    draftId: 'draft_1' as EntityId,
    metadata: {
      title: 'The Great Screenplay',
      author: 'Jane Doe',
      contact: 'jane@example.com',
      draftDate: 'October 13, 2026',
    },
    elements,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  }
}

function makeSceneHeading(location: string, timeOfDay = 'DAY', interior: 'INT' | 'EXT' = 'INT', sceneNumber?: number): SceneHeadingElement {
  const now = Date.now() as Timestamp
  return {
    id: `scene_${Math.random()}` as EntityId,
    type: 'scene-heading',
    interior,
    location,
    timeOfDay,
    sceneNumber,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

function makeAction(text: string): ActionElement {
  const now = Date.now() as Timestamp
  return {
    id: `action_${Math.random()}` as EntityId,
    type: 'action',
    text,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

function makeCharacter(name: string, extension?: string): CharacterElement {
  const now = Date.now() as Timestamp
  return {
    id: `char_${Math.random()}` as EntityId,
    type: 'character',
    name,
    extension,
    characterId: `char_id_${name}` as EntityId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

function makeDialogue(text: string, characterId = 'char_1'): DialogueElement {
  const now = Date.now() as Timestamp
  return {
    id: `dial_${Math.random()}` as EntityId,
    type: 'dialogue',
    text,
    characterId: characterId as EntityId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

function makeParenthetical(text: string, characterId = 'char_1'): ParentheticalElement {
  const now = Date.now() as Timestamp
  return {
    id: `paren_${Math.random()}` as EntityId,
    type: 'parenthetical',
    text,
    characterId: characterId as EntityId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

function makeTransition(text: string): TransitionElement {
  const now = Date.now() as Timestamp
  return {
    id: `trans_${Math.random()}` as EntityId,
    type: 'transition',
    text,
    transitionType: 'CUT_TO',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

function makePageBreak(): PageBreakElement {
  const now = Date.now() as Timestamp
  return {
    id: `pb_${Math.random()}` as EntityId,
    type: 'page-break',
    forced: true,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Screenplay Export & Pagination Engine', () => {
  // --------------------------------------------------------------------------
  // 1. Pagination Unit Tests (EXP-001)
  // --------------------------------------------------------------------------
  describe('Pagination Engine (paginateScreenplay)', () => {
    it('1. calculates correct lines per page for US Letter and A4', () => {
      const usLetterLines = getLinesPerPage(DEFAULT_PAGE_FORMAT)
      expect(usLetterLines).toBe(54) // (11.0 - 2.0) * 6 = 54

      const a4Settings = { ...DEFAULT_PAGE_FORMAT, paperSize: 'A4' as const }
      const a4Lines = getLinesPerPage(a4Settings)
      expect(a4Lines).toBe(58) // floor((11.69 - 2.0) * 6) = 58
    })

    it('2. fits a short standard scene on a single page', () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('COFFEE SHOP'),
        makeAction('A quiet morning. Steam rises from espresso cups.'),
        makeCharacter('SARAH'),
        makeDialogue('Where is everyone?'),
      ]

      const pages = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageNumber).toBe(1)
      expect(pages[0].elements).toHaveLength(4)
      expect(pages[0].elements[0].startLine).toBe(1)
    })

    it('3. paginates long scripts across multiple pages', () => {
      const elements: ScreenplayElement[] = []
      // Add 20 action blocks with 3 lines each = ~80 lines total (exceeds 54 lines)
      for (let i = 0; i < 20; i++) {
        elements.push(makeAction(`Action block ${i + 1}. Someone is walking down the hall, looking for a way out.`))
      }

      const pages = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      expect(pages.length).toBeGreaterThan(1)
      expect(pages[0].pageNumber).toBe(1)
      expect(pages[1].pageNumber).toBe(2)
      // Check that lines on page 1 do not exceed 54
      const lastElPage1 = pages[0].elements[pages[0].elements.length - 1]
      expect(lastElPage1.endLine).toBeLessThanOrEqual(54)
    })

    it('4. orphan prevention: moves scene heading at page bottom to next page', () => {
      // Fill page until line 51 (leaving fewer than 4 lines)
      const elements: ScreenplayElement[] = []
      // 51 lines of action
      elements.push(makeAction('Line of action\n'.repeat(51).trim()))
      // Now add a scene heading and an action
      elements.push(makeSceneHeading('WAREHOUSE', 'NIGHT'))
      elements.push(makeAction('Inside the empty warehouse.'))

      const pages = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      expect(pages.length).toBeGreaterThan(1)
      // The scene heading should be moved to page 2 because it cannot sit alone at the bottom
      const page1HasSceneHeading = pages[0].elements.some(e => e.element.type === 'scene-heading')
      const page2HasSceneHeading = pages[1].elements.some(e => e.element.type === 'scene-heading')
      expect(page1HasSceneHeading).toBe(false)
      expect(page2HasSceneHeading).toBe(true)
    })

    it('5. dialogue split: splits dialogue across pages with (MORE) and (CONT\'D)', () => {
      const elements: ScreenplayElement[] = []
      // Fill up to line 48
      elements.push(makeAction('Line of action\n'.repeat(47).trim()))
      // Character cue
      elements.push(makeCharacter('SARAH'))
      // Long dialogue that spans 8 lines
      const longSpeech = 'Line one of the long speech.\nLine two of the speech.\nLine three of the speech.\nLine four of the speech.\nLine five of the speech.\nLine six of the speech.'
      elements.push(makeDialogue(longSpeech))

      const pages = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      expect(pages.length).toBeGreaterThanOrEqual(2)

      // Check for (MORE) on page 1
      const page1Dial = pages[0].elements.find(e => e.element.type === 'dialogue')
      expect(page1Dial).toBeDefined()
      expect(page1Dial?.lines).toContain('(MORE)')

      // Check for SARAH (CONT'D) on page 2
      const page2Char = pages[1].elements.find(e => e.element.type === 'character')
      expect(page2Char).toBeDefined()
      expect(page2Char?.lines?.[0]).toContain('(CONT\'D)')
    })

    it('6. dialogue split avoidance: pushes character to next page if fewer than 2 lines fit', () => {
      const elements: ScreenplayElement[] = []
      // Fill up to line 52 (only 2 lines left: blank line + character, no room for dialogue)
      elements.push(makeAction('Line of action\n'.repeat(51).trim()))
      elements.push(makeCharacter('SARAH'))
      elements.push(makeDialogue('Only two lines here.\nSecond line.'))

      const pages = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      expect(pages.length).toBeGreaterThanOrEqual(2)
      // Character cue should be on page 2, not page 1
      const page1Char = pages[0].elements.find(e => e.element.type === 'character')
      const page2Char = pages[1].elements.find(e => e.element.type === 'character')
      expect(page1Char).toBeUndefined()
      expect(page2Char).toBeDefined()
    })

    it('7. handles explicit page breaks', () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('FIRST ROOM'),
        makeAction('Action before break.'),
        makePageBreak(),
        makeSceneHeading('SECOND ROOM'),
        makeAction('Action after break.'),
      ]

      const pages = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      expect(pages).toHaveLength(2)
      expect(pages[0].elements.some(e => e.element.type === 'scene-heading')).toBe(true)
      expect(pages[1].elements.some(e => e.element.type === 'scene-heading')).toBe(true)
    })

    it('8. determinism: identical inputs always produce identical outputs', () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('ROOFTOP', 'SUNSET'),
        makeAction('The wind howls violently across the ledge.'),
        makeCharacter('MARCUS'),
        makeParenthetical('nervous'),
        makeDialogue('Don\'t look down. Whatever you do, don\'t look down.'),
        makeTransition('SMASH CUT TO:'),
      ]

      const run1 = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)
      const run2 = paginateScreenplay(elements, DEFAULT_PAGE_FORMAT)

      expect(run1).toEqual(run2)
    })

    it('9. wrapText wraps long lines at word boundaries', () => {
      const text = 'The quick brown fox jumps over the lazy dog near the riverbank on a sunny afternoon.'
      const wrapped = wrapText(text, 25)

      expect(wrapped.length).toBeGreaterThan(1)
      for (const line of wrapped) {
        expect(line.length).toBeLessThanOrEqual(25)
      }
      expect(wrapped.join(' ')).toBe(text)
    })
  })

  // --------------------------------------------------------------------------
  // 2. Fountain Export Tests (EXP-003)
  // --------------------------------------------------------------------------
  describe('Fountain Export (exportToFountain)', () => {
    it('10. exports document metadata to valid Fountain title page', () => {
      const doc = createTestDocument()
      const fountain = exportToFountain(doc)

      expect(fountain).toContain('Title: The Great Screenplay')
      expect(fountain).toContain('Author: Jane Doe')
      expect(fountain).toContain('Credit: written by')
      expect(fountain).toContain('Draft date: October 13, 2026')
      expect(fountain).toContain('Contact:')
    })

    it('11. exports standard screenplay elements to Fountain syntax', () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('COFFEE SHOP', 'DAY', 'INT', 1),
        makeAction('The espresso machine hisses.'),
        makeCharacter('SARAH', 'V.O.'),
        makeParenthetical('whispering'),
        makeDialogue('He said he would meet me here.'),
        makeTransition('CUT TO:'),
        makePageBreak(),
      ]
      const doc = createTestDocument(elements)
      const fountain = exportToFountain(doc)

      expect(fountain).toContain('INT. COFFEE SHOP - DAY #1#')
      expect(fountain).toContain('The espresso machine hisses.')
      expect(fountain).toContain('SARAH (V.O.)')
      expect(fountain).toContain('(whispering)')
      expect(fountain).toContain('He said he would meet me here.')
      expect(fountain).toContain('CUT TO:')
      expect(fountain).toContain('===')
    })
  })

  // --------------------------------------------------------------------------
  // 3. Fountain Import Tests (EXP-004)
  // --------------------------------------------------------------------------
  describe('Fountain Import (importFountain)', () => {
    it('12. parses title page metadata from Fountain text', () => {
      const fountainText = `Title: Alien Encounter
Author: Arthur Clarke
Draft date: November 2026

INT. SPACESHIP - NIGHT
The stars drift silently past the porthole.
`
      const result = importFountain(fountainText)
      expect(result.success).toBe(true)
      expect(result.document?.metadata.title).toBe('Alien Encounter')
      expect(result.document?.metadata.author).toBe('Arthur Clarke')
      expect(result.document?.metadata.draftDate).toBe('November 2026')
    })

    it('13. parses scene headings, actions, characters, dialogue, transitions', () => {
      const fountainText = `INT. LAB - DAY #42#

Dr. Aris inspects the microscope.

DR. ARIS (O.S.)
(in awe)
It's mutating.

> FADE OUT.
`
      const result = importFountain(fountainText)
      expect(result.success).toBe(true)
      const elements = result.document?.elements || []

      expect(elements).toHaveLength(6)
      expect(elements[0].type).toBe('scene-heading')
      const scene = elements[0] as SceneHeadingElement
      expect(scene.interior).toBe('INT')
      expect(scene.location).toBe('LAB')
      expect(scene.timeOfDay).toBe('DAY')
      expect(scene.sceneNumber).toBe(42)

      expect(elements[1].type).toBe('action')
      expect(elements[2].type).toBe('character')
      expect((elements[2] as CharacterElement).name).toBe('DR. ARIS')
      expect((elements[2] as CharacterElement).extension).toBe('O.S.')

      expect(elements[3].type).toBe('parenthetical')
      expect((elements[3] as ParentheticalElement).text).toBe('in awe')

      expect(elements[4].type).toBe('dialogue')
      expect((elements[4] as DialogueElement).text).toBe("It's mutating.")

      expect(elements[5].type).toBe('transition')
      expect((elements[5] as TransitionElement).text).toBe('FADE OUT.')
    })

    it('14. handles forced scene headings and forced transitions', () => {
      const fountainText = `.TOP OF THE MOUNTAIN - SUNSET

The view is endless.

> DISSOLVE TO:
`
      const result = importFountain(fountainText)
      expect(result.success).toBe(true)
      const elements = result.document?.elements || []

      expect(elements[0].type).toBe('scene-heading')
      expect((elements[0] as SceneHeadingElement).location).toContain('TOP OF THE MOUNTAIN')

      expect(elements[2].type).toBe('transition')
      expect((elements[2] as TransitionElement).text).toContain('DISSOLVE TO:')
    })

    it('15. round-trip Fountain export and import', () => {
      const originalElements: ScreenplayElement[] = [
        makeSceneHeading('POLICE STATION', 'NIGHT', 'INT'),
        makeAction('Detectives pore over case files in the dim room.'),
        makeCharacter('DETECTIVE MILLER'),
        makeParenthetical('rubbing eyes'),
        makeDialogue('We are running out of time.'),
        makeTransition('CUT TO:'),
      ]
      const originalDoc = createTestDocument(originalElements)

      const exported = exportToFountain(originalDoc)
      const importedResult = importFountain(exported)

      expect(importedResult.success).toBe(true)
      const importedElements = importedResult.document?.elements || []

      expect(importedElements).toHaveLength(originalElements.length)
      expect(importedElements[0].type).toBe('scene-heading')
      expect((importedElements[0] as SceneHeadingElement).location).toBe('POLICE STATION')
      expect(importedElements[1].type).toBe('action')
      expect((importedElements[1] as ActionElement).text).toBe('Detectives pore over case files in the dim room.')
      expect(importedElements[2].type).toBe('character')
      expect((importedElements[2] as CharacterElement).name).toBe('DETECTIVE MILLER')
      expect(importedElements[3].type).toBe('parenthetical')
      expect(importedElements[4].type).toBe('dialogue')
      expect((importedElements[4] as DialogueElement).text).toBe('We are running out of time.')
    })
  })

  // --------------------------------------------------------------------------
  // 4. Final Draft XML (FDX) Tests (EXP-005 & EXP-006)
  // --------------------------------------------------------------------------
  describe('Final Draft XML Export & Import (FDX)', () => {
    it('16. exportToFDX produces valid Final Draft XML', () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('SUBWAY CAR', 'DAY', 'INT', 5),
        makeAction('The train rattles violently on the tracks.'),
        makeCharacter('JACK'),
        makeDialogue('Hold on!'),
        makeTransition('SMASH CUT TO:'),
      ]
      const doc = createTestDocument(elements)
      const fdx = exportToFDX(doc)

      expect(fdx).toContain('<?xml version="1.0"')
      expect(fdx).toContain('<FinalDraft DocumentType="Script" Template="No" Version="4">')
      expect(fdx).toContain('<Paragraph Type="Scene Heading" Number="5">')
      expect(fdx).toContain('<Text>INT. SUBWAY CAR - DAY</Text>')
      expect(fdx).toContain('<Paragraph Type="Action">')
      expect(fdx).toContain('<Text>The train rattles violently on the tracks.</Text>')
      expect(fdx).toContain('<Paragraph Type="Character">')
      expect(fdx).toContain('<Text>JACK</Text>')
      expect(fdx).toContain('<Paragraph Type="Dialogue">')
      expect(fdx).toContain('<Text>Hold on!</Text>')
      expect(fdx).toContain('<TitlePage>')
      expect(fdx).toContain('THE GREAT SCREENPLAY')
    })

    it('17. importFDX parses Final Draft XML into ScreenplayDocument', () => {
      const fdxXml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
    <Paragraph Type="Scene Heading" Number="12">
      <Text>EXT. BEACH - SUNSET</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>Waves crash against the rocky shore.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>LUCY (V.O.)</Text>
    </Paragraph>
    <Paragraph Type="Parenthetical">
      <Text>(softly)</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>I remember this place.</Text>
    </Paragraph>
    <Paragraph Type="Transition">
      <Text>FADE OUT.</Text>
    </Paragraph>
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Alignment="Center">
        <Text Style="Bold">OCEAN MEMORIES</Text>
      </Paragraph>
      <Paragraph Alignment="Center"><Text>written by</Text></Paragraph>
      <Paragraph Alignment="Center">
        <Text>Robert Smith</Text>
      </Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>`

      const result = importFDX(fdxXml)
      expect(result.success).toBe(true)
      expect(result.document?.metadata.title).toBe('OCEAN MEMORIES')
      expect(result.document?.metadata.author).toBe('Robert Smith')

      const elements = result.document?.elements || []
      expect(elements).toHaveLength(6)
      expect(elements[0].type).toBe('scene-heading')
      expect((elements[0] as SceneHeadingElement).sceneNumber).toBe(12)
      expect((elements[0] as SceneHeadingElement).interior).toBe('EXT')
      expect((elements[0] as SceneHeadingElement).location).toBe('BEACH')

      expect(elements[1].type).toBe('action')
      expect(elements[2].type).toBe('character')
      expect((elements[2] as CharacterElement).name).toBe('LUCY')
      expect((elements[2] as CharacterElement).extension).toBe('V.O.')

      expect(elements[3].type).toBe('parenthetical')
      expect((elements[3] as ParentheticalElement).text).toBe('softly')

      expect(elements[4].type).toBe('dialogue')
      expect((elements[4] as DialogueElement).text).toBe('I remember this place.')

      expect(elements[5].type).toBe('transition')
    })

    it('18. FDX round-trip preserves script structure', () => {
      const originalElements: ScreenplayElement[] = [
        makeSceneHeading('CONTROL ROOM', 'NIGHT', 'INT'),
        makeAction('Monitors blink with frantic status alerts.'),
        makeCharacter('COMMANDER REYES'),
        makeDialogue('Initiate sequence.'),
      ]
      const originalDoc = createTestDocument(originalElements)

      const fdx = exportToFDX(originalDoc)
      const imported = importFDX(fdx)

      expect(imported.success).toBe(true)
      const elements = imported.document?.elements || []
      expect(elements).toHaveLength(4)
      expect(elements[0].type).toBe('scene-heading')
      expect(elements[1].type).toBe('action')
      expect(elements[2].type).toBe('character')
      expect(elements[3].type).toBe('dialogue')
      expect((elements[3] as DialogueElement).text).toBe('Initiate sequence.')
    })
  })

  // --------------------------------------------------------------------------
  // 5. HTML Converter Tests (EXP-007)
  // --------------------------------------------------------------------------
  describe('HTML Converter (html-converter)', () => {
    it('19. elementsToHtml creates Tiptap-compatible HTML markup', () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('HOTEL LOBBY', 'DAY', 'INT', 3),
        makeAction('Guests check in at the front desk.'),
        makeCharacter('CONCIERGE'),
        makeDialogue('May I take your bags?'),
        makePageBreak(),
      ]

      const html = elementsToHtml(elements)
      expect(html).toContain('<p class="screenplay-element" data-type="scene-heading"')
      expect(html).toContain('data-location="HOTEL LOBBY"')
      expect(html).toContain('data-interior="INT"')
      expect(html).toContain('data-scene-number="3"')
      expect(html).toContain('<p class="screenplay-element" data-type="action"')
      expect(html).toContain('<p class="screenplay-element" data-type="character"')
      expect(html).toContain('<p class="screenplay-element" data-type="dialogue"')
      expect(html).toContain('<hr class="screenplay-element" data-type="page-break"')
    })

    it('20. htmlToElements parses Tiptap HTML correctly', () => {
      const html = `<p class="screenplay-element" data-type="scene-heading" data-interior="INT" data-location="KITCHEN" data-time-of-day="MORNING">INT. KITCHEN - MORNING</p>
<p class="screenplay-element" data-type="action">Bacon sizzles in a cast-iron skillet.</p>
<p class="screenplay-element" data-type="character" data-name="DAD">DAD</p>
<p class="screenplay-element" data-type="dialogue">Breakfast is ready!</p>`

      const elements = htmlToElements(html)
      expect(elements).toHaveLength(4)
      expect(elements[0].type).toBe('scene-heading')
      expect((elements[0] as SceneHeadingElement).interior).toBe('INT')
      expect((elements[0] as SceneHeadingElement).location).toBe('KITCHEN')
      expect((elements[0] as SceneHeadingElement).timeOfDay).toBe('MORNING')

      expect(elements[1].type).toBe('action')
      expect((elements[1] as ActionElement).text).toBe('Bacon sizzles in a cast-iron skillet.')

      expect(elements[2].type).toBe('character')
      expect((elements[2] as CharacterElement).name).toBe('DAD')

      expect(elements[3].type).toBe('dialogue')
      expect((elements[3] as DialogueElement).text).toBe('Breakfast is ready!')
    })

    it('21. HTML round-trip preserves elements', () => {
      const original: ScreenplayElement[] = [
        makeSceneHeading('OFFICE', 'NIGHT', 'INT'),
        makeAction('A stack of paperwork sits on the desk.'),
        makeCharacter('BOSS'),
        makeParenthetical('stern'),
        makeDialogue('You need to redo these numbers.'),
      ]

      const html = elementsToHtml(original)
      const reconstructed = htmlToElements(html)

      expect(reconstructed).toHaveLength(original.length)
      expect(reconstructed[0].type).toBe('scene-heading')
      expect((reconstructed[0] as SceneHeadingElement).location).toBe('OFFICE')
      expect(reconstructed[1].type).toBe('action')
      expect(reconstructed[2].type).toBe('character')
      expect(reconstructed[3].type).toBe('parenthetical')
      expect(reconstructed[4].type).toBe('dialogue')
    })
  })

  // --------------------------------------------------------------------------
  // 6. PDF Export Tests (EXP-002)
  // --------------------------------------------------------------------------
  describe('PDF Export (exportToPDF)', () => {
    it('22. exportToPDF produces a valid Blob', async () => {
      const elements: ScreenplayElement[] = [
        makeSceneHeading('TAXI', 'NIGHT', 'INT'),
        makeAction('Rain streaks the window as headlights blur past.'),
        makeCharacter('DRIVER'),
        makeDialogue('Where to, pal?'),
      ]
      const doc = createTestDocument(elements)

      const blob = await exportToPDF(doc, {
        format: 'pdf',
        includeTitlePage: true,
        includeSceneNumbers: true,
        includePageNumbers: true,
        watermark: 'DRAFT',
      })

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
      expect(blob.size).toBeGreaterThan(500)
    })
  })

  // --------------------------------------------------------------------------
  // 7. Error Handling & Edge Cases
  // --------------------------------------------------------------------------
  describe('Error Handling and Edge Cases', () => {
    it('23. handles empty Fountain text gracefully', () => {
      const result = importFountain('')
      expect(result.success).toBe(true)
      expect(result.document?.elements).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('24. handles empty FDX XML gracefully with error', () => {
      const result = importFDX('')
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('25. handles empty HTML input gracefully', () => {
      const elements = htmlToElements('')
      expect(elements).toHaveLength(0)
    })
  })
})
