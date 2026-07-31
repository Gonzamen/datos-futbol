import { CSV_BOM, buildCsv, exportFileName } from '@datos-futbol/domain'
import type { Match } from '@datos-futbol/domain'

/**
 * The BOM matters: without it Excel reads the file as Latin-1 and every accent
 * in the players' names comes out broken.
 */
export function downloadCsv(match: Match): void {
  download(exportFileName(match, 'csv'), CSV_BOM + buildCsv(match), 'text/csv;charset=utf-8')
}

function download(name: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement('a')

  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
