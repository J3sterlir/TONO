export default defineNuxtRouteMiddleware(async (to, from) => {
    // Skip on server to avoid hydration mismatches if relying on client-side auth state
    if (import.meta.server) return

    const { fetchCurrentUserProfile } = useTonoAuth()
    const profile = await fetchCurrentUserProfile()

    if (!profile) {
        return navigateTo('/Login')
    }

    // Check if the user is an artist
    if (!profile.artistProfile) {
        return navigateTo('/userhome')
    }

    // Check if the artist is verified (Active)
    if (profile.artistProfile.Status !== 'Active') {
        return navigateTo('/artistverify')
    }
})
