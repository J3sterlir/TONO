/**
 * Universal Link Resolver Utility
 * 
 * Automatically detects the platform and extracts profile handles, channel names,
 * and artist slugs from URLs for Facebook, YouTube, SoundCloud, Instagram, TikTok,
 * Spotify, X/Twitter, Bandcamp, and general websites.
 */

export interface ResolvedLink {
  url: string
  label: string
  handle?: string
  platform: string
  icon: string
  domain: string
  isResolvedHandle: boolean
}

/**
 * Normalizes a URL string by ensuring it starts with a valid protocol.
 */
export const normalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Parses and extracts platform metadata, brand icon, and profile handle from a URL.
 */
export const resolveSocialLink = (rawUrl: string, customLabel?: string | null): ResolvedLink => {
  const url = normalizeUrl(rawUrl)
  
  if (!url) {
    return {
      url: '',
      label: customLabel || 'Link',
      platform: 'Website',
      icon: 'lucide:globe',
      domain: '',
      isResolvedHandle: false,
    }
  }

  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    return {
      url,
      label: customLabel || rawUrl,
      platform: 'Link',
      icon: 'lucide:link',
      domain: rawUrl,
      isResolvedHandle: false,
    }
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const pathname = parsed.pathname.replace(/\/+$/, '') // strip trailing slashes
  const segments = pathname.split('/').filter(Boolean)

  let platform = 'Website'
  let icon = 'lucide:globe'
  let extractedHandle = ''

  // 1. YouTube
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtu.be') {
    platform = 'YouTube'
    icon = 'mdi:youtube'

    if (hostname === 'youtu.be') {
      extractedHandle = 'YouTube Video'
    } else if (segments[0]?.startsWith('@')) {
      extractedHandle = segments[0] // e.g. @channel
    } else if (segments[0] === 'c' || segments[0] === 'user') {
      extractedHandle = segments[1] ? `@${segments[1]}` : 'YouTube Channel'
    } else if (segments[0] === 'channel') {
      extractedHandle = 'YouTube Channel'
    } else if (segments[0]) {
      extractedHandle = segments[0].startsWith('@') ? segments[0] : `@${segments[0]}`
    } else {
      extractedHandle = 'YouTube'
    }
  }

  // 2. Facebook
  else if (hostname === 'facebook.com' || hostname === 'm.facebook.com' || hostname === 'fb.com' || hostname === 'fb.me') {
    platform = 'Facebook'
    icon = 'mdi:facebook'

    // Skip utility paths like /pages/, /groups/, /profile.php
    if (segments[0] === 'groups') {
      extractedHandle = segments[1] ? `Group: ${segments[1]}` : 'Facebook Group'
    } else if (segments[0] === 'profile.php') {
      const idParam = parsed.searchParams.get('id')
      extractedHandle = idParam ? `ID: ${idParam}` : 'Facebook Profile'
    } else if (segments[0] === 'pages' && segments[2]) {
      extractedHandle = `@${segments[2]}`
    } else if (segments[0] && !['watch', 'share', 'events', 'marketplace'].includes(segments[0])) {
      extractedHandle = `@${segments[0]}`
    } else {
      extractedHandle = 'Facebook'
    }
  }

  // 3. Instagram
  else if (hostname === 'instagram.com' || hostname === 'instagr.am') {
    platform = 'Instagram'
    icon = 'mdi:instagram'

    if (segments[0] && !['p', 'reel', 'stories', 'explore'].includes(segments[0])) {
      extractedHandle = `@${segments[0]}`
    } else {
      extractedHandle = 'Instagram'
    }
  }

  // 4. SoundCloud
  else if (hostname === 'soundcloud.com' || hostname === 'm.soundcloud.com') {
    platform = 'SoundCloud'
    icon = 'mdi:soundcloud'

    if (segments[0] && !['discover', 'stream', 'charts', 'search'].includes(segments[0])) {
      extractedHandle = segments[0]
      if (segments[1] && !['sets', 'tracks', 'albums'].includes(segments[1])) {
        extractedHandle = `${segments[0]}/${segments[1]}`
      }
    } else {
      extractedHandle = 'SoundCloud'
    }
  }

  // 5. Spotify
  else if (hostname === 'spotify.com' || hostname === 'open.spotify.com') {
    platform = 'Spotify'
    icon = 'mdi:spotify'

    if (segments[0] === 'artist') {
      extractedHandle = 'Spotify Artist'
    } else if (segments[0] === 'album' || segments[0] === 'track') {
      extractedHandle = 'Spotify Music'
    } else if (segments[0] === 'user') {
      extractedHandle = segments[1] ? `User: ${segments[1]}` : 'Spotify Profile'
    } else {
      extractedHandle = 'Spotify'
    }
  }

  // 6. TikTok
  else if (hostname === 'tiktok.com') {
    platform = 'TikTok'
    icon = 'mdi:music-note' // TikTok / music

    if (segments[0]?.startsWith('@')) {
      extractedHandle = segments[0]
    } else if (segments[0]) {
      extractedHandle = `@${segments[0]}`
    } else {
      extractedHandle = 'TikTok'
    }
  }

  // 7. X / Twitter
  else if (hostname === 'twitter.com' || hostname === 'x.com') {
    platform = 'X (Twitter)'
    icon = 'mdi:twitter'

    if (segments[0] && !['i', 'hashtag', 'search', 'home'].includes(segments[0])) {
      extractedHandle = `@${segments[0]}`
    } else {
      extractedHandle = 'X (Twitter)'
    }
  }

  // 8. Bandcamp
  else if (hostname.endsWith('.bandcamp.com')) {
    platform = 'Bandcamp'
    icon = 'mdi:music-box'
    const subdomain = hostname.split('.bandcamp.com')[0]
    extractedHandle = subdomain || 'Bandcamp'
  }

  // 9. Apple Music
  else if (hostname === 'music.apple.com') {
    platform = 'Apple Music'
    icon = 'mdi:apple'
    extractedHandle = 'Apple Music'
  }

  // 10. Generic Web / Domain Fallback
  else {
    platform = 'Website'
    icon = 'lucide:globe'
    extractedHandle = hostname
  }

  const finalLabel = customLabel?.trim() ? customLabel.trim() : (extractedHandle || hostname)

  return {
    url,
    label: finalLabel,
    handle: extractedHandle || undefined,
    platform,
    icon,
    domain: hostname,
    isResolvedHandle: Boolean(extractedHandle && extractedHandle !== platform),
  }
}

/**
 * Extracts 2-letter uppercase initials from a business or entity name
 * for fallback avatar badges.
 * Examples:
 *   "Starlight Sound" -> "SS"
 *   "Studio A" -> "SA"
 *   "Beatbox" -> "BE"
 */
export const getBusinessInitials = (name?: string | null): string => {
  if (!name || !name.trim()) return 'TN'
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]
  const second = words[1]
  if (first && second && first.length > 0 && second.length > 0) {
    return (first.charAt(0) + second.charAt(0)).toUpperCase()
  }
  const single = first || 'TN'
  return single.slice(0, 2).toUpperCase()
}
