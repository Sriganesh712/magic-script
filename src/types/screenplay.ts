/**
 * Core TypeScript types for Screenplay Studio
 * Schema version: 1.0.0
 * These types represent the semantic structure of a screenplay document.
 * They are used by the editor, persistence layer, and export pipelines.
 */

// ============================================================================
// Base Types
// ============================================================================

/** Unique identifier for all entities */
export type EntityId = string & { readonly __brand: unique symbol }

/** Creates a branded EntityId from a string */
export function createEntityId(id: string): EntityId {
  return id as EntityId
}

/** Timestamp in milliseconds since epoch */
export type Timestamp = number & { readonly __brand: unique symbol }

/** Creates a timestamp from current time */
export function now(): Timestamp {
  return Date.now() as Timestamp
}

/** JSON-serializable value */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

// ============================================================================
// Screenplay Element Types
// ============================================================================

/** All supported screenplay element types */
export type ScreenplayElementType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'section'
  | 'page-break'
  | 'dual-dialogue-start'
  | 'dual-dialogue-end'

/** Inline formatting marks */
export type InlineFormatType = 'bold' | 'italic' | 'underline' | 'strikethrough'

/** Base interface for all screenplay elements */
export interface BaseScreenplayElement {
  /** Stable unique identifier for this element */
  id: EntityId
  /** Element type discriminator */
  type: ScreenplayElementType
  /** When this element was created */
  createdAt: Timestamp
  /** When this element was last modified */
  updatedAt: Timestamp
  /** Schema version for migrations */
  schemaVersion: number
}

/** Scene Heading (Slugline) - INT./EXT. LOCATION - TIME */
export interface SceneHeadingElement extends BaseScreenplayElement {
  type: 'scene-heading'
  /** INT. or EXT. */
  interior: 'INT' | 'EXT' | 'INT/EXT'
  /** Location name */
  location: string
  /** Time of day (DAY, NIGHT, DAWN, DUSK, CONTINUOUS, etc.) */
  timeOfDay: string
  /** Optional scene number for production */
  sceneNumber?: number
}

/** Action/Description text */
export interface ActionElement extends BaseScreenplayElement {
  type: 'action'
  /** The action text content */
  text: string
}

/** Character Cue (name above dialogue) */
export interface CharacterElement extends BaseScreenplayElement {
  type: 'character'
  /** Character name */
  name: string
  /** Optional extension (V.O., O.S., O.C., etc.) */
  extension?: string
  /** Reference to character entity ID if linked */
  characterId?: EntityId
}

/** Dialogue block */
export interface DialogueElement extends BaseScreenplayElement {
  type: 'dialogue'
  /** The spoken text */
  text: string
  /** Reference to the character speaking */
  characterId: EntityId
  /** Whether this is dual dialogue (paired with another) */
  isDual?: boolean
  /** ID of the paired dual dialogue element */
  dualPairId?: EntityId
}

/** Parenthetical within dialogue */
export interface ParentheticalElement extends BaseScreenplayElement {
  type: 'parenthetical'
  /** The parenthetical text */
  text: string
  /** Reference to the character */
  characterId: EntityId
}

/** Transition (CUT TO:, FADE TO:, etc.) */
export interface TransitionElement extends BaseScreenplayElement {
  type: 'transition'
  /** Transition text */
  text: string
  /** Standard transition types */
  transitionType?: 'CUT_TO' | 'FADE_IN' | 'FADE_OUT' | 'FADE_TO' | 'DISSOLVE_TO' | 'SMASH_CUT' | 'MATCH_CUT' | 'JUMP_CUT' | 'CUSTOM'
}

/** Shot specification */
export interface ShotElement extends BaseScreenplayElement {
  type: 'shot'
  /** Shot description */
  text: string
  /** Shot type */
  shotType?: 'CLOSE_UP' | 'WIDE' | 'POV' | 'INSERT' | 'ANGLE_ON' | 'CUSTOM'
}

/** Section header (Act, Sequence, etc.) */
export interface SectionElement extends BaseScreenplayElement {
  type: 'section'
  /** Section title */
  title: string
  /** Section level (1=Act, 2=Sequence, etc.) */
  level: number
}

/** Explicit page break */
export interface PageBreakElement extends BaseScreenplayElement {
  type: 'page-break'
  /** Whether this is a forced break */
  forced: boolean
}

/** Dual dialogue container start marker */
export interface DualDialogueStartElement extends BaseScreenplayElement {
  type: 'dual-dialogue-start'
  /** Left character ID */
  leftCharacterId: EntityId
  /** Right character ID */
  rightCharacterId: EntityId
}

/** Dual dialogue container end marker */
export interface DualDialogueEndElement extends BaseScreenplayElement {
  type: 'dual-dialogue-end'
}

/** Union of all screenplay element types */
export type ScreenplayElement =
  | SceneHeadingElement
  | ActionElement
  | CharacterElement
  | DialogueElement
  | ParentheticalElement
  | TransitionElement
  | ShotElement
  | SectionElement
  | PageBreakElement
  | DualDialogueStartElement
  | DualDialogueEndElement

// ============================================================================
// Type Guards
// ============================================================================

export function isSceneHeading(el: ScreenplayElement): el is SceneHeadingElement {
  return el.type === 'scene-heading'
}

export function isAction(el: ScreenplayElement): el is ActionElement {
  return el.type === 'action'
}

export function isCharacter(el: ScreenplayElement): el is CharacterElement {
  return el.type === 'character'
}

export function isDialogue(el: ScreenplayElement): el is DialogueElement {
  return el.type === 'dialogue'
}

export function isParenthetical(el: ScreenplayElement): el is ParentheticalElement {
  return el.type === 'parenthetical'
}

export function isTransition(el: ScreenplayElement): el is TransitionElement {
  return el.type === 'transition'
}

export function isShot(el: ScreenplayElement): el is ShotElement {
  return el.type === 'shot'
}

export function isSection(el: ScreenplayElement): el is SectionElement {
  return el.type === 'section'
}

export function isPageBreak(el: ScreenplayElement): el is PageBreakElement {
  return el.type === 'page-break'
}

export function isDualDialogueStart(el: ScreenplayElement): el is DualDialogueStartElement {
  return el.type === 'dual-dialogue-start'
}

export function isDualDialogueEnd(el: ScreenplayElement): el is DualDialogueEndElement {
  return el.type === 'dual-dialogue-end'
}

// ============================================================================
// Document Structure
// ============================================================================

/** Screenplay document metadata */
export interface ScreenplayMetadata {
  /** Document title */
  title: string
  /** Author name */
  author?: string
  /** Contact information */
  contact?: string
  /** Draft date */
  draftDate?: string
  /** Revision history */
  revisions?: RevisionInfo[]
  /** Custom metadata */
  custom?: Record<string, JsonValue>
}

/** Revision information */
export interface RevisionInfo {
  /** Revision label (e.g., "First Draft", "Rev 1", "Blue Pages") */
  label: string
  /** Date of revision */
  date: string
  /** Color for revision marks */
  color?: string
  /** Notes about this revision */
  notes?: string
}

/** Complete screenplay document */
export interface ScreenplayDocument {
  /** Document ID */
  id: EntityId
  /** Project ID this belongs to */
  projectId: EntityId
  /** Draft ID this belongs to */
  draftId: EntityId
  /** Document metadata */
  metadata: ScreenplayMetadata
  /** Ordered array of elements */
  elements: ScreenplayElement[]
  /** Current schema version */
  schemaVersion: number
  /** Creation timestamp */
  createdAt: Timestamp
  /** Last modified timestamp */
  updatedAt: Timestamp
}

// ============================================================================
// Project Structure
// ============================================================================

/** Project status */
export type ProjectStatus = 'concept' | 'outline' | 'drafting' | 'polishing' | 'production' | 'archived'

/** Project entity */
export interface Project {
  id: EntityId
  name: string
  status: ProjectStatus
  logline?: string
  genre?: string
  targetLength?: number // in pages
  createdAt: Timestamp
  updatedAt: Timestamp
  settings: ProjectSettings
}

/** Project-level settings */
export interface ProjectSettings {
  /** Default page format */
  pageFormat: PageFormatSettings
  /** Auto-save interval in ms */
  autoSaveInterval: number
  /** Enable revision tracking */
  revisionTracking: boolean
  /** Custom element styles */
  customStyles?: Record<string, JsonValue>
}

/** Page format settings for pagination */
export interface PageFormatSettings {
  /** Page size */
  paperSize: 'US_LETTER' | 'A4'
  /** Margins in inches */
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  /** Font family */
  fontFamily: string
  /** Font size in points */
  fontSize: number
  /** Line height multiplier */
  lineHeight: number
  /** Character name indent from left margin (inches) */
  characterIndent: number
  /** Dialogue indent from left margin (inches) */
  dialogueIndent: number
  /** Dialogue width (inches) */
  dialogueWidth: number
  /** Parenthetical indent from left margin (inches) */
  parentheticalIndent: number
  /** Parenthetical width (inches) */
  parentheticalWidth: number
  /** Transition indent from right margin (inches) */
  transitionIndent: number
  /** Scene heading style */
  sceneHeadingStyle: 'standard' | 'bold' | 'underlined'
  /** Page numbers */
  pageNumbers: boolean
  /** Scene numbers */
  sceneNumbers: boolean
}

/** Default page format settings (industry standard) */
export const DEFAULT_PAGE_FORMAT: PageFormatSettings = {
  paperSize: 'US_LETTER',
  margins: { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0 },
  fontFamily: 'Courier Prime, Courier New, Courier, monospace',
  fontSize: 12,
  lineHeight: 1.0,
  characterIndent: 3.7,
  dialogueIndent: 2.5,
  dialogueWidth: 3.5,
  parentheticalIndent: 3.1,
  parentheticalWidth: 2.0,
  transitionIndent: 1.0,
  sceneHeadingStyle: 'standard',
  pageNumbers: true,
  sceneNumbers: false,
}

/** Draft within a project */
export interface Draft {
  id: EntityId
  projectId: EntityId
  name: string
  description?: string
  isCurrent: boolean
  screenplayId: EntityId
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Scene card for outline view */
export interface SceneCard {
  id: EntityId
  projectId: EntityId
  screenplayId: EntityId
  elementId: EntityId // References the scene-heading element
  order: number
  summary?: string
  location?: string
  timeOfDay?: string
  characters: EntityId[]
  notes?: string
  color?: string // For categorization
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ============================================================================
// Production Entities
// ============================================================================

/** Character database entry */
export interface Character {
  id: EntityId
  projectId: EntityId
  name: string
  description?: string
  arcs?: string[]
  dialogueCount: number
  sceneCount: number
  firstAppearance?: EntityId // scene ID
  lastAppearance?: EntityId
  color?: string // For UI categorization
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Location database entry */
export interface Location {
  id: EntityId
  projectId: EntityId
  name: string
  type: 'INT' | 'EXT' | 'INT/EXT'
  description?: string
  sceneIds: EntityId[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Prop database entry */
export interface Prop {
  id: EntityId
  projectId: EntityId
  name: string
  description?: string
  sceneIds: EntityId[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Note attached to scene or project */
export interface Note {
  id: EntityId
  projectId: EntityId
  sceneId?: EntityId
  content: string
  type: 'general' | 'todo' | 'research' | 'idea'
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ============================================================================
// Revision History
// ============================================================================

/** Revision snapshot */
export interface RevisionSnapshot {
  id: EntityId
  projectId: EntityId
  draftId: EntityId
  screenplayId: EntityId
  label: string
  description?: string
  /** Full document snapshot */
  document: ScreenplayDocument
  /** Word count at snapshot */
  wordCount: number
  /** Character count at snapshot */
  charCount: number
  createdAt: Timestamp
  createdBy: 'user' | 'auto' | 'import'
}

// ============================================================================
// Analytics Types
// ============================================================================

/** Writing session */
export interface WritingSession {
  id: EntityId
  projectId: EntityId
  draftId: EntityId
  startTime: Timestamp
  endTime?: Timestamp
  /** Words added during session */
  wordsAdded: number
  /** Words deleted during session */
  wordsDeleted: number
  /** Net word change */
  netWords: number
  /** Whether this session counts toward streaks */
  countsForStreak: boolean
}

/** Daily writing stats */
export interface DailyStats {
  date: string // YYYY-MM-DD in user's timezone
  projectId: EntityId
  wordsAdded: number
  wordsDeleted: number
  netWords: number
  sessionCount: number
  totalSessionTime: number // ms
  goalsMet: string[] // goal IDs met
}

/** Writing goal */
export interface WritingGoal {
  id: EntityId
  projectId: EntityId
  type: 'daily' | 'weekly' | 'monthly' | 'project'
  targetWords: number
  targetSessions?: number
  targetTime?: number // ms
  startDate: string
  endDate?: string
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Activity event for analytics (idempotent) */
export interface ActivityEvent {
  id: EntityId // UUID for idempotency
  projectId: EntityId
  draftId: EntityId
  type: 'word_added' | 'word_deleted' | 'session_start' | 'session_end' | 'goal_met' | 'revision_created'
  timestamp: Timestamp
  payload: JsonValue
  schemaVersion: number
}

// ============================================================================
// Sync Types
// ============================================================================

/** Sync operation for queue */
export interface SyncOperation {
  id: EntityId
  projectId: EntityId
  entityType: 'project' | 'draft' | 'screenplay' | 'character' | 'location' | 'note' | 'revision' | 'analytics'
  entityId: EntityId
  operation: 'create' | 'update' | 'delete'
  payload: JsonValue
  version: number // entity version for conflict detection
  createdAt: Timestamp
  retries: number
  lastError?: string
}

/** Version vector for sync */
export interface VersionVector {
  [entityId: string]: number
}

/** Conflict resolution result */
export interface ConflictResolution {
  localVersion: JsonValue
  remoteVersion: JsonValue
  resolvedVersion: JsonValue
  resolution: 'local' | 'remote' | 'merged' | 'manual'
}

// ============================================================================
// Import/Export Types
// ============================================================================

/** Import result */
export interface ImportResult {
  success: boolean
  document?: ScreenplayDocument
  warnings: ImportWarning[]
  errors: ImportError[]
}

/** Import warning (non-fatal) */
export interface ImportWarning {
  code: string
  message: string
  location?: { line: number; column: number }
  elementId?: EntityId
}

/** Import error (fatal) */
export interface ImportError {
  code: string
  message: string
  location?: { line: number; column: number }
}

/** Export format */
export type ExportFormat = 'pdf' | 'fountain' | 'fdx' | 'json' | 'txt'

/** Export options */
export interface ExportOptions {
  format: ExportFormat
  includeTitlePage: boolean
  includeSceneNumbers: boolean
  includePageNumbers: boolean
  watermark?: string
  pageFormat?: Partial<PageFormatSettings>
}

// ============================================================================
// Schema Version & Migration
// ============================================================================

export const CURRENT_SCHEMA_VERSION = 1

export interface Migration {
  fromVersion: number
  toVersion: number
  migrate: (data: JsonValue) => JsonValue
}

export const MIGRATIONS: Migration[] = [
  // Future migrations will be added here
]