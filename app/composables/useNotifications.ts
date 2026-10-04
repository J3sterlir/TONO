import { ref, computed } from 'vue'

export interface NotificationItem {
  id: string
  title: string
  subtitle?: string
  time: string
  isUnread: boolean
  category: 'new' | 'earlier'
  type: string
  svgType: string
  avatarText: string
  avatarUrl?: string | null
  hasActions?: boolean
  actionPrimary?: string
  actionSecondary?: string
  entityId?: string
  entityType?: string
  actionLink?: string
  bandName?: string
  role?: string
  createdAt?: string
}

let realtimeChannel: any = null
let channelUserId: string | null = null
let activeSubscribers = 0

// Helper to compute abbreviated 2-letter uppercase initials
export const getTwoLetterInitials = (text?: string | null): string => {
  if (!text) return 'TO'
  const cleaned = text.trim()
  if (!cleaned) return 'TO'
  const words = cleaned.split(/\s+/)
  const w0 = words[0] || ''
  const w1 = words[1] || ''
  if (w0 && w1) {
    return (w0.charAt(0) + w1.charAt(0)).toUpperCase()
  }
  if (cleaned.length >= 2) {
    return cleaned.substring(0, 2).toUpperCase()
  }
  return cleaned.charAt(0).toUpperCase()
}

export const useNotifications = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any
  const user = useSupabaseUser()

  const notificationsList = useState<NotificationItem[]>('tono_notifications_list', () => [])
  const isLoading = useState<boolean>('tono_notifications_loading', () => false)
  const incomingAlert = useState<NotificationItem | null>('tono_notifications_incoming_alert', () => null)
  const filter = useState<'All' | 'Unread'>('tono_notifications_filter', () => 'All')

  // Robust User Account ID resolver (handles initial async auth hydration)
  const getUserId = async (): Promise<string | null> => {
    if (user.value?.id) return user.value.id
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        return data.user.id
      }
    } catch {
      // Non-blocking
    }
    return null
  }

  // Helper for human-readable relative time
  const formatRelativeTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'Just now'
    const now = new Date().getTime()
    const past = new Date(dateStr).getTime()
    const diffMs = now - past

    if (diffMs < 0) return 'Just now'
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}hr ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Transform raw Supabase row into standard NotificationItem (casing resilient)
  const mapRowToNotification = (row: any, senderAcc?: any): NotificationItem => {
    const rawIsRead = row.Is_Read !== undefined ? row.Is_Read : row.is_read
    const isUnread = rawIsRead !== undefined ? !rawIsRead : false
    const createdRaw = row.Created_At || row.created_at
    const created = createdRaw ? new Date(createdRaw).getTime() : Date.now()
    const hoursOld = (Date.now() - created) / (1000 * 60 * 60)
    const category: 'new' | 'earlier' = hoursOld < 24 ? 'new' : 'earlier'

    const meta = row.Metadata || row.metadata || {}
    const senderPic = senderAcc?.Profile_Picture || meta.avatar_url || meta.sender_avatar || meta.profile_picture || null
    const candidateName = senderAcc?.Username || meta.sender_name || meta.band_name || row.Avatar_Text || row.avatar_text || row.Title || 'TONO'
    const avatarText = getTwoLetterInitials(candidateName)

    return {
      id: row.Notification_ID || row.notification_id,
      title: row.Title || row.title || 'Notification',
      subtitle: row.Content || row.content || '',
      time: formatRelativeTime(createdRaw),
      isUnread,
      category,
      type: row.Type || row.type || 'system',
      svgType: row.Svg_Type || row.svg_type || 'job_posted',
      avatarText,
      avatarUrl: senderPic,
      hasActions: !!(
        row.Action_Primary || row.action_primary ||
        row.Action_Secondary || row.action_secondary
      ),
      actionPrimary: row.Action_Primary || row.action_primary || undefined,
      actionSecondary: row.Action_Secondary || row.action_secondary || undefined,
      entityId: row.Entity_ID || row.entity_id || undefined,
      entityType: row.Entity_Type || row.entity_type || undefined,
      actionLink: row.Action_Link || row.action_link || undefined,
      bandName: meta.band_name || undefined,
      role: meta.instrument_role || undefined,
      createdAt: createdRaw
    }
  }

  // Fetch initial notifications for current authenticated account
  const fetchNotifications = async () => {
    const userId = await getUserId()
    if (!userId) return
    isLoading.value = true

    try {
      const { data, error } = await db
        .from('NOTIFICATION')
        .select('*')
        .eq('Account_ID', userId)
        .order('Created_At', { ascending: false })
        .limit(60)

      if (error) {
        console.warn('Error fetching notifications:', error)
        return
      }

      if (data) {
        // Collect unique sender IDs to fetch real profile pictures in a batch
        const senderIds = Array.from(new Set(data.map((r: any) => r.Sender_Account_ID || r.sender_account_id).filter(Boolean)))
        const sendersMap = new Map<string, any>()
        if (senderIds.length > 0) {
          try {
            const { data: senders } = await db
              .from('USER_ACCOUNT')
              .select('ACCOUNT_ID, Username, Profile_Picture')
              .in('ACCOUNT_ID', senderIds)
            if (senders) {
              senders.forEach((s: any) => sendersMap.set(s.ACCOUNT_ID, s))
            }
          } catch (e) {
            console.warn('[useNotifications] Could not fetch senders for avatars:', e)
          }
        }

        // Collect band_invite items that still indicate actions
        const bandInvitesWithActions = data.filter((row: any) =>
          (row.Type === 'band_invite' || row.type === 'band_invite') &&
          (row.Action_Primary || row.action_primary) &&
          (row.Entity_ID || row.entity_id)
        )

        const resolvedStatuses = new Map<string, string>()
        if (bandInvitesWithActions.length > 0) {
          const bandIds = bandInvitesWithActions.map((r: any) => r.Entity_ID || r.entity_id)
          try {
            const { data: membersData } = await db
              .from('BAND_MEMBERS')
              .select('Band_ID, Status')
              .eq('Member_ID', userId)
              .in('Band_ID', bandIds)

            if (membersData) {
              for (const m of membersData) {
                resolvedStatuses.set(m.Band_ID, m.Status)
              }
            }
          } catch (e) {
            console.warn('[useNotifications] Could not verify band member statuses:', e)
          }
        }

        notificationsList.value = data.map((row: any) => {
          const sId = row.Sender_Account_ID || row.sender_account_id
          const sender = sId ? sendersMap.get(sId) : null
          const item = mapRowToNotification(row, sender)
          if (item.type === 'band_invite' && item.entityId && resolvedStatuses.has(item.entityId)) {
            const status = resolvedStatuses.get(item.entityId)
            if (status === 'Accepted' || status === 'Declined') {
              item.hasActions = false
              item.actionPrimary = undefined
              item.actionSecondary = undefined
              item.subtitle = status === 'Accepted'
                ? '✓ Invitation accepted! Welcome to the band.'
                : 'Invitation declined.'
            }
          }
          return item
        })
      }
    } catch (err) {
      console.error('Unexpected error loading notifications:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Subscribe to live Postgres changes via WebSockets
  const subscribeToRealtime = async () => {
    const userId = await getUserId()
    if (!userId) return

    activeSubscribers++

    // If channel is already actively listening for this exact user, keep it
    if (realtimeChannel && channelUserId && channelUserId.toLowerCase() === userId.toLowerCase()) {
      return
    }

    // Clean up any stale subscription channel
    if (realtimeChannel) {
      try {
        supabase.removeChannel(realtimeChannel)
      } catch {
        // Safe ignore
      }
      realtimeChannel = null
    }

    channelUserId = userId.toLowerCase()
    realtimeChannel = supabase
      .channel(`user-notifications-${userId.toLowerCase()}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'NOTIFICATION'
        },
        async (payload: any) => {
          const row = payload.new || payload.old
          const targetAccount = row?.Account_ID || row?.account_id
          // Only process notifications intended for this user (case-insensitive)
          if (targetAccount && String(targetAccount).toLowerCase() !== String(userId).toLowerCase()) return

          if (payload.eventType === 'INSERT') {
            const sId = payload.new?.Sender_Account_ID || payload.new?.sender_account_id
            let senderAcc: any = null
            if (sId) {
              try {
                const { data: sData } = await db
                  .from('USER_ACCOUNT')
                  .select('ACCOUNT_ID, Username, Profile_Picture')
                  .eq('ACCOUNT_ID', sId)
                  .maybeSingle()
                senderAcc = sData
              } catch {
                // Non-blocking
              }
            }

            const newItem = mapRowToNotification(payload.new, senderAcc)
            const existingIdx = notificationsList.value.findIndex(n => n.id === newItem.id)
            if (existingIdx === -1) {
              notificationsList.value.unshift(newItem)

              // Check if user is currently at /messages route (both window.location and vue-router)
              let isAtMessages = false
              try {
                if (typeof window !== 'undefined' && window.location?.pathname) {
                  isAtMessages = window.location.pathname.toLowerCase().startsWith('/messages')
                } else {
                  const route = useRoute()
                  isAtMessages = !!(route?.path && route.path.toLowerCase().startsWith('/messages'))
                }
              } catch {
                isAtMessages = false
              }

              // Completely disable floating toast alert banner when at /messages route
              if (!isAtMessages) {
                incomingAlert.value = newItem
                setTimeout(() => {
                  if (incomingAlert.value?.id === newItem.id) {
                    incomingAlert.value = null
                  }
                }, 4500)
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new
            const targetId = updated.Notification_ID || updated.notification_id
            const idx = notificationsList.value.findIndex(n => n.id === targetId)
            if (idx !== -1) {
              const item = notificationsList.value[idx]
              if (item) {
                const rawRead = updated.Is_Read !== undefined ? updated.Is_Read : updated.is_read
                item.isUnread = !rawRead
                if (updated.Content || updated.content) {
                  item.subtitle = updated.Content || updated.content
                }
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.Notification_ID || payload.old?.notification_id
            if (deletedId) {
              notificationsList.value = notificationsList.value.filter(n => n.id !== deletedId)
            }
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Live notification channel active for account:', userId)
        }
      })
  }

  // Cleanup subscription with reference counting
  const unsubscribe = () => {
    activeSubscribers = Math.max(0, activeSubscribers - 1)
    if (activeSubscribers === 0 && realtimeChannel) {
      try {
        supabase.removeChannel(realtimeChannel)
      } catch {
        // Safe ignore
      }
      realtimeChannel = null
      channelUserId = null
    }
  }

  // Mark single item as read
  const markAsRead = async (item: NotificationItem) => {
    if (!item.isUnread) return
    item.isUnread = false

    try {
      await db
        .from('NOTIFICATION')
        .update({ Is_Read: true })
        .eq('Notification_ID', item.id)
    } catch (err) {
      console.warn('Error marking notification as read:', err)
    }
  }

  // Mark all items as read
  const markAllAsRead = async () => {
    const userId = await getUserId()
    if (!userId) return
    const unreadIds = notificationsList.value.filter(n => n.isUnread).map(n => n.id)
    if (unreadIds.length === 0) return

    // Optimistic update
    notificationsList.value.forEach(n => { n.isUnread = false })

    try {
      await db
        .from('NOTIFICATION')
        .update({ Is_Read: true })
        .eq('Account_ID', userId)
        .eq('Is_Read', false)
    } catch (err) {
      console.warn('Error marking all notifications as read:', err)
    }
  }

  // Handle Band Membership Quick Action with Guard Rails
  const handleBandInvite = async (item: NotificationItem, accept: boolean) => {
    const userId = await getUserId()
    if (!userId || !item.entityId) return

    try {
      const newStatus = accept ? 'Accepted' : 'Declined'
      const updatePayload: any = { Status: newStatus }
      if (accept) {
        updatePayload.Joined_at = new Date().toISOString()
      }

      const { error } = await db
        .from('BAND_MEMBERS')
        .update(updatePayload)
        .eq('Band_ID', item.entityId)
        .eq('Member_ID', userId)

      if (error) throw error

      const newSubtitle = accept
        ? '✓ Invitation accepted! Welcome to the band.'
        : 'Invitation declined.'

      // Update in-memory notification item state immediately
      item.hasActions = false
      item.actionPrimary = undefined
      item.actionSecondary = undefined
      item.subtitle = newSubtitle
      item.isUnread = false

      // Persist to database so reload retains cleared action buttons permanently
      try {
        await db
          .from('NOTIFICATION')
          .update({
            Action_Primary: null,
            Action_Secondary: null,
            Content: newSubtitle,
            Is_Read: true,
          })
          .eq('Notification_ID', item.id)
      } catch (notifErr) {
        console.warn('Failed to update NOTIFICATION record action state:', notifErr)
        await markAsRead(item)
      }

      return { success: true }
    } catch (err: any) {
      console.error('Failed to update band membership status:', err)
      return { success: false, error: err.message }
    }
  }

  // Handle Contract Review Redirection
  const routeToContract = (item: NotificationItem, currentRole: string) => {
    markAsRead(item)

    const contractId = item.entityId
    if (!contractId && item.actionLink) {
      return navigateTo(item.actionLink)
    }

    if (currentRole === 'Artist') {
      return navigateTo(`/ArtistNavEvents?contractId=${contractId}`)
    } else if (currentRole === 'Business') {
      return navigateTo(`/BusinessContracts?contractId=${contractId}`)
    } else {
      return navigateTo(`/userprofile?tab=requests&contractId=${contractId}`)
    }
  }

  // Filtered views
  const unreadCount = computed(() => notificationsList.value.filter(n => n.isUnread).length)

  const filteredNotifications = computed(() => {
    if (filter.value === 'Unread') {
      return notificationsList.value.filter(n => n.isUnread)
    }
    return notificationsList.value
  })

  const newNotifications = computed(() => filteredNotifications.value.filter(n => n.category === 'new'))
  const earlierNotifications = computed(() => filteredNotifications.value.filter(n => n.category === 'earlier'))

  return {
    notificationsList,
    filteredNotifications,
    newNotifications,
    earlierNotifications,
    unreadCount,
    isLoading,
    incomingAlert,
    filter,
    getUserId,
    fetchNotifications,
    subscribeToRealtime,
    unsubscribe,
    markAsRead,
    markAllAsRead,
    handleBandInvite,
    routeToContract
  }
}
