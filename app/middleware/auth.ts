export default defineNuxtRouteMiddleware(async (to, from) => {
  const supabase = useSupabaseClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (!user) {
    return navigateTo('/Login')
  }

  const { fetchCurrentUserProfile } = useTonoAuth()
  const profile = await fetchCurrentUserProfile(user.id)

  if (profile && profile.account?.Is_Banned) {
    if (to.path !== '/banned') {
      return navigateTo('/banned')
    }
  } else {
    if (to.path === '/banned') {
      return navigateTo('/')
    }
  }
})

