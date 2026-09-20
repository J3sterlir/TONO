export default defineNuxtRouteMiddleware(async (to, from) => {
  const supabase = useSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (!user) {
    return navigateTo('/Login')
  }

  const { fetchCurrentUserProfile } = useTonoAuth()
  const profile = await fetchCurrentUserProfile(user.id)

  if (!profile) {
    return navigateTo('/Login')
  }

  if (profile.account?.Is_Banned && to.path !== '/banned') {
    return navigateTo('/banned')
  }

  // If the user has an artist profile, redirect them away from user-only routes
  if (profile.artistProfile) {
    if (profile.artistProfile.Status === 'Active') {
      return navigateTo('/Artisthome')
    } else {
      return navigateTo('/artistverify')
    }
  }
})
