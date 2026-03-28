export async function scrapeWebsite(url: string): Promise<string> {
  if (!url) return ''

  try {
    // Normalize URL
    if (!url.startsWith('http')) url = 'https://' + url

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CounterPitch/1.0)' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })

    if (!response.ok) return ''

    const html = await response.text()

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Extract og:description as fallback
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
    const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : ''

    // Strip scripts/styles, get visible text from body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const bodyText = bodyMatch
      ? bodyMatch[1]
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[\s\S]*?<\/footer>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 600)
      : ''

    const parts = [
      title && `Title: ${title}`,
      (description || ogDesc) && `Description: ${description || ogDesc}`,
      bodyText && `Content: ${bodyText}`,
    ].filter(Boolean)

    return parts.join('\n')
  } catch {
    return ''
  }
}
