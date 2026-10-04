export default defineNuxtRouteMiddleware(async (to, from) => {
  const supabase = useSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (!user) {
    const redirectQuery =
      to.fullPath && to.fullPath !== '/' && to.fullPath !== '/Login'
        ? `?redirect=${encodeURIComponent(to.fullPath)}`
        : ''
    return navigateTo(`/Login${redirectQuery}`)
  }

  const { fetchCurrentUserProfile } = useTonoAuth()
  const profile = await fetchCurrentUserProfile(user.id)

  if (!profile) {
    return navigateTo('/Login')
  }

  if (profile.account?.Is_Banned && to.path !== '/banned') {
    return navigateTo('/banned')
  }

  // Guard: Users without an associated business profile cannot access Business Suite
  if (!profile.businessProfile) {
    return navigateTo('/userhome')
  }
})
