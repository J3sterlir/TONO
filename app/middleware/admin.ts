export default defineNuxtRouteMiddleware(async (to) => {
  // Allow access to the admin auth page without redirect loop
  if (to.path === '/admin/auth') return

  const supabase = useSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id

  if (!userId) {
    return navigateTo('/admin/auth')
  }

  // Verify that the user exists in the ADMIN table
  const { data: admin, error } = await supabase
    .from('ADMIN')
    .select('ADMIN_ID')
    .eq('ADMIN_ID', userId)
    .maybeSingle()

  if (error || !admin) {
    return navigateTo('/admin/auth')
  }
})
