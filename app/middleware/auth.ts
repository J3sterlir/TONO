export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return

  const user = useSupabaseUser()
  const { fetchCurrentUserProfile } = useTonoAuth()
  
  if (!user.value) {
    return navigateTo('/Login')
  }

  const profile = await fetchCurrentUserProfile()
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
