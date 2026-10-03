import { ref } from 'vue'
import { normalizeRole } from '~/utils/roleHelper'

export interface BandMemberItem {
  memberId: string
  artistId?: string | null
  artistName: string
  username: string
  profilePicture: string | null
  city?: string | null
  instrumentRole: string
  specialty?: string | null
  status: 'Accepted' | 'Pending' | 'Declined'
  invitedAt?: string | null
  joinedAt?: string | null
}

export interface VerifiedSoloArtistItem {
  accountId: string
  artistId: string
  artistName: string
  username: string
  profilePicture: string | null
  city?: string | null
  specialty?: string | null
  isVerified: boolean
}

export function useBandMembers() {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const members = ref<BandMemberItem[]>([])
  const verifiedSoloArtists = ref<VerifiedSoloArtistItem[]>([])
  const isLoading = ref(false)
  const isActionLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  /**
   * Fetch members of a band.
   * If includePending is true (for band owner/manager view), returns active members + pending invites.
   */
  const fetchBandMembers = async (bandId: string, includePending: boolean = false) => {
    if (!bandId) return []
    isLoading.value = true
    errorMessage.value = null

    try {
      const { data, error } = await db.rpc('get_band_members', {
        p_band_id: bandId,
        p_include_pending: includePending,
      })

      if (error) {
        console.warn('[useBandMembers] RPC get_band_members error, falling back:', error.message)
        // Fallback standard query
        const query = db
          .from('BAND_MEMBERS')
          .select(`
            Member_ID,
            Instrument_Role,
            Status,
            Invited_at,
            Joined_at,
            USER_ACCOUNT:Member_ID (
              ACCOUNT_ID,
              Username,
              Profile_Picture,
              City
            )
          `)
          .eq('Band_ID', bandId)

        if (!includePending) {
          query.eq('Status', 'Accepted')
        } else {
          query.in('Status', ['Accepted', 'Pending'])
        }

        const { data: fallbackData, error: fallbackError } = await query
        if (fallbackError) throw fallbackError

        const mapped: BandMemberItem[] = (fallbackData || []).map((row: any) => ({
          memberId: row.Member_ID,
          artistId: null,
          artistName: row.USER_ACCOUNT?.Username || 'Artist',
          username: row.USER_ACCOUNT?.Username || '',
          profilePicture: row.USER_ACCOUNT?.Profile_Picture || null,
          city: row.USER_ACCOUNT?.City || null,
          instrumentRole: normalizeRole(row.Instrument_Role) || 'Member',
          specialty: null,
          status: row.Status,
          invitedAt: row.Invited_at,
          joinedAt: row.Joined_at,
        }))

        members.value = mapped
        return mapped
      }

      const mapped: BandMemberItem[] = (data || []).map((row: any) => ({
        memberId: row.member_id,
        artistId: row.artist_id,
        artistName: row.artist_name || row.username || 'Artist',
        username: row.username || '',
        profilePicture: row.profile_picture || null,
        city: row.city || null,
        instrumentRole: normalizeRole(row.instrument_role) || 'Member',
        specialty: row.specialty || null,
        status: row.status,
        invitedAt: row.invited_at,
        joinedAt: row.joined_at,
      }))

      members.value = mapped
      return mapped
    } catch (err: any) {
      console.error('[useBandMembers] Failed to fetch band members:', err)
      errorMessage.value = err.message || 'Failed to load band members.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch all verified solo artists available on TONO for invitation.
   */
  const fetchVerifiedSoloArtists = async () => {
    isLoading.value = true
    errorMessage.value = null

    try {
      const { data, error } = await db.rpc('get_verified_solo_artists')

      if (error) {
        console.warn('[useBandMembers] RPC get_verified_solo_artists error, falling back:', error.message)
        const { data: fallbackData, error: fallbackError } = await db
          .from('ARTIST')
          .select(`
            ACCOUNT_ID,
            ARTIST_ID,
            Is_Verified,
            SOLO_ARTIST (
              Artist_Name,
              Specialty
            ),
            USER_ACCOUNT (
              Username,
              Profile_Picture,
              City
            )
          `)
          .eq('Artist_Type', 'Solo')
          .eq('Is_Verified', true)

        if (fallbackError) throw fallbackError

        const mapped: VerifiedSoloArtistItem[] = (fallbackData || []).map((row: any) => ({
          accountId: row.ACCOUNT_ID,
          artistId: row.ARTIST_ID,
          artistName: row.SOLO_ARTIST?.Artist_Name || row.USER_ACCOUNT?.Username || 'Artist',
          username: row.USER_ACCOUNT?.Username || '',
          profilePicture: row.USER_ACCOUNT?.Profile_Picture || null,
          city: row.USER_ACCOUNT?.City || null,
          specialty: row.SOLO_ARTIST?.Specialty || null,
          isVerified: !!row.Is_Verified,
        }))

        verifiedSoloArtists.value = mapped
        return mapped
      }

      const mapped: VerifiedSoloArtistItem[] = (data || []).map((row: any) => ({
        accountId: row.account_id,
        artistId: row.artist_id,
        artistName: row.artist_name,
        username: row.username,
        profilePicture: row.profile_picture,
        city: row.city,
        specialty: row.specialty,
        isVerified: !!row.is_verified,
      }))

      verifiedSoloArtists.value = mapped
      return mapped
    } catch (err: any) {
      console.error('[useBandMembers] Failed to fetch verified solo artists:', err)
      errorMessage.value = err.message || 'Failed to load verified solo artists.'
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Send an invitation to a verified solo artist with role normalization.
   */
  const inviteMember = async (bandId: string, memberAccountId: string, role: string) => {
    isActionLoading.value = true
    errorMessage.value = null

    try {
      const normalizedRole = normalizeRole(role) || 'Member'

      const { data, error } = await db.rpc('invite_band_member', {
        p_band_id: bandId,
        p_member_account_id: memberAccountId,
        p_role: normalizedRole,
      })

      if (error) {
        // Fallback upsert if RPC fails
        console.warn('[useBandMembers] RPC invite_band_member failed, trying upsert fallback:', error.message)
        const { error: upsertErr } = await db
          .from('BAND_MEMBERS')
          .upsert({
            Band_ID: bandId,
            Member_ID: memberAccountId,
            Instrument_Role: normalizedRole,
            Status: 'Pending',
            Invited_at: new Date().toISOString(),
          }, { onConflict: 'Band_ID,Member_ID' })

        if (upsertErr) throw upsertErr
      }

      // Refresh members list
      await fetchBandMembers(bandId, true)
      return { success: true, role: normalizedRole }
    } catch (err: any) {
      console.error('[useBandMembers] Error inviting member:', err)
      errorMessage.value = err.message || 'Failed to send invitation.'
      return { success: false, error: err.message || 'Failed to send invitation.' }
    } finally {
      isActionLoading.value = false
    }
  }

  /**
   * Remove an active member or revoke a pending invitation.
   */
  const removeMember = async (bandId: string, memberAccountId: string) => {
    isActionLoading.value = true
    errorMessage.value = null

    try {
      const { data, error } = await db.rpc('remove_band_member', {
        p_band_id: bandId,
        p_member_account_id: memberAccountId,
      })

      if (error) {
        console.warn('[useBandMembers] RPC remove_band_member failed, trying delete fallback:', error.message)
        const { error: delErr } = await db
          .from('BAND_MEMBERS')
          .delete()
          .eq('Band_ID', bandId)
          .eq('Member_ID', memberAccountId)

        if (delErr) throw delErr
      }

      // Optimistically filter out or refresh
      members.value = members.value.filter(m => m.memberId !== memberAccountId)
      await fetchBandMembers(bandId, true)
      return { success: true }
    } catch (err: any) {
      console.error('[useBandMembers] Error removing member:', err)
      errorMessage.value = err.message || 'Failed to remove member.'
      return { success: false, error: err.message || 'Failed to remove member.' }
    } finally {
      isActionLoading.value = false
    }
  }

  /**
   * Setup realtime subscription on BAND_MEMBERS table for reactive UI updates
   */
  const subscribeToBandMembersRealtime = (bandId: string, onUpdate: () => void) => {
    if (!bandId) return () => {}

    const channelName = `band-members-realtime-${bandId}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'BAND_MEMBERS',
          filter: `Band_ID=eq.${bandId}`,
        },
        () => {
          onUpdate()
        }
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (err) {
        console.warn('[useBandMembers] Error cleaning up channel:', err)
      }
    }
  }

  return {
    members,
    verifiedSoloArtists,
    isLoading,
    isActionLoading,
    errorMessage,
    fetchBandMembers,
    fetchVerifiedSoloArtists,
    inviteMember,
    removeMember,
    subscribeToBandMembersRealtime,
  }
}
