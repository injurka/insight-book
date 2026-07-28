import AdmZip from 'adm-zip'
import path from 'node:path'
import { rmSync } from 'node:fs'

export function packToCbz(sourceDir: string, destDir: string, safeTitle: string): string {
  const zip = new AdmZip()
  zip.addLocalFolder(sourceDir)

  const outputPath = path.resolve(destDir, `${safeTitle}.cbz`)
  zip.writeZip(outputPath)

  // Удаляем папку с изображениями после успешной упаковки
  rmSync(sourceDir, { recursive: true, force: true })
  return outputPath
}
