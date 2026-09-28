import { createClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        const { userId, username, email } = body

        if (!userId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'User ID is required'
            })
        }

        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = 
            process.env.SUPABASE_SERVICE_ROLE_KEY || 
            process.env.SUPABASE_SERVICE_KEY || 
            process.env.NUXT_SUPABASE_SECRET_KEY

        if (!supabaseUrl || !serviceKey) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Supabase admin configuration missing'
            })
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // 1. Authenticate caller (session cookie or Bearer token)
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
                statusMessage: 'Unauthorized: Admin authentication required.'
            })
        }

        // 2. Authorize caller against ADMIN table
        const { data: adminRecord, error: adminCheckError } = await supabaseAdmin
            .from('ADMIN')
            .select('ADMIN_ID')
            .eq('ADMIN_ID', callerId)
            .maybeSingle()

        if (adminCheckError || !adminRecord) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: Caller is not an administrator.'
            })
        }

        // 3. Update Supabase Auth email if an email was provided
        if (email) {
            const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                email: email.trim(),
                email_confirm: true
            })

            if (authUpdateError) {
                throw createError({
                    statusCode: 400,
                    statusMessage: `Failed to update auth email: ${authUpdateError.message}`
                })
            }
        }

        // 4. Update USER_ACCOUNT record
        const updates: Record<string, any> = {}
        if (username) updates.Username = username.trim()
        if (email) updates.Email = email.trim()

        if (Object.keys(updates).length > 0) {
            const { error: dbError } = await supabaseAdmin
                .from('USER_ACCOUNT')
                .update(updates)
                .eq('ACCOUNT_ID', userId)

            if (dbError) {
                throw createError({
                    statusCode: 400,
                    statusMessage: `Failed to update profile: ${dbError.message}`
                })
            }
        }

        return { success: true, message: 'User updated successfully' }

    } catch (error: any) {
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || error.message || 'Internal Server Error'
        })
    }
})
