#!/usr/bin/env bun
/**
 * Собирает и упаковывает плагин в ZIP для загрузки в каталог InsightBook.
 *
 * CLI-вызов из любого плагина (через workspace bin):
 *   "pack": "bun run --filter @injurka/insight-book-pack-plugin pack $PWD"
 *
 * Или напрямую:
 *   bun run src/index.ts packages/plugin-scroll-study
 */

const pluginDir = Bun.argv[2]

if (!pluginDir) {
  console.error('❌ Укажите путь к плагину: pack-plugin <plugin-dir>')
  process.exit(1)
}

const join = (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')

const pkgPath = join(pluginDir, 'package.json')
const manifestPath = join(pluginDir, 'manifest.json')
const distDir = join(pluginDir, 'dist')
const distManifest = join(distDir, 'manifest.json')
const distRemoteEntry = join(distDir, 'remoteEntry.js')

// Валидация
if (!(await Bun.file(pkgPath).exists())) {
  console.error(`❌ package.json не найден в ${pluginDir}`)
  process.exit(1)
}
if (!(await Bun.file(manifestPath).exists())) {
  console.error(`❌ manifest.json не найден в ${pluginDir}`)
  process.exit(1)
}

const pkg = await Bun.file(pkgPath).json()
const manifest = await Bun.file(manifestPath).json()
const pluginId = manifest.id || pkg.name?.split('/').pop() || pluginDir.split('/').pop()!
const version = manifest.version || pkg.version || '0.0.0'

const zipName = `${pluginId}-v${version}.zip`
const zipPath = join(pluginDir, zipName)

function sh(cmd: string[], dir: string) {
  const result = Bun.spawnSync({ cmd, cwd: dir, stdout: 'inherit', stderr: 'inherit' })
  if (result.exitCode !== 0) process.exit(result.exitCode)
}

// 1. Сборка
console.log(`📦 Сборка плагина ${pluginId} v${version}...`)
sh(['bun', 'run', 'build'], pluginDir)

if (!(await Bun.file(distManifest).exists())) {
  console.error('❌ manifest.json не найден в dist/ — проверьте скрипт build в package.json')
  process.exit(1)
}
if (!(await Bun.file(distRemoteEntry).exists())) {
  console.error('❌ remoteEntry.js не найден в dist/ — сборка Module Federation не сработала?')
  process.exit(1)
}

// 2. Упаковка
console.log(`🗜️  Упаковка ${distDir} → ${zipName}...`)
sh(['zip', '-r', zipPath, '.'], distDir)

const size = Bun.file(zipPath).size
const sizeMB = (size / 1024 / 1024).toFixed(2)
console.log(`\n✅ Плагин упакован: ${zipName} (${sizeMB} MB)`)
console.log(`   Готов к загрузке через Настройки → Плагины → Загрузить в каталог`)

export { }
