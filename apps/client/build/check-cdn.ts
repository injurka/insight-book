import dns from 'node:dns/promises'

interface CheckResult {
  url: string
  status: number | string
  timeMs: number
  isBunnyCdn: boolean
  edgeNode: string
  cacheStatus: string
  countryCode: string
  storageServer: string
  contentType: string
  cacheControl: string
  bodyPreview: string
}

interface CheckHostInit {
  nodes: Record<string, [countryCode: string, countryName: string, cityName: string, ip: string, asn: string]>
  request_id: string
}

type CheckHostResult = Record<string, Array<Array<number | string>>>

const TEST_URLS = [
  'https://insight-book.ru/configs/app-config.js',
  'https://insight-book.ru/index.html',
  'https://insight-book.ru/sw.js',
  'https://insight-book.ru/manifest.webmanifest',
  'https://cdn.insight-book.ru/configs/app-config.js',
]

function getContinent(countryCode: string): string {
  const code = countryCode.toLowerCase()
  if (['us', 'ca', 'mx'].includes(code))
    return '🌎 North America'
  if (['jp', 'sg', 'au', 'kr', 'hk', 'in', 'tw', 'th', 'id', 'my', 'ph', 'vn', 'nz'].includes(code))
    return '🌏 Asia & Oceania'
  if (['de', 'nl', 'uk', 'fr', 'it', 'pl', 'es', 'se', 'bg', 'fi', 'ch', 'cz', 'at', 'ua', 'ro'].includes(code))
    return '🌍 Europe'
  return '🌐 Other'
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function resolveDns(domain: string) {
  try {
    const addresses = await dns.resolve4(domain)
    return addresses
  }
  catch {
    return []
  }
}

async function checkUrl(url: string): Promise<CheckResult> {
  const start = performance.now()

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'InsightBook-CDN-Checker/1.0',
      },
    })
    const end = performance.now()
    const text = await response.text()

    const headers = response.headers
    const server = headers.get('server') || 'Unknown'
    const isBunnyCdn = server.toLowerCase().includes('bunnycdn')

    return {
      url,
      status: response.status,
      timeMs: Math.round(end - start),
      isBunnyCdn,
      edgeNode: server,
      cacheStatus: headers.get('cdn-cache') || 'N/A',
      countryCode: headers.get('cdn-requestcountrycode') || 'N/A',
      storageServer: headers.get('cdn-storageserver') || 'N/A',
      contentType: headers.get('content-type') || 'N/A',
      cacheControl: headers.get('cache-control') || 'N/A',
      bodyPreview: text.slice(0, 150).replace(/\n/g, ' '),
    }
  }
  catch (err: unknown) {
    const end = performance.now()
    const message = err instanceof Error ? err.message : String(err)

    return {
      url,
      status: `ERROR (${message})`,
      timeMs: Math.round(end - start),
      isBunnyCdn: false,
      edgeNode: 'N/A',
      cacheStatus: 'N/A',
      countryCode: 'N/A',
      storageServer: 'N/A',
      contentType: 'N/A',
      cacheControl: 'N/A',
      bodyPreview: '',
    }
  }
}

async function runLocalHeaderCheck() {
  console.log('\n======================================================')
  console.log('    📌 ЭТАП 1: ПРОВЕРКА DNS И ЛОКАЛЬНЫХ ТРЕЙСОВ      ')
  console.log('======================================================\n')

  console.log('1️⃣ Разрешение DNS:')
  const domains = ['insight-book.ru', 'cdn.insight-book.ru', 'api.insight-book.ru']
  for (const domain of domains) {
    const ips = await resolveDns(domain)
    console.log(`   • ${domain.padEnd(24)} -> ${ips.join(', ') || 'Не разрешено'}`)
  }

  console.log('\n2️⃣ Запросы к эндпоинтам и проверка заголовков:\n')

  for (const url of TEST_URLS) {
    console.log(`🔍 Запрос: ${url}`)

    // 1-я попытка (Cold Cache)
    const res1 = await checkUrl(url)
    console.log(`   [Pass 1] Status: ${res1.status} | TTFB: ${res1.timeMs}ms | Cache: ${res1.cacheStatus} | Edge: ${res1.edgeNode} | Country: ${res1.countryCode}`)

    // 2-я попытка (Warm Cache)
    const res2 = await checkUrl(url)
    console.log(`   [Pass 2] Status: ${res2.status} | TTFB: ${res2.timeMs}ms | Cache: ${res2.cacheStatus} | Edge: ${res2.edgeNode}`)

    if (res2.isBunnyCdn) {
      console.log(`   ✅ Обслужено Bunny CDN Edge (Storage: ${res2.storageServer})`)
    }
    else {
      console.log(`   ⚠️ Ответ не от Bunny CDN! Сервер: ${res2.edgeNode}`)
    }

    if (res2.bodyPreview) {
      console.log(`   📄 Превью: "${res2.bodyPreview.trim()}"`)
    }

    console.log('------------------------------------------------------')
  }
}

async function runGlobalRegionCheck() {
  const targetUrl = 'https://insight-book.ru/configs/app-config.js'

  console.log('\n===================================================================')
  console.log('    📌 ЭТАП 2: ТРЕЙСЫ ИЗ РЕГИОНОВ (North America, Europe, Asia)    ')
  console.log('===================================================================\n')
  console.log(`🎯 Запрос конфигурации с глобальных прокси к: ${targetUrl}`)
  console.log('⏳ Опрос глобальных нод...\n')

  try {
    const initRes = await fetch(`https://check-host.net/check-http?host=${encodeURIComponent(targetUrl)}&max_nodes=15`, {
      headers: { Accept: 'application/json' },
    })

    if (!initRes.ok) {
      throw new Error(`HTTP ${initRes.status}: ${initRes.statusText}`)
    }

    const initData = (await initRes.json()) as CheckHostInit
    const requestId = initData.request_id

    await sleep(3500)

    const resultRes = await fetch(`https://check-host.net/check-result/${requestId}`, {
      headers: { Accept: 'application/json' },
    })

    const resultData = (await resultRes.json()) as CheckHostResult

    const grouped: Record<string, Array<{
      nodeKey: string
      country: string
      city: string
      cdnIp: string
      status: number | string
      timeMs: number
    }>> = {}

    for (const [nodeKey, nodeInfo] of Object.entries(initData.nodes)) {
      const countryCode = nodeInfo[0]
      const countryName = nodeInfo[1]
      const cityName = nodeInfo[2]
      const continent = getContinent(countryCode)

      const nodeResults = resultData[nodeKey]
      if (nodeResults && nodeResults[0]) {
        const firstResult = nodeResults[0]
        const isSuccess = firstResult[0] === 1
        const timeSec = typeof firstResult[1] === 'number' ? firstResult[1] : 0
        const statusStr = firstResult[3]
        const cdnIp = String(firstResult[4] || 'N/A')

        if (!grouped[continent]) {
          grouped[continent] = []
        }

        grouped[continent].push({
          nodeKey,
          country: countryName,
          city: cityName,
          cdnIp,
          status: isSuccess ? statusStr : 'FAIL',
          timeMs: Math.round(timeSec * 1000),
        })
      }
    }

    const continentOrder = ['🌍 Europe', '🌎 North America', '🌏 Asia & Oceania', '🌐 Other']

    for (const continent of continentOrder) {
      const items = grouped[continent]
      if (!items || items.length === 0)
        continue

      console.log(`📌 РЕГИОН: ${continent}`)
      console.log('-------------------------------------------------------------------')

      for (const item of items) {
        const loc = `${item.city}, ${item.country}`.padEnd(28)
        const ipStr = `Edge IP: ${item.cdnIp}`.padEnd(26)
        const timeStr = `${item.timeMs}ms`.padStart(6)
        const icon = item.status === 200 || item.status === '200' ? '✅' : '❌'

        console.log(`  ${icon}  ${loc} | ${ipStr} | Status: ${item.status} | TTFB: ${timeStr}`)
      }
      console.log('-------------------------------------------------------------------\n')
    }
  }
  catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ Ошибка региональной проверки: ${msg}`)
  }
}

async function main() {
  console.log('\n🚀 ЗАПУСК ПОЛНОГО КОМПЛЕКСНОГО ТЕСТА BUNNY CDN & STORAGE')
  await runLocalHeaderCheck()
  await runGlobalRegionCheck()
  console.log('🎉 ВСЕ ПРОВЕРКИ УСПЕШНО ЗАВЕРШЕНЫ!\n')
}

main()
