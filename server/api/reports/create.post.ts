import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { targetType, targetId, category, description, diagnostics, reporterEmail } = body

    if (!targetType) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Report target type is required.'
      })
    }

    if (!category || !description) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Category and description are required.'
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
        statusMessage: 'Supabase service configuration missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Resolve caller ID (optional for public bug/feedback, required for entity reports)
    let callerId: string | null = null
    try {
      const user = await serverSupabaseUser(event)
      callerId = user?.id || (user as any)?.sub || null
    } catch {}

    if (!callerId) {
      const authHeader = getHeader(event, 'authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim()
        const { data: tokenUser } = await supabaseAdmin.auth.getUser(token)
        callerId = tokenUser?.user?.id || null
      }
    }

    const normalizedType = targetType.charAt(0).toUpperCase() + targetType.slice(1).toLowerCase()

    if (!['Bug', 'Feedback'].includes(normalizedType) && !callerId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'You must be logged in to submit a moderation report.'
      })
    }

    let targetAccountId: string | null = null
    let targetArtistId: string | null = null
    let targetBusinessId: string | null = null
    let targetPostId: string | null = null
    let targetCommentId: string | null = null
    let targetMessageId: string | null = null
    let targetBookingId: string | null = null
    let evidenceSnapshot: Record<string, any> = {}

    // Gather verbatim evidence snapshot based on entity type
    if (normalizedType === 'Message') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Message ID is required.' })
      targetMessageId = targetId

      const { data: msgRow, error: msgErr } = await supabaseAdmin
        .from('MESSAGE')
        .select(`
          Message_ID,
          Thread_ID,
          Sender_ID,
          Content,
          Attachments,
          Metadata,
          Created_at,
          Is_Edited,
          Edited_At,
          Is_Deleted,
          USER_ACCOUNT:Sender_ID (
            Username,
            Email,
            Profile_Picture
          )
        `)
        .eq('Message_ID', targetId)
        .maybeSingle()

      if (msgErr || !msgRow) {
        throw createError({ statusCode: 404, statusMessage: 'Reported message not found in system.' })
      }

      targetAccountId = msgRow.Sender_ID
      evidenceSnapshot = {
        messageId: msgRow.Message_ID,
        threadId: msgRow.Thread_ID,
        senderId: msgRow.Sender_ID,
        senderUsername: (msgRow.USER_ACCOUNT as any)?.Username || 'Unknown',
        content: msgRow.Content,
        attachments: msgRow.Attachments || [],
        metadata: msgRow.Metadata || {},
        createdAt: msgRow.Created_at,
        isEdited: msgRow.Is_Edited,
        capturedAt: new Date().toISOString()
      }
    } else if (normalizedType === 'Post') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Post ID is required.' })
      targetPostId = targetId

      const { data: postRow, error: postErr } = await supabaseAdmin
        .from('POST')
        .select(`
          POST_ID,
          ARTIST_ID,
          Caption,
          Media,
          File_URL,
          Created_at,
          ARTIST (
            ARTIST_ID,
            ACCOUNT_ID,
            Artist_Type,
            StageName,
            USER_ACCOUNT (
              Username,
              Profile_Picture
            )
          )
        `)
        .eq('POST_ID', targetId)
        .maybeSingle()

      if (postErr || !postRow) {
        throw createError({ statusCode: 404, statusMessage: 'Reported post not found in system.' })
      }

      const artist = postRow.ARTIST as any
      targetArtistId = postRow.ARTIST_ID
      targetAccountId = artist?.ACCOUNT_ID || null

      evidenceSnapshot = {
        postId: postRow.POST_ID,
        artistId: postRow.ARTIST_ID,
        artistStageName: artist?.StageName || 'Artist',
        caption: postRow.Caption,
        media: postRow.Media,
        fileUrl: postRow.File_URL,
        createdAt: postRow.Created_at,
        capturedAt: new Date().toISOString()
      }
    } else if (normalizedType === 'Comment') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Comment ID is required.' })
      targetCommentId = targetId

      const { data: commentRow, error: commentErr } = await supabaseAdmin
        .from('POST_COMMENTS')
        .select(`
          Comment_ID,
          POST_ID,
          ACCOUNT_ID,
          Content,
          Created_at,
          USER_ACCOUNT (
            Username,
            Profile_Picture
          ),
          POST (
            POST_ID,
            Caption,
            Media
          )
        `)
        .eq('Comment_ID', targetId)
        .maybeSingle()

      if (commentErr || !commentRow) {
        throw createError({ statusCode: 404, statusMessage: 'Reported comment not found in system.' })
      }

      targetAccountId = commentRow.ACCOUNT_ID
      targetPostId = commentRow.POST_ID

      evidenceSnapshot = {
        commentId: commentRow.Comment_ID,
        postId: commentRow.POST_ID,
        commenterId: commentRow.ACCOUNT_ID,
        commenterUsername: (commentRow.USER_ACCOUNT as any)?.Username || 'Unknown',
        commentContent: commentRow.Content,
        createdAt: commentRow.Created_at,
        parentPostSnippet: (commentRow.POST as any)?.Caption || '',
        capturedAt: new Date().toISOString()
      }
    } else if (normalizedType === 'Contract') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Booking Contract ID is required.' })
      targetBookingId = targetId

      const { data: contractRow, error: contractErr } = await supabaseAdmin
        .from('BOOKING_CONTRACT')
        .select(`
          Booking_ID,
          Contract_Code,
          Job_ID,
          Requester_Account_ID,
          Provider_Artist_ID,
          Provider_Business_ID,
          Event_Date,
          Start_Date,
          Start_Time,
          Agreed_Fee,
          Status,
          Cancellation_Reason,
          Is_Late_Cancellation,
          Created_at,
          ARTIST:Provider_Artist_ID (
            ARTIST_ID,
            ACCOUNT_ID,
            StageName
          ),
          BUSINESS_PROFILE:Provider_Business_ID (
            BUSINESS_ID,
            ACCOUNT_ID,
            Business_Name
          )
        `)
        .eq('Booking_ID', targetId)
        .maybeSingle()

      if (contractErr || !contractRow) {
        throw createError({ statusCode: 404, statusMessage: 'Reported contract not found in system.' })
      }

      // Offender resolution: resolve opposite party
      const isCallerRequester = callerId === contractRow.Requester_Account_ID
      if (isCallerRequester) {
        targetArtistId = contractRow.Provider_Artist_ID || null
        targetBusinessId = contractRow.Provider_Business_ID || null
        targetAccountId = (contractRow.ARTIST as any)?.ACCOUNT_ID || (contractRow.BUSINESS_PROFILE as any)?.ACCOUNT_ID || null
      } else {
        targetAccountId = contractRow.Requester_Account_ID
      }

      evidenceSnapshot = {
        bookingId: contractRow.Booking_ID,
        contractCode: contractRow.Contract_Code,
        eventDate: contractRow.Event_Date || contractRow.Start_Date,
        agreedFee: contractRow.Agreed_Fee,
        status: contractRow.Status,
        cancellationReason: contractRow.Cancellation_Reason,
        isLateCancellation: contractRow.Is_Late_Cancellation,
        createdAt: contractRow.Created_at,
        capturedAt: new Date().toISOString()
      }
    } else if (normalizedType === 'Profile') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Profile target ID is required.' })

      // Check USER_ACCOUNT first
      const { data: accRow } = await supabaseAdmin
        .from('USER_ACCOUNT')
        .select('ACCOUNT_ID, Username, Email, Profile_Picture, Strike_Count, Is_Banned, Is_Suspended')
        .eq('ACCOUNT_ID', targetId)
        .maybeSingle()

      if (accRow) {
        targetAccountId = accRow.ACCOUNT_ID
        evidenceSnapshot = {
          targetAccountId: accRow.ACCOUNT_ID,
          username: accRow.Username,
          currentStrikes: accRow.Strike_Count || 0,
          capturedAt: new Date().toISOString()
        }
      } else {
        // Try ARTIST
        const { data: artistRow } = await supabaseAdmin
          .from('ARTIST')
          .select('ARTIST_ID, ACCOUNT_ID, StageName, USER_ACCOUNT(Username, Profile_Picture)')
          .eq('ARTIST_ID', targetId)
          .maybeSingle()

        if (artistRow) {
          targetArtistId = artistRow.ARTIST_ID
          targetAccountId = artistRow.ACCOUNT_ID
          evidenceSnapshot = {
            artistId: artistRow.ARTIST_ID,
            stageName: artistRow.StageName,
            username: (artistRow.USER_ACCOUNT as any)?.Username,
            capturedAt: new Date().toISOString()
          }
        } else {
          // Try BUSINESS_PROFILE
          const { data: bizRow } = await supabaseAdmin
            .from('BUSINESS_PROFILE')
            .select('BUSINESS_ID, ACCOUNT_ID, Business_Name')
            .eq('BUSINESS_ID', targetId)
            .maybeSingle()

          if (bizRow) {
            targetBusinessId = bizRow.BUSINESS_ID
            targetAccountId = bizRow.ACCOUNT_ID
            evidenceSnapshot = {
              businessId: bizRow.BUSINESS_ID,
              businessName: bizRow.Business_Name,
              capturedAt: new Date().toISOString()
            }
          } else {
            throw createError({ statusCode: 404, statusMessage: 'Reported profile not found.' })
          }
        }
      }
    } else if (['Bug', 'Feedback'].includes(normalizedType)) {
      evidenceSnapshot = {
        diagnostics: diagnostics || {},
        reporterEmail: reporterEmail || null,
        submittedAt: new Date().toISOString()
      }
    }

    // Prevent self-reporting
    if (callerId && targetAccountId && callerId.toLowerCase() === targetAccountId.toLowerCase()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot submit a report against yourself.'
      })
    }

    // Insert frozen report row into USER_REPORT
    const { data: insertedReport, error: insertErr } = await supabaseAdmin
      .from('USER_REPORT')
      .insert({
        Reporter_Account_ID: callerId,
        Report_Type: normalizedType,
        Target_Account_ID: targetAccountId,
        Target_Artist_ID: targetArtistId,
        Target_Business_ID: targetBusinessId,
        Target_Post_ID: targetPostId,
        Target_Comment_ID: targetCommentId,
        Target_Message_ID: targetMessageId,
        Target_Booking_ID: targetBookingId,
        Evidence_Snapshot: evidenceSnapshot,
        Category: category,
        Description: description,
        Is_Resolved: false,
        Created_At: new Date().toISOString()
      })
      .select('Report_ID')
      .single()

    if (insertErr) {
      console.error('[reports/create] Error inserting report:', insertErr)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to record report: ' + insertErr.message
      })
    }

    return {
      success: true,
      reportId: insertedReport.Report_ID,
      message: normalizedType === 'Bug'
        ? 'Thank you! Your bug report has been submitted to the TONO technical team.'
        : normalizedType === 'Feedback'
          ? 'Thank you! Your feedback has been received and shared with our team.'
          : 'Report submitted successfully. Evidence has been preserved for administrative review.'
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[reports/create] Unexpected error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Internal server error while filing report.'
    })
  }
})
