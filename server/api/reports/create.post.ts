import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const {
      targetType,
      targetId,
      targetAccountId: inputTargetAccountId,
      targetName,
      category,
      description,
      diagnostics,
      reporterEmail,
      previewSnippet,
      previewText,
      previewMedia
    } = body

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

    const isUuidStr = (str?: string | null): boolean =>
      !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str).trim())

    // Gather verbatim evidence snapshot based on entity type
    if (normalizedType === 'Message') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Message ID is required.' })
      targetMessageId = targetId

      let msgRow: any = null
      if (isUuidStr(targetId)) {
        const { data, error: msgErr } = await supabaseAdmin
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

        if (!msgErr && data) {
          msgRow = data
        }
      }

      if (!msgRow) {
        if (inputTargetAccountId && isUuidStr(inputTargetAccountId)) {
          targetAccountId = inputTargetAccountId
          evidenceSnapshot = {
            messageId: targetId,
            content: previewSnippet || previewText || 'Unavailable or deleted message content',
            senderId: inputTargetAccountId,
            capturedAt: new Date().toISOString()
          }
        } else {
          throw createError({ statusCode: 404, statusMessage: 'Reported message not found in system.' })
        }
      } else {
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
      }
    } else if (normalizedType === 'Post') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Post ID is required.' })
      targetPostId = targetId

      let postRow: any = null
      if (isUuidStr(targetId)) {
        const { data, error: postErr } = await supabaseAdmin
          .from('POST')
          .select(`
            POST_ID,
            ARTIST_ID,
            BUSINESS_ID,
            Caption,
            Media,
            Location,
            Created_at,
            ARTIST:ARTIST_ID (
              ARTIST_ID,
              ACCOUNT_ID,
              Artist_Type,
              SOLO_ARTIST ( Artist_Name ),
              BAND ( Band_Name ),
              USER_ACCOUNT:ACCOUNT_ID (
                Username,
                Profile_Picture
              )
            ),
            BUSINESS_PROFILE:BUSINESS_ID (
              BUSINESS_ID,
              ACCOUNT_ID,
              Business_Name,
              USER_ACCOUNT:ACCOUNT_ID (
                Username,
                Profile_Picture
              )
            )
          `)
          .eq('POST_ID', targetId)
          .maybeSingle()

        if (!postErr && data) {
          postRow = data
        }
      }

      if (!postRow) {
        if (inputTargetAccountId && isUuidStr(inputTargetAccountId)) {
          targetAccountId = inputTargetAccountId
          evidenceSnapshot = {
            postId: targetId,
            authorName: targetName || 'Creator',
            caption: previewSnippet || previewText || 'Unavailable or deleted post',
            media: previewMedia || null,
            capturedAt: new Date().toISOString()
          }
        } else {
          throw createError({ statusCode: 404, statusMessage: 'Reported post not found in system.' })
        }
      } else {
        const artist = postRow.ARTIST as any
        const business = postRow.BUSINESS_PROFILE as any
        const artistName = artist
          ? (artist.Artist_Type === 'Band'
              ? (artist.BAND?.[0]?.Band_Name || artist.BAND?.Band_Name)
              : (artist.SOLO_ARTIST?.[0]?.Artist_Name || artist.SOLO_ARTIST?.Artist_Name)) || artist.USER_ACCOUNT?.Username || 'Artist'
          : null
        const authorName = artistName || business?.Business_Name || business?.USER_ACCOUNT?.Username || targetName || 'Creator'

        targetArtistId = postRow.ARTIST_ID || null
        targetBusinessId = postRow.BUSINESS_ID || null
        targetAccountId = artist?.ACCOUNT_ID || business?.ACCOUNT_ID || inputTargetAccountId || null

        evidenceSnapshot = {
          postId: postRow.POST_ID,
          artistId: postRow.ARTIST_ID,
          businessId: postRow.BUSINESS_ID,
          authorName,
          caption: postRow.Caption,
          media: postRow.Media,
          location: postRow.Location,
          createdAt: postRow.Created_at,
          capturedAt: new Date().toISOString()
        }
      }
    } else if (normalizedType === 'Comment') {
      if (!targetId) throw createError({ statusCode: 400, statusMessage: 'Comment ID is required.' })
      targetCommentId = targetId

      let commentRow: any = null
      if (isUuidStr(targetId)) {
        const { data, error: commentErr } = await supabaseAdmin
          .from('POST_COMMENTS')
          .select(`
            Comment_ID,
            POST_ID,
            ACCOUNT_ID,
            Content,
            Created_at,
            USER_ACCOUNT:ACCOUNT_ID (
              Username,
              Profile_Picture
            ),
            POST:POST_ID (
              POST_ID,
              Caption,
              Media
            )
          `)
          .eq('Comment_ID', targetId)
          .maybeSingle()

        if (!commentErr && data) {
          commentRow = data
        }
      }

      if (!commentRow) {
        if (inputTargetAccountId && isUuidStr(inputTargetAccountId)) {
          targetAccountId = inputTargetAccountId
          evidenceSnapshot = {
            commentId: targetId,
            commentContent: previewSnippet || previewText || 'Unavailable or deleted comment',
            commenterUsername: targetName || 'Commenter',
            capturedAt: new Date().toISOString()
          }
        } else {
          throw createError({ statusCode: 404, statusMessage: 'Reported comment not found in system.' })
        }
      } else {
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
      }
    } else if (normalizedType === 'Contract') {
      if (!targetId && !previewSnippet) throw createError({ statusCode: 400, statusMessage: 'Booking Contract ID is required.' })

      let contractRow: any = null
      const rawId = String(targetId || '').trim()
      const candCode = rawId.match(/BK-\d+-\d+/i)?.[0] || (previewSnippet ? String(previewSnippet).match(/BK-\d+-\d+/i)?.[0] : null)

      if (isUuidStr(rawId)) {
        const { data } = await supabaseAdmin
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
            Venue_Location,
            Created_at
          `)
          .eq('Booking_ID', rawId)
          .maybeSingle()
        if (data) contractRow = data
      }

      if (!contractRow && candCode) {
        const { data } = await supabaseAdmin
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
            Venue_Location,
            Created_at
          `)
          .eq('Contract_Code', candCode)
          .maybeSingle()
        if (data) contractRow = data
      }

      if (!contractRow) {
        if (inputTargetAccountId && isUuidStr(inputTargetAccountId)) {
          targetAccountId = inputTargetAccountId
          targetBookingId = isUuidStr(rawId) ? rawId : null
          evidenceSnapshot = {
            contractCode: candCode || rawId,
            cancellationReason: previewSnippet || previewText || 'Unavailable contract details',
            status: 'Cancelled',
            capturedAt: new Date().toISOString()
          }
        } else {
          throw createError({ statusCode: 404, statusMessage: 'Reported contract not found in system.' })
        }
      } else {
        targetBookingId = contractRow.Booking_ID

        // Offender resolution: resolve opposite party
        const isCallerRequester = callerId === contractRow.Requester_Account_ID
        if (isCallerRequester) {
          targetArtistId = contractRow.Provider_Artist_ID || null
          targetBusinessId = contractRow.Provider_Business_ID || null
          if (contractRow.Provider_Artist_ID) {
            const { data: a } = await supabaseAdmin.from('ARTIST').select('ACCOUNT_ID').eq('ARTIST_ID', contractRow.Provider_Artist_ID).maybeSingle()
            if (a) targetAccountId = a.ACCOUNT_ID
          }
        } else {
          targetAccountId = contractRow.Requester_Account_ID
          if (contractRow.Provider_Business_ID) {
            targetBusinessId = contractRow.Provider_Business_ID
          } else if (targetAccountId) {
            const { data: hostBiz } = await supabaseAdmin
              .from('BUSINESS_PROFILE')
              .select('BUSINESS_ID')
              .eq('ACCOUNT_ID', targetAccountId)
              .maybeSingle()
            if (hostBiz?.BUSINESS_ID) {
              targetBusinessId = hostBiz.BUSINESS_ID
            }
          }
        }

        evidenceSnapshot = {
          bookingId: contractRow.Booking_ID,
          contractCode: contractRow.Contract_Code,
          eventDate: contractRow.Event_Date || contractRow.Start_Date,
          agreedFee: contractRow.Agreed_Fee,
          venueLocation: contractRow.Venue_Location || 'Designated Venue',
          status: contractRow.Status,
          cancellationReason: contractRow.Cancellation_Reason,
          isLateCancellation: !!contractRow.Is_Late_Cancellation,
          createdAt: contractRow.Created_at,
          capturedAt: new Date().toISOString()
        }
      }
    } else if (normalizedType === 'Profile') {
      const candidateIds: string[] = []
      if (inputTargetAccountId) candidateIds.push(String(inputTargetAccountId).trim())
      if (targetId) candidateIds.push(String(targetId).trim())

      if (previewSnippet) {
        const uuidMatch = previewSnippet.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
        if (uuidMatch && !candidateIds.includes(uuidMatch[0])) {
          candidateIds.push(uuidMatch[0])
        }
      }

      let resolvedUserAccount: any = null
      let resolvedArtist: any = null
      let resolvedBusiness: any = null

      // Step A: Attempt UUID matching on USER_ACCOUNT, BUSINESS_PROFILE, ARTIST
      for (const cand of candidateIds) {
        if (!isUuidStr(cand)) continue

        // 1. Try USER_ACCOUNT by ACCOUNT_ID
        if (!resolvedUserAccount) {
          const { data: uAcc, error: uErr } = await supabaseAdmin
            .from('USER_ACCOUNT')
            .select('ACCOUNT_ID, Username, Email, Profile_Picture, Strike_Count, Is_Banned, Is_Suspended')
            .eq('ACCOUNT_ID', cand)
            .maybeSingle()
          if (!uErr && uAcc) resolvedUserAccount = uAcc
        }

        // 2. Try BUSINESS_PROFILE by BUSINESS_ID or ACCOUNT_ID
        if (!resolvedBusiness) {
          const { data: bRow, error: bErr } = await supabaseAdmin
            .from('BUSINESS_PROFILE')
            .select('BUSINESS_ID, ACCOUNT_ID, Business_Name, Business_Bio, Business_Address, Profile_Picture')
            .or(`BUSINESS_ID.eq.${cand},ACCOUNT_ID.eq.${cand}`)
            .maybeSingle()
          if (!bErr && bRow) resolvedBusiness = bRow
        }

        // 3. Try ARTIST by ARTIST_ID or ACCOUNT_ID
        if (!resolvedArtist) {
          const { data: aRow, error: aErr } = await supabaseAdmin
            .from('ARTIST')
            .select('ARTIST_ID, ACCOUNT_ID, Artist_Type, SOLO_ARTIST(Artist_Name), BAND(Band_Name)')
            .or(`ARTIST_ID.eq.${cand},ACCOUNT_ID.eq.${cand}`)
            .maybeSingle()
          if (!aErr && aRow) resolvedArtist = aRow
        }

        if (resolvedUserAccount || resolvedBusiness || resolvedArtist) break
      }

      // Step B: If still not resolved, try string name/handle matching
      if (!resolvedUserAccount && !resolvedBusiness && !resolvedArtist) {
        const textCandidates: string[] = []
        if (targetName) textCandidates.push(targetName.replace(/^@/, '').trim())
        if (targetId && !isUuidStr(targetId)) textCandidates.push(targetId.replace(/^@/, '').trim())
        if (previewSnippet) {
          const pathSlug = previewSnippet.replace(/^\/(business|artist)\//, '').trim()
          if (pathSlug && !textCandidates.includes(pathSlug)) textCandidates.push(pathSlug)
        }

        for (const nameCand of textCandidates) {
          if (!nameCand) continue

          // 1. USER_ACCOUNT by Username
          if (!resolvedUserAccount) {
            const { data: uAcc } = await supabaseAdmin
              .from('USER_ACCOUNT')
              .select('ACCOUNT_ID, Username, Email, Profile_Picture, Strike_Count, Is_Banned, Is_Suspended')
              .ilike('Username', nameCand)
              .maybeSingle()
            if (uAcc) resolvedUserAccount = uAcc
          }

          // 2. BUSINESS_PROFILE by Business_Name
          if (!resolvedBusiness) {
            const { data: bRow } = await supabaseAdmin
              .from('BUSINESS_PROFILE')
              .select('BUSINESS_ID, ACCOUNT_ID, Business_Name, Business_Bio, Business_Address, Profile_Picture')
              .ilike('Business_Name', nameCand)
              .maybeSingle()
            if (bRow) resolvedBusiness = bRow
          }

          // 3. ARTIST by SOLO_ARTIST or BAND
          if (!resolvedArtist) {
            const { data: saRow } = await supabaseAdmin
              .from('SOLO_ARTIST')
              .select('ARTIST_ID, Artist_Name, ARTIST:ARTIST_ID(ARTIST_ID, ACCOUNT_ID, Artist_Type)')
              .ilike('Artist_Name', nameCand)
              .maybeSingle()
            if (saRow?.ARTIST) {
              resolvedArtist = saRow.ARTIST
            } else {
              const { data: bandRow } = await supabaseAdmin
                .from('BAND')
                .select('ARTIST_ID, Band_Name, ARTIST:ARTIST_ID(ARTIST_ID, ACCOUNT_ID, Artist_Type)')
                .ilike('Band_Name', nameCand)
                .maybeSingle()
              if (bandRow?.ARTIST) resolvedArtist = bandRow.ARTIST
            }
          }

          if (resolvedUserAccount || resolvedBusiness || resolvedArtist) break
        }
      }

      // Step C: Link primary Account ID and fill cross-entities
      const primaryAccountId = resolvedUserAccount?.ACCOUNT_ID || resolvedBusiness?.ACCOUNT_ID || resolvedArtist?.ACCOUNT_ID
      if (primaryAccountId) {
        if (!resolvedUserAccount) {
          const { data: uAcc } = await supabaseAdmin
            .from('USER_ACCOUNT')
            .select('ACCOUNT_ID, Username, Email, Profile_Picture, Strike_Count, Is_Banned, Is_Suspended')
            .eq('ACCOUNT_ID', primaryAccountId)
            .maybeSingle()
          if (uAcc) resolvedUserAccount = uAcc
        }
        if (!resolvedBusiness) {
          const { data: bRow } = await supabaseAdmin
            .from('BUSINESS_PROFILE')
            .select('BUSINESS_ID, ACCOUNT_ID, Business_Name, Business_Bio, Business_Address, Profile_Picture')
            .eq('ACCOUNT_ID', primaryAccountId)
            .maybeSingle()
          if (bRow) resolvedBusiness = bRow
        }
        if (!resolvedArtist) {
          const { data: aRow } = await supabaseAdmin
            .from('ARTIST')
            .select('ARTIST_ID, ACCOUNT_ID, Artist_Type, SOLO_ARTIST(Artist_Name), BAND(Band_Name)')
            .eq('ACCOUNT_ID', primaryAccountId)
            .maybeSingle()
          if (aRow) resolvedArtist = aRow
        }
      }

      targetAccountId = primaryAccountId || (isUuidStr(inputTargetAccountId) ? inputTargetAccountId : null) || (isUuidStr(targetId) ? targetId : null)
      targetBusinessId = resolvedBusiness?.BUSINESS_ID || null
      targetArtistId = resolvedArtist?.ARTIST_ID || null

      const artistName = resolvedArtist
        ? (resolvedArtist.Artist_Type === 'Band'
            ? (resolvedArtist.BAND?.[0]?.Band_Name || resolvedArtist.BAND?.Band_Name)
            : (resolvedArtist.SOLO_ARTIST?.[0]?.Artist_Name || resolvedArtist.SOLO_ARTIST?.Artist_Name))
        : null

      const displayName = resolvedBusiness?.Business_Name || artistName || resolvedUserAccount?.Username || targetName || 'Reported Profile'
      const username = resolvedUserAccount?.Username || null

      const defaultPublicPath = targetBusinessId
        ? `/business/${targetBusinessId}`
        : (username ? `/artist/${username}` : (targetAccountId ? `/user/${targetAccountId}` : '/'))

      evidenceSnapshot = {
        targetAccountId,
        targetBusinessId,
        targetArtistId,
        displayName,
        username,
        publicProfileUrl: previewSnippet || defaultPublicPath,
        profileType: targetBusinessId ? 'Business' : (targetArtistId ? 'Artist' : 'User'),
        bio: resolvedBusiness?.Business_Bio || null,
        profilePicture: resolvedBusiness?.Profile_Picture || resolvedUserAccount?.Profile_Picture || null,
        currentStrikes: resolvedUserAccount?.Strike_Count || 0,
        capturedAt: new Date().toISOString()
      }

      if (!targetAccountId) {
        console.error('[reports/create] Profile resolution failed for payload:', { targetId, inputTargetAccountId, targetName, previewSnippet })
        throw createError({ statusCode: 404, statusMessage: 'Reported profile not found.' })
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
