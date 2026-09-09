export const useJobListings = () =>{
  const supabase = useSupabaseClient()

  const createJobListing = async (payload: {
    Event_Title: string
    Date?: string | null
    Time?: string | null
    Location?: string | null
    Description?: string | null
  }) => {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session?.access_token) {
      throw new Error('You must be logged in to create a job listing.')
    }

    const response = await $fetch('/api/job-listings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: payload
    })

    return response
  }

  return {
    createJobListing
  }
}