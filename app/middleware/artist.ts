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

  if (!profile.artistProfile) {
    return navigateTo('/userhome')
  }

  if (profile.artistProfile.Status !== 'Active') {
    return navigateTo('/artistverify')
  }
})
