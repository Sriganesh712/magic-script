/**
 * Ambient module declaration for jsPDF
 */

declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape' | 'p' | 'l'
    unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'em' | 'ex'
    format?: string | [number, number]
  }

  export interface TextOptionsLight {
    align?: 'left' | 'center' | 'right' | 'justify'
    angle?: number
    baseline?: 'alphabetic' | 'top' | 'bottom' | 'middle'
    maxWidth?: number
  }

  export class jsPDF {
    constructor(options?: jsPDFOptions)
    setFont(fontName: string, fontStyle?: string): this
    setFontSize(size: number): this
    getFont(): { fontName: string; fontStyle: string }
    getFontSize(): number
    text(text: string | string[], x: number, y: number, options?: TextOptionsLight): this
    addPage(format?: string | [number, number], orientation?: 'p' | 'portrait' | 'l' | 'landscape'): this
    setTextColor(ch1: number, ch2?: number, ch3?: number, ch4?: number): this
    output(type: 'arraybuffer'): ArrayBuffer
    output(type: 'blob'): Blob
    output(type?: string): any
  }
}
