import { createClient } from '@supabase/supabase-js'

function isAnonKey(token: string): boolean {
    try {
        const parts = token.split('.')
        const payloadPart = parts[1]
        if (!payloadPart) return false
        const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'))
        return payload?.role === 'anon'
    } catch {
        return false
    }
}

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

        const supabaseUrl = process.env.SUPABASE_URL
        // Supabase Auth admin operations (like deleteUser) strictly require the service_role key
        const serviceKey = 
            process.env.SUPABASE_SERVICE_ROLE_KEY || 
            process.env.SUPABASE_SERVICE_KEY || 
            process.env.NUXT_SUPABASE_SECRET_KEY

        if (!supabaseUrl) {
            throw createError({
                statusCode: 500,
                statusMessage: 'SUPABASE_URL is missing in environment variables'
            })
        }

        if (!serviceKey) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Missing SUPABASE_SERVICE_ROLE_KEY in .env. Deleting users via Supabase Auth requires the service_role secret key from Supabase Dashboard (Project Settings > API).'
            })
        }

        if (isAnonKey(serviceKey)) {
            throw createError({
                statusCode: 500,
                statusMessage: "Invalid key: The key provided in SUPABASE_SERVICE_ROLE_KEY is an 'anon' public key. You must provide the 'service_role' secret key."
            })
        }

        // Create a Supabase client with the admin API
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
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
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || error.message || 'Internal Server Error'
        })
    }
})
