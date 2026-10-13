/**
 * Story Bible & Context Summarizer (AI-004)
 * Produces compact context summaries to minimize token consumption.
 */

import type { Project, Character, Location } from '@/types'

export interface StoryBibleContextParams {
  project: Project
  characters?: Character[]
  locations?: Location[]
  currentSceneHeading?: string
}

/**
 * Builds a compact, high-signal representation of the screenplay's key elements.
 */
export function buildCompactStoryBible({
  project,
  characters = [],
  locations = [],
  currentSceneHeading,
}: StoryBibleContextParams): string {
  const lines: string[] = []

  lines.push(`TITLE: ${project.name}`)
  if (project.genre) lines.push(`GENRE: ${project.genre}`)
  if (project.logline) lines.push(`LOGLINE: ${project.logline}`)

  // Top characters (up to 6)
  if (characters.length > 0) {
    const topChars = characters.slice(0, 6)
    const charSummary = topChars
      .map((c) => {
        const desc = c.description ? `: ${c.description}` : ''
        return `${c.name}${desc}`
      })
      .join('; ')
    lines.push(`CHARACTERS: ${charSummary}`)
  }

  // Key locations (up to 6)
  if (locations.length > 0) {
    const locSummary = locations
      .slice(0, 6)
      .map((l) => `${l.type}. ${l.name}`)
      .join(', ')
    lines.push(`KEY LOCATIONS: ${locSummary}`)
  }

  if (currentSceneHeading) {
    lines.push(`CURRENT SCENE: ${currentSceneHeading}`)
  }

  return lines.join('\n')
}
