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

  const isBanned = profile?.account?.Is_Banned === true
  const isSuspended =
    profile?.account?.Is_Suspended === true &&
    Boolean(profile?.account?.Suspended_Until) &&
    new Date(profile.account.Suspended_Until!).getTime() > Date.now()

  if (isBanned || isSuspended) {
    if (to.path !== '/banned') {
      return navigateTo('/banned')
    }
  } else {
    if (to.path === '/banned') {
      return navigateTo('/')
    }
  }
})

