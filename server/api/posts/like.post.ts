import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const postId = body?.postId
    const action = body?.action as 'toggle' | 'like' | 'unlike' | undefined

    if (!postId || typeof postId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Post ID is required.'
      })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(postId.trim())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Post ID format.'
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NUXT_SUPABASE_SECRET_KEY

    if (!supabaseUrl || !serviceKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase server configuration is missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Resolve authenticated caller
    let currentUserId: string | null = null
    try {
      const user = await serverSupabaseUser(event)
      currentUserId = user?.id || (user as any)?.sub || null
    } catch {}

    if (!currentUserId) {
      const authHeader = getHeader(event, 'authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        const { data } = await supabaseAdmin.auth.getUser(token)
        currentUserId = data?.user?.id || null
      }
    }

    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'You must be logged in to like posts.'
      })
    }

    const cleanPostId = postId.trim()

    // 1. Verify post existence
    const { data: postRow, error: postErr } = await supabaseAdmin
      .from('POST')
      .select('POST_ID')
      .eq('POST_ID', cleanPostId)
      .maybeSingle()

    if (postErr || !postRow) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Post not found.'
      })
    }

    // 2. Check existing like state (Backend guarantees exactly 1 like per user)
    const { data: existingLike, error: checkErr } = await supabaseAdmin
      .from('POST_LIKES')
      .select('Like_ID')
      .eq('POST_ID', cleanPostId)
      .eq('ACCOUNT_ID', currentUserId)
      .maybeSingle()

    if (checkErr) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error checking like status: ${checkErr.message}`
      })
    }

    let userHasLiked = false

    if (existingLike) {
      if (action === 'like') {
        // Idempotent: Keep liked, do not insert duplicate
        userHasLiked = true
      } else {
        // Toggle or explicit unlike -> Delete like
        const { error: deleteErr } = await supabaseAdmin
          .from('POST_LIKES')
          .delete()
          .eq('POST_ID', cleanPostId)
          .eq('ACCOUNT_ID', currentUserId)

        if (deleteErr) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to unlike post: ${deleteErr.message}`
          })
        }
        userHasLiked = false
      }
    } else {
      if (action === 'unlike') {
        // Idempotent: Already unliked
        userHasLiked = false
      } else {
        // Toggle or explicit like -> Insert like
        const { error: insertErr } = await supabaseAdmin
          .from('POST_LIKES')
          .insert({
            POST_ID: cleanPostId,
            ACCOUNT_ID: currentUserId
          })

        // If concurrent insert happened, ignore duplicate key error (23505)
        if (insertErr && insertErr.code !== '23505') {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to like post: ${insertErr.message}`
          })
        }
        userHasLiked = true
      }
    }

    // 3. Fetch authoritative updated like count
    const { count } = await supabaseAdmin
      .from('POST_LIKES')
      .select('*', { count: 'exact', head: true })
      .eq('POST_ID', cleanPostId)

    return {
      success: true,
      userHasLiked,
      likeCount: count || 0
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[api/posts/like] Unexpected error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Internal server error while processing post like.'
    })
  }
})
