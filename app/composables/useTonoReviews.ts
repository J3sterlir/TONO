import { ref } from 'vue'

export interface ProfileRatingData {
  total_reviews: number
  raw_avg_rating: number | null
  final_rating: number | null
  Penalty_Rating_Deduction: number | null
}

export interface FeedbackReviewItem {
  Review_ID: string
  Reviewer_Account_ID: string
  Target_Artist_ID?: string | null
  Target_Business_ID?: string | null
  Target_Account_ID?: string | null
  Booking_ID?: string | null
  Rating_Score: number
  Written_Feedback?: string | null
  Created_At: string
  Reviewer?: {
    Username: string
    Profile_Picture?: string | null
  } | null
  Booking?: {
    Contract_Code?: string | null
    Event_Date?: string | null
    Start_Date?: string | null
    Venue_Location?: string | null
    JOB_LISTING?: {
      Event_Title?: string | null
    } | null
  } | null
}

export const useTonoReviews = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchRatingForAccount = async (accountId: string): Promise<ProfileRatingData | null> => {
    if (!accountId) return null
    try {
      const { data, error: err } = await db
        .from('profile_ratings')
        .select('total_reviews, raw_avg_rating, final_rating, Penalty_Rating_Deduction')
        .eq('ACCOUNT_ID', accountId)
        .maybeSingle()

      if (err) throw err
      return data || { total_reviews: 0, raw_avg_rating: null, final_rating: null, Penalty_Rating_Deduction: 0 }
    } catch (e: any) {
      console.warn('[useTonoReviews] Error fetching account rating:', e)
      return null
    }
  }

  const fetchRatingForArtist = async (artistId: string): Promise<ProfileRatingData | null> => {
    if (!artistId) return null
    try {
      const { data, error: err } = await db
        .from('artist_ratings')
        .select('total_reviews, raw_avg_rating, final_rating, Penalty_Rating_Deduction')
        .eq('ARTIST_ID', artistId)
        .maybeSingle()

      if (err) throw err
      return data || { total_reviews: 0, raw_avg_rating: null, final_rating: null, Penalty_Rating_Deduction: 0 }
    } catch (e: any) {
      console.warn('[useTonoReviews] Error fetching artist rating:', e)
      return null
    }
  }

  const fetchRatingForBusiness = async (businessId: string): Promise<ProfileRatingData | null> => {
    if (!businessId) return null
    try {
      const { data, error: err } = await db
        .from('business_ratings')
        .select('total_reviews, raw_avg_rating, final_rating, Penalty_Rating_Deduction')
        .eq('BUSINESS_ID', businessId)
        .maybeSingle()

      if (err) throw err
      return data || { total_reviews: 0, raw_avg_rating: null, final_rating: null, Penalty_Rating_Deduction: 0 }
    } catch (e: any) {
      console.warn('[useTonoReviews] Error fetching business rating:', e)
      return null
    }
  }

  const fetchReviewsForTarget = async (params: {
    artistId?: string
    businessId?: string
    accountId?: string
  }): Promise<FeedbackReviewItem[]> => {
    isLoading.value = true
    error.value = null
    try {
      let query = db
        .from('FEEDBACK_REVIEW')
        .select(`
          Review_ID,
          Reviewer_Account_ID,
          Target_Artist_ID,
          Target_Business_ID,
          Target_Account_ID,
          Booking_ID,
          Rating_Score,
          Written_Feedback,
          Created_At,
          Reviewer:Reviewer_Account_ID (
            Username,
            Profile_Picture
          ),
          Booking:Booking_ID (
            Contract_Code,
            Event_Date,
            Start_Date,
            Venue_Location,
            JOB_LISTING (
              Event_Title
            )
          )
        `)
        .order('Created_At', { ascending: false })

      if (params.artistId) {
        query = query.eq('Target_Artist_ID', params.artistId)
      } else if (params.businessId) {
        query = query.eq('Target_Business_ID', params.businessId)
      } else if (params.accountId) {
        query = query.eq('Target_Account_ID', params.accountId)
      } else {
        return []
      }

      const { data, error: fetchErr } = await query
      if (fetchErr) throw fetchErr

      return (data || []) as FeedbackReviewItem[]
    } catch (e: any) {
      console.error('[useTonoReviews] Error fetching reviews:', e)
      error.value = e.message || 'Failed to fetch reviews'
      return []
    } finally {
      isLoading.value = false
    }
  }

  const hasUserReviewed = async (bookingId: string, reviewerAccountId: string): Promise<boolean> => {
    if (!bookingId || !reviewerAccountId) return false
    try {
      const { data, error: err } = await db
        .from('FEEDBACK_REVIEW')
        .select('Review_ID')
        .eq('Booking_ID', bookingId)
        .eq('Reviewer_Account_ID', reviewerAccountId)
        .maybeSingle()

      if (err) throw err
      return !!data
    } catch (e) {
      return false
    }
  }

  const submitReview = async (payload: {
    bookingId?: string | null
    reviewerAccountId: string
    targetArtistId?: string | null
    targetBusinessId?: string | null
    targetAccountId?: string | null
    ratingScore: number
    writtenFeedback?: string | null
  }) => {
    isLoading.value = true
    error.value = null

    try {
      const insertPayload = {
        Booking_ID: payload.bookingId || null,
        Reviewer_Account_ID: payload.reviewerAccountId,
        Target_Artist_ID: payload.targetArtistId || null,
        Target_Business_ID: payload.targetBusinessId || null,
        Target_Account_ID: payload.targetAccountId || null,
        Rating_Score: Number(payload.ratingScore),
        Written_Feedback: payload.writtenFeedback?.trim() || null
      }

      const { data, error: insertErr } = await db
        .from('FEEDBACK_REVIEW')
        .insert(insertPayload)
        .select()
        .single()

      if (insertErr) throw insertErr
      return data
    } catch (e: any) {
      console.error('[useTonoReviews] Error submitting review:', e)
      error.value = e.message || 'Failed to submit review'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    fetchRatingForAccount,
    fetchRatingForArtist,
    fetchRatingForBusiness,
    fetchReviewsForTarget,
    hasUserReviewed,
    submitReview
  }
}
