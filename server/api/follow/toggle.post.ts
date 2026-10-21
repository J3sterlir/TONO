import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const targetAccountId = body?.targetAccountId

    if (typeof targetAccountId !== 'string' || !targetAccountId.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Target Account ID is required.'
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

    // Resolve current authenticated caller
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
        statusMessage: 'Authentication required to follow accounts.'
      })
    }

    // If an ARTIST_ID was passed, resolve it to the artist's ACCOUNT_ID
    let resolvedTargetAccountId = targetAccountId.trim()
    const { data: artistRow } = await supabaseAdmin
      .from('ARTIST')
      .select('ACCOUNT_ID')
      .eq('ARTIST_ID', resolvedTargetAccountId)
      .maybeSingle()

    if (artistRow?.ACCOUNT_ID) {
      resolvedTargetAccountId = artistRow.ACCOUNT_ID
    } else {
      const { data: bizRow } = await supabaseAdmin
        .from('BUSINESS_PROFILE')
        .select('ACCOUNT_ID')
        .eq('BUSINESS_ID', resolvedTargetAccountId)
        .maybeSingle()

      if (bizRow?.ACCOUNT_ID) {
        resolvedTargetAccountId = bizRow.ACCOUNT_ID
      }
    }

    if (currentUserId.toLowerCase() === resolvedTargetAccountId.toLowerCase()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot follow yourself.'
      })
    }

    // Check existing follow state
    const { data: existingFollow } = await supabaseAdmin
      .from('FOLLOW')
      .select('Follow_ID')
      .eq('Follower_Account_ID', currentUserId)
      .eq('Following_Account_ID', resolvedTargetAccountId)
      .maybeSingle()

    let isFollowing = false

    if (existingFollow) {
      // Unfollow
      const { error: deleteErr } = await supabaseAdmin
        .from('FOLLOW')
        .delete()
        .eq('Follow_ID', existingFollow.Follow_ID)

      if (deleteErr) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to unfollow: ${deleteErr.message}`
        })
      }
      isFollowing = false
    } else {
      // Follow
      const { error: insertErr } = await supabaseAdmin
        .from('FOLLOW')
        .insert({
          Follower_Account_ID: currentUserId,
          Following_Account_ID: resolvedTargetAccountId
        })

      if (insertErr) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to follow: ${insertErr.message}`
        })
      }
      isFollowing = true
    }

    // Query updated follower count for the target account
    const { count: followerCount } = await supabaseAdmin
      .from('FOLLOW')
      .select('*', { count: 'exact', head: true })
      .eq('Following_Account_ID', resolvedTargetAccountId)

    return {
      success: true,
      isFollowing,
      followerCount: followerCount || 0
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[API /api/follow/toggle] Error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || 'Internal server error'
    })
  }
})
