import { defineEventHandler, getQuery } from 'h3'

export interface LinkPreviewData {
  url: string
  title: string
  description?: string
  image?: string
  site_name?: string
}

function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0'
  ) {
    return true
  }

  // Check private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const parts = lower.split('.').map(Number)
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const p0 = parts[0]
    const p1 = parts[1]
    if (p0 !== undefined && p1 !== undefined) {
      if (p0 === 10) return true
      if (p0 === 127) return true
      if (p0 === 169 && p1 === 254) return true
      if (p0 === 172 && p1 >= 16 && p1 <= 31) return true
      if (p0 === 192 && p1 === 168) return true
    }
  }

  return false
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim()
}

function extractMetaTag(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Matches property="name" ... content="..."
    const p1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i')
    const m1 = html.match(p1)
    if (m1 && m1[1]) return decodeHtmlEntities(m1[1])

    // Matches content="..." ... property="name"
    const p2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i')
    const m2 = html.match(p2)
    if (m2 && m2[1]) return decodeHtmlEntities(m2[1])
  }
  return null
}

function extractYouTubeVideoId(parsedUrl: URL): string | null {
  const host = parsedUrl.hostname.toLowerCase()
  if (host.includes('youtu.be')) {
    const id = parsedUrl.pathname.replace(/^\//, '').split('/')[0]
    return id || null
  }
  if (host.includes('youtube.com')) {
    const vParam = parsedUrl.searchParams.get('v')
    if (vParam) return vParam
    const shortsMatch = parsedUrl.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/)
    if (shortsMatch && shortsMatch[1]) return shortsMatch[1]
    const embedMatch = parsedUrl.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/)
    if (embedMatch && embedMatch[1]) return embedMatch[1]
  }
  return null
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  let rawUrl = Array.isArray(query.url) ? query.url[0] : (query.url as string | undefined)

  if (!rawUrl || typeof rawUrl !== 'string') {
    return { success: false, error: 'URL query parameter is required' }
  }

  let parsedUrl: URL
  try {
    let clean = rawUrl.trim()
    if (clean.startsWith('http%3A') || clean.startsWith('https%3A')) {
      try {
        clean = decodeURIComponent(clean)
      } catch {
        // keep as is
      }
    }
    clean = clean.replace(/[.,!?:;)\]]+$/, '')
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean
    }
    parsedUrl = new URL(clean)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Only HTTP/HTTPS URLs are supported' }
    }
  } catch {
    return { success: false, error: 'Invalid URL syntax' }
  }

  // SSRF Protection
  if (isPrivateIpOrHost(parsedUrl.hostname)) {
    return { success: false, error: 'Restricted host' }
  }

  const hostLower = parsedUrl.hostname.toLowerCase()

  // 1. DEDICATED YOUTUBE OEMBED & THUMBNAIL FALLBACK HANDLER
  if (hostLower.includes('youtube.com') || hostLower.includes('youtu.be')) {
    const videoId = extractYouTubeVideoId(parsedUrl)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}&format=json`
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (oembedRes.ok) {
        const data = await oembedRes.json()
        const preview: LinkPreviewData = {
          url: parsedUrl.toString(),
          title: data.title || 'YouTube Video',
          description: data.author_name ? `Video by ${data.author_name}` : 'Watch on YouTube',
          image: data.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
          site_name: 'YouTube',
        }
        return { success: true, preview }
      }
    } catch {
      // Fall through to videoId fallback
    }

    if (videoId) {
      return {
        success: true,
        preview: {
          url: parsedUrl.toString(),
          title: 'YouTube Video',
          description: 'Watch on YouTube',
          image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          site_name: 'YouTube',
        },
      }
    }
  }

  // 2. DEDICATED SPOTIFY OEMBED HANDLER
  if (hostLower.includes('spotify.com')) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (oembedRes.ok) {
        const data = await oembedRes.json()
        const preview: LinkPreviewData = {
          url: parsedUrl.toString(),
          title: data.title || 'Spotify Track',
          description: 'Listen on Spotify',
          image: data.thumbnail_url || undefined,
          site_name: 'Spotify',
        }
        return { success: true, preview }
      }
    } catch {
      // Fall through to general scraping
    }
  }

  // 3. GENERAL OPEN GRAPH HTML SCRAPING
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4500)

    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; facebookexternalhit/1.1; TONO/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return { success: false, error: `Failed to fetch URL: HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { success: false, error: 'Non-HTML resource' }
    }

    // Read first 96KB to ensure complete meta tags are captured
    const reader = response.body?.getReader()
    let html = ''
    if (reader) {
      const decoder = new TextDecoder('utf-8')
      let bytesRead = 0
      const maxBytes = 96 * 1024

      while (bytesRead < maxBytes) {
        const { value, done } = await reader.read()
        if (done || !value) break
        html += decoder.decode(value, { stream: true })
        bytesRead += value.byteLength
      }
      reader.cancel()
    } else {
      html = await response.text()
      if (html.length > 96 * 1024) {
        html = html.substring(0, 96 * 1024)
      }
    }

    // Extract Open Graph & Meta tags
    let title = extractMetaTag(html, ['og:title', 'twitter:title', 'title'])
    if (!title) {
      const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      if (titleTagMatch && titleTagMatch[1]) {
        title = decodeHtmlEntities(titleTagMatch[1])
      }
    }

    let description = extractMetaTag(html, ['og:description', 'twitter:description', 'description'])
    let image = extractMetaTag(html, ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'])
    let site_name = extractMetaTag(html, ['og:site_name', 'twitter:site']) || parsedUrl.hostname.replace(/^www\./, '')

    // Resolve relative image URLs
    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      try {
        image = new URL(image, parsedUrl.origin).href
      } catch {
        image = null
      }
    }

    if (!title && !description && !image) {
      return { success: false, error: 'No Open Graph metadata found' }
    }

    const preview: LinkPreviewData = {
      url: parsedUrl.toString(),
      title: title || parsedUrl.hostname,
      description: description ? description.substring(0, 200) : undefined,
      image: image || undefined,
      site_name: site_name || undefined,
    }

    return { success: true, preview }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error parsing Open Graph tags',
    }
  }
})
