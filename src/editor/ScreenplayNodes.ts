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
  priority: 90,

  addAttributes() {
    return {
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      interior: { default: 'INT', rendered: true, renderHTML: (attributes) => ({ 'data-interior': attributes.interior }), parseHTML: (element) => element.getAttribute('data-interior') },
      location: { default: '', rendered: true, renderHTML: (attributes) => ({ 'data-location': attributes.location }), parseHTML: (element) => element.getAttribute('data-location') },
      timeOfDay: { default: '', rendered: true, renderHTML: (attributes) => ({ 'data-time-of-day': attributes.timeOfDay }), parseHTML: (element) => element.getAttribute('data-time-of-day') },
      sceneNumber: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-scene-number': attributes.sceneNumber }), parseHTML: (element) => element.getAttribute('data-scene-number') },
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
  priority: 1000,

  addAttributes() {
    return {
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      extension: { default: '', rendered: true, renderHTML: (attributes) => ({ 'data-extension': attributes.extension }), parseHTML: (element) => element.getAttribute('data-extension') },
      characterId: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-character-id': attributes.characterId }), parseHTML: (element) => element.getAttribute('data-character-id') },
      name: { default: '', rendered: true, renderHTML: (attributes) => ({ 'data-character-name': attributes.name }), parseHTML: (element) => element.getAttribute('data-character-name') },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="character"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'character' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-3': () => this.editor.commands.setNode(this.name),
    }
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      characterId: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-character-id': attributes.characterId }), parseHTML: (element) => element.getAttribute('data-character-id') },
      isDual: { default: false, rendered: true, renderHTML: (attributes) => ({ 'data-is-dual': attributes.isDual }), parseHTML: (element) => element.getAttribute('data-is-dual') },
      dualPairId: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-dual-pair-id': attributes.dualPairId }), parseHTML: (element) => element.getAttribute('data-dual-pair-id') },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="dialogue"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'dialogue' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-4': () => this.editor.commands.setNode(this.name),
    }
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      characterId: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-character-id': attributes.characterId }), parseHTML: (element) => element.getAttribute('data-character-id') },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="parenthetical"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'parenthetical' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-6': () => this.editor.commands.setNode(this.name),
    }
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      transitionType: { default: 'CUSTOM', rendered: true, renderHTML: (attributes) => ({ 'data-transition-type': attributes.transitionType }), parseHTML: (element) => element.getAttribute('data-transition-type') },
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-type="transition"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'screenplay-element' }, HTMLAttributes, { 'data-type': 'transition' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-5': () => this.editor.commands.setNode(this.name),
    }
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      shotType: { default: 'CUSTOM', rendered: true, renderHTML: (attributes) => ({ 'data-shot-type': attributes.shotType }), parseHTML: (element) => element.getAttribute('data-shot-type') },
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      level: { default: 1, rendered: true, renderHTML: (attributes) => ({ 'data-level': attributes.level }), parseHTML: (element) => element.getAttribute('data-level') },
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      forced: { default: true, rendered: true, renderHTML: (attributes) => ({ 'data-forced': attributes.forced }), parseHTML: (element) => element.getAttribute('data-forced') },
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
      leftCharacterId: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-left-character-id': attributes.leftCharacterId }), parseHTML: (element) => element.getAttribute('data-left-character-id') },
      rightCharacterId: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-right-character-id': attributes.rightCharacterId }), parseHTML: (element) => element.getAttribute('data-right-character-id') },
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
      id: { default: null, rendered: true, renderHTML: (attributes) => ({ 'data-id': attributes.id }), parseHTML: (element) => element.getAttribute('data-id') },
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