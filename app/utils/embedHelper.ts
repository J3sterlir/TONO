/**
 * Utility functions for parsing, validating, and converting third-party
 * media links (YouTube, Google Drive, Spotify, SoundCloud, Vimeo) into secure,
 * responsive embed URLs.
 */

export type MediaType = 'youtube' | 'googledrive' | 'spotify' | 'soundcloud' | 'vimeo' | 'unsupported'

export type EmbedAspect = 'video' | 'audio-compact' | 'audio-tall'

export interface ParsedMedia {
  type: MediaType
  embedUrl: string | null
  originalUrl: string
  aspect: EmbedAspect
  platformName: string
  platformIcon: string
}

/**
 * Extracts and formats the embed URL from a variety of streaming and video providers.
 */
export function parseMediaUrl(rawUrl: string | null | undefined): ParsedMedia {
  const url = (rawUrl || '').trim()

  if (!url) {
    return {
      type: 'unsupported',
      embedUrl: null,
      originalUrl: '',
      aspect: 'video',
      platformName: 'Unknown',
      platformIcon: 'ic:outline-link',
    }
  }

  // 1. YouTube (watch, youtu.be, shorts, embed)
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
  )
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1]
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      originalUrl: url,
      aspect: 'video',
      platformName: 'YouTube',
      platformIcon: 'ic:baseline-smart-display',
    }
  }

  // 2. Google Drive (file view, preview, open?id=)
  const gdriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i)
  if (gdriveMatch) {
    const fileId = gdriveMatch[1] || gdriveMatch[2]
    if (fileId) {
      return {
        type: 'googledrive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        originalUrl: url,
        aspect: 'video',
        platformName: 'Google Drive',
        platformIcon: 'ic:baseline-add-to-drive',
      }
    }
  }

  // 3. Spotify (track, album, playlist, artist)
  const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i)
  if (spotifyMatch) {
    const [, kind, id] = spotifyMatch
    if (kind && id) {
      const isSingleTrack = kind.toLowerCase() === 'track'
      return {
        type: 'spotify',
        embedUrl: `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`,
        originalUrl: url,
        aspect: isSingleTrack ? 'audio-compact' : 'audio-tall',
        platformName: 'Spotify',
        platformIcon: 'ic:baseline-album',
      }
    }
  }

  // 4. SoundCloud
  if (url.includes('soundcloud.com')) {
    const encoded = encodeURIComponent(url)
    return {
      type: 'soundcloud',
      embedUrl: `https://w.soundcloud.com/player/?url=${encoded}&color=%23d0d4f7&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
      originalUrl: url,
      aspect: 'audio-compact',
      platformName: 'SoundCloud',
      platformIcon: 'ic:outline-graphic-eq',
    }
  }

  // 5. Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i)
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      originalUrl: url,
      aspect: 'video',
      platformName: 'Vimeo',
      platformIcon: 'ic:baseline-videocam',
    }
  }

  return {
    type: 'unsupported',
    embedUrl: null,
    originalUrl: url,
    aspect: 'video',
    platformName: 'External Link',
    platformIcon: 'ic:outline-link',
  }
}

/**
 * Checks whether a given string is a valid, supported media or audio URL.
 */
export function isValidMediaUrl(url: string): boolean {
  const parsed = parseMediaUrl(url)
  return parsed.type !== 'unsupported' && Boolean(parsed.embedUrl)
}
