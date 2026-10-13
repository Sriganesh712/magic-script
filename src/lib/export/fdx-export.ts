/**
 * Final Draft XML (.fdx) Exporter
 * Implements EXP-005 Final Draft XML export specifications.
 * 
 * Generates standard Final Draft 8+ compatible XML (.fdx):
 * - Maps screenplay elements to FDX Paragraph types
 * - Includes TitlePage metadata
 * - Handles scene numbers, extensions, dual dialogue, and page breaks
 * - Escapes XML entities correctly
 */

import type {
  ScreenplayDocument,
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
// XML Helper
// ============================================================================

export function escapeXml(unsafe: string): string {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ============================================================================
// FDX Exporter
// ============================================================================

/**
 * Converts a ScreenplayDocument into Final Draft XML (.fdx) string.
 * 
 * @param document The ScreenplayDocument to export
 * @returns Well-formed Final Draft XML string
 */
export function exportToFDX(document: ScreenplayDocument): string {
  const metadata = document.metadata
  const elements = document.elements

  let contentXml = ''
  let inDualDialogue = false

  for (const el of elements) {
    if (isDualDialogueStart(el)) {
      inDualDialogue = true
      continue
    }
    if (isDualDialogueEnd(el)) {
      inDualDialogue = false
      continue
    }

    if (isSceneHeading(el)) {
      const loc = el.location ? el.location.toUpperCase() : ''
      const time = el.timeOfDay ? ` - ${el.timeOfDay.toUpperCase()}` : ''
      const headingText = `${el.interior}. ${loc}${time}`.trim()
      const numAttr = el.sceneNumber != null ? ` Number="${el.sceneNumber}"` : ''

      contentXml += `    <Paragraph Type="Scene Heading"${numAttr}>\n`
      contentXml += `      <Text>${escapeXml(headingText)}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isAction(el)) {
      contentXml += `    <Paragraph Type="Action">\n`
      contentXml += `      <Text>${escapeXml(el.text)}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isCharacter(el)) {
      let charName = el.name.toUpperCase()
      if (el.extension) {
        charName += ` (${el.extension.toUpperCase()})`
      }
      const dualAttr = inDualDialogue ? ' DualDialogue="Yes"' : ''

      contentXml += `    <Paragraph Type="Character"${dualAttr}>\n`
      contentXml += `      <Text>${escapeXml(charName)}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isParenthetical(el)) {
      let parenText = el.text.trim()
      if (!parenText.startsWith('(') || !parenText.endsWith(')')) {
        parenText = `(${parenText})`
      }

      contentXml += `    <Paragraph Type="Parenthetical">\n`
      contentXml += `      <Text>${escapeXml(parenText)}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isDialogue(el)) {
      const dualAttr = inDualDialogue || el.isDual ? ' DualDialogue="Yes"' : ''

      contentXml += `    <Paragraph Type="Dialogue"${dualAttr}>\n`
      contentXml += `      <Text>${escapeXml(el.text)}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isTransition(el)) {
      contentXml += `    <Paragraph Type="Transition">\n`
      contentXml += `      <Text>${escapeXml(el.text.toUpperCase())}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isShot(el)) {
      contentXml += `    <Paragraph Type="Shot">\n`
      contentXml += `      <Text>${escapeXml(el.text.toUpperCase())}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isSection(el)) {
      contentXml += `    <Paragraph Type="General">\n`
      contentXml += `      <Text>${escapeXml(el.title)}</Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }

    if (isPageBreak(el)) {
      contentXml += `    <Paragraph Type="Action" PageBreak="Yes">\n`
      contentXml += `      <Text></Text>\n`
      contentXml += `    </Paragraph>\n`
      continue
    }
  }

  // Build Title Page XML
  let titlePageContent = ''
  if (metadata.title) {
    titlePageContent += `      <Paragraph Alignment="Center">\n`
    titlePageContent += `        <Text Style="Bold+Underline">${escapeXml(metadata.title.toUpperCase())}</Text>\n`
    titlePageContent += `      </Paragraph>\n`
    titlePageContent += `      <Paragraph Alignment="Center"><Text></Text></Paragraph>\n`
    titlePageContent += `      <Paragraph Alignment="Center"><Text>written by</Text></Paragraph>\n`
    titlePageContent += `      <Paragraph Alignment="Center"><Text></Text></Paragraph>\n`
  }
  if (metadata.author) {
    titlePageContent += `      <Paragraph Alignment="Center">\n`
    titlePageContent += `        <Text>${escapeXml(metadata.author)}</Text>\n`
    titlePageContent += `      </Paragraph>\n`
  }
  if (metadata.contact) {
    titlePageContent += `      <Paragraph Alignment="Left">\n`
    titlePageContent += `        <Text>${escapeXml(metadata.contact)}</Text>\n`
    titlePageContent += `      </Paragraph>\n`
  }
  if (metadata.draftDate) {
    titlePageContent += `      <Paragraph Alignment="Left">\n`
    titlePageContent += `        <Text>${escapeXml(metadata.draftDate)}</Text>\n`
    titlePageContent += `      </Paragraph>\n`
  }

  const fdx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
${contentXml}  </Content>
  <HeaderAndFooter>
    <Header>
      <Paragraph Alignment="Right">
        <Text></Text>
      </Paragraph>
    </Header>
    <Footer>
      <Paragraph Alignment="Right">
        <Text></Text>
      </Paragraph>
    </Footer>
  </HeaderAndFooter>
  <TitlePage>
    <Content>
${titlePageContent}    </Content>
  </TitlePage>
</FinalDraft>
`

  return fdx
}
