import * as cheerio from 'cheerio'

export async function fetchAndParseOpds(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'InsightBook/1.0', 'Accept': 'application/atom+xml,application/xml,text/xml' } })
  if (!res.ok)
    throw new Error(`HTTP ${res.status}`)
  const xml = await res.text()

  const $ = cheerio.load(xml, { xmlMode: true })

  const title = $('feed > title').text()

  const links: any[] = []
  $('feed > link').each((_, el) => {
    links.push({
      rel: $(el).attr('rel'),
      href: new URL($(el).attr('href') || '', url).toString(),
      type: $(el).attr('type'),
      title: $(el).attr('title'),
    })
  })

  const entries: any[] = []
  $('feed > entry').each((_, el) => {
    const entryTitle = $(el).find('title').first().text()

    const authors: string[] = []
    $(el).find('author name').each((__, a) => {
      authors.push($(a).text())
    })

    const content = $(el).find('content').text() || $(el).find('summary').text()

    const entryLinks: any[] = []
    $(el).find('link').each((__, linkEl) => {
      const href = $(linkEl).attr('href')
      if (href) {
        try {
          entryLinks.push({
            rel: $(linkEl).attr('rel'),
            href: new URL(href, url).toString(),
            type: $(linkEl).attr('type'),
            title: $(linkEl).attr('title'),
          })
        }
        catch {
          // ignore invalid urls
        }
      }
    })

    entries.push({
      title: entryTitle,
      author: authors.join(', '),
      content,
      links: entryLinks,
    })
  })

  return { title, links, entries }
}
