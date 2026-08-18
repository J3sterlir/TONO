export type AdminProfile = {
  ADMIN_ID: string
  Username: string
  Email: string
  Created_at?: string | null
}

export const useAdminAuth = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const signInAdmin = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError) throw authError
    const userId = authData.user?.id
    if (!userId) throw new Error('No user returned.')

    // 2. Verify that this user exists in the ADMIN table
    const { data: adminProfile, error: adminError } = await db
      .from('ADMIN')
      .select('*')
      .eq('ADMIN_ID', userId)
      .maybeSingle()

    if (adminError || !adminProfile) {
      // Immediately sign out if not found in ADMIN table
      await supabase.auth.signOut()
      throw new Error('Access denied: You do not have admin permissions.')
    }

    return {
      user: authData.user,
      adminProfile: adminProfile as AdminProfile,
    }
  }

  const signOutAdmin = async () => {
    await supabase.auth.signOut()
    await navigateTo('/admin/auth')
  }

  const fetchCurrentAdmin = async (): Promise<AdminProfile | null> => {
    const { data: authUserData } = await supabase.auth.getUser()
    const userId = authUserData.user?.id
    if (!userId) return null

    const { data: adminProfile, error } = await db
      .from('ADMIN')
      .select('*')
      .eq('ADMIN_ID', userId)
      .maybeSingle()

    if (error || !adminProfile) return null
    return adminProfile as AdminProfile
  }

  return {
    signInAdmin,
    signOutAdmin,
    fetchCurrentAdmin,
  }
}
