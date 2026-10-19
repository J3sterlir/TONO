import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const {
      reportId,
      action,
      targetAccountId,
      reason,
      penaltyScore = 0.5,
      suspensionUntil,
      adminNotes
    } = body

    if (!action) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Moderation action is required.'
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
        statusMessage: 'Supabase admin configuration missing.'
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Authenticate & authorize platform administrator
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

    if (!callerId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized. Administrator access required.'
      })
    }

    const { data: adminRecord } = await supabaseAdmin
      .from('ADMIN')
      .select('ADMIN_ID')
      .eq('ADMIN_ID', callerId)
      .maybeSingle()

    if (!adminRecord) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden. You do not have platform administrator privileges.'
      })
    }

    // Fetch report details if reportId provided
    let reportRow: any = null
    if (reportId) {
      const { data: rData } = await supabaseAdmin
        .from('USER_REPORT')
        .select('*')
        .eq('Report_ID', reportId)
        .maybeSingle()
      reportRow = rData
    }

    // Resolve target account if not explicitly passed
    const resolvedAccountId = targetAccountId || reportRow?.Target_Account_ID

    const officialReason = reason || adminNotes || 'Administrative moderation action.'

    // Execute designated action
    if (action === 'strike_1_warning') {
      if (!resolvedAccountId) throw createError({ statusCode: 400, statusMessage: 'Target Account ID required for strike.' })

      await supabaseAdmin
        .from('USER_ACCOUNT')
        .update({ Strike_Count: 1 })
        .eq('ACCOUNT_ID', resolvedAccountId)

      await supabaseAdmin.from('SANCTION_LOG').insert({
        Account_ID: resolvedAccountId,
        Report_ID: reportId || null,
        Issued_By_Admin_ID: callerId,
        Sanction_Type: 'Warning',
        Strike_Number: 1,
        Reason: officialReason,
        Is_Active: true,
        Created_At: new Date().toISOString()
      })

      await supabaseAdmin.from('NOTIFICATION').insert({
        Account_ID: resolvedAccountId,
        Type: 'moderation_warning',
        Content: `Official Community Warning (Strike 1 of 3): ${officialReason}`,
        Is_Read: false,
        Created_At: new Date().toISOString()
      })

      if (reportId) {
        await supabaseAdmin
          .from('USER_REPORT')
          .update({
            Is_Resolved: true,
            Action_Taken: 'Strike 1 (Warning)',
            Admin_Notes: officialReason,
            Resolved_By_Admin_ID: callerId,
            Resolved_At: new Date().toISOString()
          })
          .eq('Report_ID', reportId)
      }
    } else if (action === 'strike_2_penalty') {
      if (!resolvedAccountId) throw createError({ statusCode: 400, statusMessage: 'Target Account ID required for strike.' })

      const deduction = Number(penaltyScore) || 0.5

      // Fetch current penalty
      const { data: currAcc } = await supabaseAdmin
        .from('USER_ACCOUNT')
        .select('Penalty_Rating_Deduction, Strike_Count')
        .eq('ACCOUNT_ID', resolvedAccountId)
        .single()

      const currentPenalty = Number(currAcc?.Penalty_Rating_Deduction || 0)
      const newPenalty = Number((currentPenalty + deduction).toFixed(2))

      await supabaseAdmin
        .from('USER_ACCOUNT')
        .update({
          Strike_Count: 2,
          Penalty_Rating_Deduction: newPenalty
        })
        .eq('ACCOUNT_ID', resolvedAccountId)

      await supabaseAdmin.from('SANCTION_LOG').insert({
        Account_ID: resolvedAccountId,
        Report_ID: reportId || null,
        Issued_By_Admin_ID: callerId,
        Sanction_Type: 'Penalty_Deduction',
        Strike_Number: 2,
        Penalty_Score: deduction,
        Reason: officialReason,
        Is_Active: true,
        Created_At: new Date().toISOString()
      })

      await supabaseAdmin.from('NOTIFICATION').insert({
        Account_ID: resolvedAccountId,
        Type: 'moderation_penalty',
        Content: `Community Strike 2: A rating deduction of -${deduction} stars was applied to your profile. Reason: ${officialReason}`,
        Is_Read: false,
        Created_At: new Date().toISOString()
      })

      if (reportId) {
        await supabaseAdmin
          .from('USER_REPORT')
          .update({
            Is_Resolved: true,
            Action_Taken: `Strike 2 (Rating -${deduction})`,
            Admin_Notes: officialReason,
            Resolved_By_Admin_ID: callerId,
            Resolved_At: new Date().toISOString()
          })
          .eq('Report_ID', reportId)
      }
    } else if (action === 'strike_3_ban') {
      if (!resolvedAccountId) throw createError({ statusCode: 400, statusMessage: 'Target Account ID required for strike.' })

      await supabaseAdmin
        .from('USER_ACCOUNT')
        .update({
          Strike_Count: 3,
          Is_Banned: true,
          Ban_Reason: officialReason
        })
        .eq('ACCOUNT_ID', resolvedAccountId)

      await supabaseAdmin.from('SANCTION_LOG').insert({
        Account_ID: resolvedAccountId,
        Report_ID: reportId || null,
        Issued_By_Admin_ID: callerId,
        Sanction_Type: 'Ban',
        Strike_Number: 3,
        Reason: officialReason,
        Is_Active: true,
        Created_At: new Date().toISOString()
      })

      await supabaseAdmin.from('NOTIFICATION').insert({
        Account_ID: resolvedAccountId,
        Type: 'moderation_ban',
        Content: `Account Permanently Banned (Strike 3): ${officialReason}`,
        Is_Read: false,
        Created_At: new Date().toISOString()
      })

      if (reportId) {
        await supabaseAdmin
          .from('USER_REPORT')
          .update({
            Is_Resolved: true,
            Action_Taken: 'Strike 3 (Permanent Ban)',
            Admin_Notes: officialReason,
            Resolved_By_Admin_ID: callerId,
            Resolved_At: new Date().toISOString()
          })
          .eq('Report_ID', reportId)
      }
    } else if (action === 'suspend_user') {
      if (!resolvedAccountId) throw createError({ statusCode: 400, statusMessage: 'Target Account ID required.' })
      if (!suspensionUntil) throw createError({ statusCode: 400, statusMessage: 'Suspension expiration timestamp required.' })

      await supabaseAdmin
        .from('USER_ACCOUNT')
        .update({
          Is_Suspended: true,
          Suspended_Until: suspensionUntil,
          Suspension_Reason: officialReason
        })
        .eq('ACCOUNT_ID', resolvedAccountId)

      await supabaseAdmin.from('SANCTION_LOG').insert({
        Account_ID: resolvedAccountId,
        Report_ID: reportId || null,
        Issued_By_Admin_ID: callerId,
        Sanction_Type: 'Suspension',
        Expires_At: suspensionUntil,
        Reason: officialReason,
        Is_Active: true,
        Created_At: new Date().toISOString()
      })

      await supabaseAdmin.from('NOTIFICATION').insert({
        Account_ID: resolvedAccountId,
        Type: 'moderation_suspension',
        Content: `Account Suspended until ${new Date(suspensionUntil).toLocaleString()}. Reason: ${officialReason}`,
        Is_Read: false,
        Created_At: new Date().toISOString()
      })

      if (reportId) {
        await supabaseAdmin
          .from('USER_REPORT')
          .update({
            Is_Resolved: true,
            Action_Taken: `Suspended until ${new Date(suspensionUntil).toLocaleDateString()}`,
            Admin_Notes: officialReason,
            Resolved_By_Admin_ID: callerId,
            Resolved_At: new Date().toISOString()
          })
          .eq('Report_ID', reportId)
      }
    } else if (action === 'lift_sanction') {
      if (!resolvedAccountId) throw createError({ statusCode: 400, statusMessage: 'Target Account ID required.' })

      // Reset ban, suspension, contested status, and reset rating deduction
      await supabaseAdmin
        .from('USER_ACCOUNT')
        .update({
          Is_Banned: false,
          Is_Suspended: false,
          Suspended_Until: null,
          Ban_Reason: null,
          Suspension_Reason: null,
          Ban_Contested: false,
          Contest_Message: null,
          Penalty_Rating_Deduction: 0.0,
          Strike_Count: 0
        })
        .eq('ACCOUNT_ID', resolvedAccountId)

      // Deactivate past active sanctions
      await supabaseAdmin
        .from('SANCTION_LOG')
        .update({
          Is_Active: false,
          Lifting_Reason: officialReason,
          Lifted_At: new Date().toISOString()
        })
        .eq('Account_ID', resolvedAccountId)
        .eq('Is_Active', true)

      // Insert lifting record into SANCTION_LOG
      await supabaseAdmin.from('SANCTION_LOG').insert({
        Account_ID: resolvedAccountId,
        Report_ID: reportId || null,
        Issued_By_Admin_ID: callerId,
        Sanction_Type: 'Lifted',
        Reason: `Sanction Lifted: ${officialReason}`,
        Is_Active: false,
        Lifted_At: new Date().toISOString(),
        Created_At: new Date().toISOString()
      })

      // Send restoration notification
      await supabaseAdmin.from('NOTIFICATION').insert({
        Account_ID: resolvedAccountId,
        Type: 'moderation_restored',
        Content: `Your account sanctions have been lifted by administration. Reason: ${officialReason}`,
        Is_Read: false,
        Created_At: new Date().toISOString()
      })

      if (reportId) {
        await supabaseAdmin
          .from('USER_REPORT')
          .update({
            Is_Resolved: true,
            Action_Taken: 'Sanctions Lifted',
            Admin_Notes: officialReason,
            Resolved_By_Admin_ID: callerId,
            Resolved_At: new Date().toISOString()
          })
          .eq('Report_ID', reportId)
      }
    } else if (action === 'delete_content') {
      if (!reportRow) throw createError({ statusCode: 400, statusMessage: 'Report record required to delete content.' })

      if (reportRow.Target_Post_ID) {
        await supabaseAdmin
          .from('POST')
          .delete()
          .eq('POST_ID', reportRow.Target_Post_ID)
      } else if (reportRow.Target_Comment_ID) {
        await supabaseAdmin
          .from('POST_COMMENTS')
          .delete()
          .eq('Comment_ID', reportRow.Target_Comment_ID)
      } else if (reportRow.Target_Message_ID) {
        await supabaseAdmin
          .from('MESSAGE')
          .update({
            Is_Deleted: true,
            Content: 'This message was removed by platform moderation.',
            Deleted_At: new Date().toISOString()
          })
          .eq('Message_ID', reportRow.Target_Message_ID)
      }

      await supabaseAdmin
        .from('USER_REPORT')
        .update({
          Is_Resolved: true,
          Action_Taken: 'Content Deleted',
          Admin_Notes: officialReason,
          Resolved_By_Admin_ID: callerId,
          Resolved_At: new Date().toISOString()
        })
        .eq('Report_ID', reportId)
    } else if (action === 'resolve_bug') {
      if (!reportId) throw createError({ statusCode: 400, statusMessage: 'Report ID required.' })

      await supabaseAdmin
        .from('USER_REPORT')
        .update({
          Is_Resolved: true,
          Action_Taken: 'Resolved / Fixed',
          Admin_Notes: officialReason,
          Resolved_By_Admin_ID: callerId,
          Resolved_At: new Date().toISOString()
        })
        .eq('Report_ID', reportId)
    } else if (action === 'dismiss') {
      if (!reportId) throw createError({ statusCode: 400, statusMessage: 'Report ID required.' })

      await supabaseAdmin
        .from('USER_REPORT')
        .update({
          Is_Resolved: true,
          Action_Taken: 'Dismissed',
          Admin_Notes: officialReason || 'Dismissed without sanctions.',
          Resolved_By_Admin_ID: callerId,
          Resolved_At: new Date().toISOString()
        })
        .eq('Report_ID', reportId)
    } else {
      throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
    }

    return {
      success: true,
      message: `Action "${action}" successfully executed.`
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[admin/reports/action] Unexpected error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Error processing admin report action.'
    })
  }
})
