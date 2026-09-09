import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
    try {
        // --------------------------------------------------
        // 1. Get authenticated user from Supabase token
        // --------------------------------------------------
        const authHeader = getHeader(event, 'authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Authentication required'
            })
        }

        const token = authHeader.replace('Bearer ', '')

        const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY

        if (!supabaseUrl || !supabaseKey) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Supabase credentials missing'
            })
        }

        // Client using the user's access token
        const supabase = createClient(
            supabaseUrl,
            supabaseKey,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                },
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser(token)

        if (authError || !user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid or expired authentication token'
            })
        }

        // --------------------------------------------------
        // 2. Read request body
        // --------------------------------------------------
        const body = await readBody(event)

        const {
            Event_Title,
            Date,
            Time,
            Location,
            Description
        } = body

        // --------------------------------------------------
        // 3. Validate required fields
        // --------------------------------------------------
        if (!Event_Title || !Event_Title.trim()) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Event title is required'
            })
        }

        // --------------------------------------------------
        // 4. Find the business profile belonging to user
        // --------------------------------------------------
        const { data: business, error: businessError } = await supabase
            .from('BUSINESS_PROFILE')
            .select('BUSINESS_ID')
            .eq('ACCOUNT_ID', user.id)
            .single()

        if (businessError || !business) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Business profile not found'
            })
        }

        // --------------------------------------------------
        // 5. Create Job Listing
        // --------------------------------------------------
        const { data: jobListing, error: insertError } = await supabase
            .from('JOB_LISTING')
            .insert({
                Posted_By_BUSINESS_ID: business.BUSINESS_ID,
                Event_Title: Event_Title.trim(),
                Date: Date || null,
                Time: Time || null,
                Location: Location || null,
                Description: Description || null,
                Status: 'Open'
            })
            .select()
            .single()

        if (insertError) {
            throw createError({
                statusCode: 400,
                statusMessage: insertError.message
            })
        }

        // --------------------------------------------------
        // 6. Return created listing
        // --------------------------------------------------
        return {
            success: true,
            message: 'Job listing created successfully',
            data: jobListing
        }

    } catch (error: any) {
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage:
                error.statusMessage ||
                error.message ||
                'Internal Server Error'
        })
    }
})