export default defineNuxtRouteMiddleware(async (to) => {
  // Allow access to the admin auth page without redirect loop
  if (to.path === '/admin/auth') return

  const user = useSupabaseUser()
  const supabase = useSupabaseClient()
  const db = supabase as any

  if (!user.value) {
    return navigateTo('/admin/auth')
  }

  // Verify that the user exists in the ADMIN table
  const { data: admin, error } = await db
    .from('ADMIN')
    .select('ADMIN_ID')
    .eq('ADMIN_ID', user.value.id)
    .maybeSingle()

  if (error || !admin) {
    return navigateTo('/admin/auth')
  }
})
