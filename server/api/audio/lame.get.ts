export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  try {
    const code = await $fetch<string>('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.all.js', {
      responseType: 'text'
    })
    return code
  } catch (err) {
    // Fallback CDN
    const code = await $fetch<string>('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.js', {
      responseType: 'text'
    })
    return code
  }
})
