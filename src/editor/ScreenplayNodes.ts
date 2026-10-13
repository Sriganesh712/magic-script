/**
 * Screenplay Node Extensions for Tiptap
 * Defines all screenplay element node types matching the schema
 */

import { Node, mergeAttributes } from '@tiptap/core'

// ============================================================================
// Screenplay Element Cycle Constants (exported for keyboard handling)
// ============================================================================

export type ScreenplayNodeNames =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'section'
  | 'pageBreak'
  | 'dualDialogueStart'
  | 'dualDialogueEnd'

export const ELEMENT_CYCLE: ScreenplayNodeNames[] = [
  'sceneHeading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
  'section',
]

export const NEXT_ELEMENT: Record<ScreenplayNodeNames, ScreenplayNodeNames> = {
  sceneHeading: 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'character',
  parenthetical: 'dialogue',
  transition: 'sceneHeading',
  shot: 'action',
  section: 'action',
  pageBreak: 'sceneHeading',
  dualDialogueStart: 'character',
  dualDialogueEnd: 'character',
}

export const TAB_ELEMENT: Record<ScreenplayNodeNames, ScreenplayNodeNames | null> = {
  sceneHeading: null,
  action: null,
  character: 'parenthetical',
  dialogue: 'parenthetical',
  parenthetical: null,
  transition: null,
  shot: null,
  section: null,
  pageBreak: null,
  dualDialogueStart: null,
  dualDialogueEnd: null,
}

export const SHIFT_TAB_ELEMENT: Record<ScreenplayNodeNames, ScreenplayNodeNames | null> = {
  sceneHeading: null,
  action: null,
  character: null,
  dialogue: 'character',
  parenthetical: 'dialogue',
  transition: null,
  shot: null,
  section: null,
  pageBreak: null,
  dualDialogueStart: null,
  dualDialogueEnd: null,
}

// ============================================================================
// Scene Heading (Slugline)
// ============================================================================

export const SceneHeading = Node.create({
  name: 'sceneHeading',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 100,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      interior: { default: 'INT', rendered: false },
      location: { default: '', rendered: false },
      timeOfDay: { default: '', rendered: false },
      sceneNumber: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="scene-heading"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'scene-heading' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-1': () => this.editor.commands.setNode(this.name, { interior: 'INT', location: '', timeOfDay: '' }),
    }
  },
})

// ============================================================================
// Action / Description
// ============================================================================

export const Action = Node.create({
  name: 'action',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 90,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="action"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'action' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-2': () => this.editor.commands.setNode(this.name),
    }
  },
})

// ============================================================================
// Character Cue
// ============================================================================

export const Character = Node.create({
  name: 'character',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 80,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      extension: { default: '', rendered: false },
      characterId: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="character"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'character' }), 0]
  },
})

// ============================================================================
// Dialogue
// ============================================================================

export const Dialogue = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 70,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      characterId: { default: null, rendered: false },
      isDual: { default: false, rendered: false },
      dualPairId: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="dialogue"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'dialogue' }), 0]
  },
})

// ============================================================================
// Parenthetical
// ============================================================================

export const Parenthetical = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 60,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      characterId: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="parenthetical"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'parenthetical' }), 0]
  },
})

// ============================================================================
// Transition
// ============================================================================

export const Transition = Node.create({
  name: 'transition',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 50,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      transitionType: { default: 'CUSTOM', rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="transition"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'transition' }), 0]
  },
})

// ============================================================================
// Shot
// ============================================================================

export const Shot = Node.create({
  name: 'shot',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 40,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      shotType: { default: 'CUSTOM', rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="shot"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'shot' }), 0]
  },
})

// ============================================================================
// Section
// ============================================================================

export const Section = Node.create({
  name: 'section',
  group: 'block',
  content: 'inline*',
  defining: true,
  priority: 30,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      level: { default: 1, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="section"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'section' }), 0]
  },
})

// ============================================================================
// Page Break
// ============================================================================

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  content: '',
  defining: true,
  priority: 20,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      forced: { default: true, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'hr[data-type="page-break"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'page-break' })]
  },
})

// ============================================================================
// Dual Dialogue Start / End Markers
// ============================================================================

export const DualDialogueStart = Node.create({
  name: 'dualDialogueStart',
  group: 'block',
  content: '',
  defining: true,
  priority: 15,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      leftCharacterId: { default: null, rendered: false },
      rightCharacterId: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dual-dialogue-start"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'dual-dialogue-start' })]
  },
})

export const DualDialogueEnd = Node.create({
  name: 'dualDialogueEnd',
  group: 'block',
  content: '',
  defining: true,
  priority: 10,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dual-dialogue-end"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'dual-dialogue-end' })]
  },
})

// ============================================================================
// Export All
// ============================================================================

export const screenplayNodes = [
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
  Shot,
  Section,
  PageBreak,
  DualDialogueStart,
  DualDialogueEnd,
]