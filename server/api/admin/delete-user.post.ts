import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        const { userId } = body

        if (!userId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'User ID is required'
            })
        }

        // The user mentioned their SUPABASE_KEY acts as the service role key for them
        const supabaseUrl = process.env.SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_KEY

        if (!supabaseUrl || !supabaseKey) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Supabase credentials missing'
            })
        }

        // Create a Supabase client with the admin API
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Use the admin api to delete the user
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (error) {
            throw createError({
                statusCode: 400,
                statusMessage: error.message
            })
        }

        return { success: true, message: 'User permanently deleted', data }

    } catch (error: any) {
        return createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.message || 'Internal Server Error'
        })
    }
})
