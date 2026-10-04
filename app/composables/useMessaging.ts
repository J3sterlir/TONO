import { ref, computed } from 'vue'
import { optimizeChatMessageImage } from '~/utils/imageOptimizer'
import { getTwoLetterInitials } from '~/composables/useNotifications'

export interface MessageAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
}

export interface LinkPreviewData {
  url: string
  title: string
  description?: string
  image?: string
  site_name?: string
}

export interface MessageItem {
  id: string
  threadId: string
  senderId: string
  content: string
  isRead: boolean
  isEdited: boolean
  editedAt?: string | null
  isDeleted: boolean
  deletedAt?: string | null
  attachments: MessageAttachment[]
  metadata: {
    link_preview?: LinkPreviewData
    [key: string]: any
  }
  createdAt: string
  isMine: boolean
  canEditOrUnsend: boolean
  remainingMinutes: number
}

export interface ConversationParticipant {
  accountId: string
  username: string
  displayName: string
  avatarUrl?: string | null
  isArtist: boolean
  artistType?: string | null
  isVerified?: boolean
  isOnline: boolean
  lastActiveAt?: string | null
}

export interface ConversationThread {
  threadId: string
  participant: ConversationParticipant
  lastMessageSnippet: string
  lastMessageAt: string
  lastMessageSenderId?: string | null
  unreadCount: number
}

let chatRealtimeChannel: any = null
let presenceHeartbeatTimer: any = null
const onlineUserIds = ref<Set<string>>(new Set())

export const useMessaging = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any
  const user = useSupabaseUser()

  const threads = useState<ConversationThread[]>('tono_chat_threads', () => [])
  const activeThread = useState<ConversationThread | null>('tono_chat_active_thread', () => null)
  const messages = useState<MessageItem[]>('tono_chat_messages', () => [])
  const isLoadingThreads = useState<boolean>('tono_chat_loading_threads', () => false)
  const isLoadingMessages = useState<boolean>('tono_chat_loading_messages', () => false)
  const isSending = ref(false)
  const errorMessage = ref<string | null>(null)

  // Current logged in user ID
  const currentUserId = computed(() => user.value?.id || null)

  // Robust User Account ID resolver (handles async session & cookie hydration)
  const getUserId = async (): Promise<string | null> => {
    if (user.value?.id) return user.value.id
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user?.id) {
        return sessionData.session.user.id
      }
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) {
        return userData.user.id
      }
    } catch {
      // Non-blocking
    }
    return null
  }

  // Total unread messages across all conversations
  const totalUnreadCount = computed(() => {
    return threads.value.reduce((sum, t) => sum + (t.unreadCount || 0), 0)
  })

  // Format relative timestamp helper
  const formatTimeAgo = (dateStr?: string | null): string => {
    if (!dateStr) return 'Just now'
    const now = Date.now()
    const past = new Date(dateStr).getTime()
    const diffSec = Math.floor((now - past) / 1000)

    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Format clock time for message bubbles (e.g. 11:42 AM)
  const formatClockTime = (dateStr?: string | null): string => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  // Determine if a user is online via live Presence or recent activity
  const isUserOnline = (accountId?: string | null, lastActiveAt?: string | null): boolean => {
    if (!accountId) return false
    const lower = String(accountId).toLowerCase()
    // 1. Live presence connection match
    if (onlineUserIds.value.has(lower)) {
      return true
    }
    // 2. Active in session within the last 5 minutes
    if (lastActiveAt) {
      const elapsed = Date.now() - new Date(lastActiveAt).getTime()
      if (!isNaN(elapsed) && elapsed >= 0 && elapsed < 5 * 60 * 1000) {
        return true
      }
    }
    return false
  }

  // Sync isOnline across activeThread and thread list
  const syncOnlineStatuses = () => {
    threads.value.forEach((t) => {
      t.participant.isOnline = isUserOnline(t.participant.accountId, t.participant.lastActiveAt)
    })
    if (activeThread.value) {
      activeThread.value.participant.isOnline = isUserOnline(
        activeThread.value.participant.accountId,
        activeThread.value.participant.lastActiveAt
      )
    }
  }

  // Format last active subtitle (e.g. 'Online', 'Active 5m ago', 'Active yesterday', 'Offline')
  const formatLastActive = (participant?: ConversationParticipant | null): string => {
    if (!participant) return 'Offline'
    if (participant.isOnline) {
      return 'Online'
    }
    if (!participant.lastActiveAt) {
      return 'Offline'
    }
    const now = Date.now()
    const past = new Date(participant.lastActiveAt).getTime()
    const diffSec = Math.floor((now - past) / 1000)

    if (isNaN(diffSec) || diffSec < 0) return 'Offline'
    if (diffSec < 60) return 'Active just now'

    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `Active ${diffMin}m ago`

    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `Active ${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Active yesterday'
    if (diffDays < 7) return `Active ${diffDays}d ago`

    return `Active ${new Date(participant.lastActiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  // Record user activity timestamp in database (on login/connect/heartbeat)
  const recordUserActivity = async (userIdOverride?: string) => {
    try {
      const uid = userIdOverride || (await getUserId())
      if (!uid) return

      const { error: rpcErr } = await db.rpc('update_user_last_active')
      if (rpcErr) {
        await db
          .from('USER_ACCOUNT')
          .update({ Last_Active_At: new Date().toISOString() })
          .eq('ACCOUNT_ID', uid)
      }
    } catch {
      // Non-blocking
    }
  }

  // Map raw database row to client MessageItem
  const mapRowToMessage = (row: any, myId: string | null): MessageItem => {
    const senderId = row.Sender_ID || row.sender_id
    const isMine = !!(myId && senderId === myId)
    const createdAt = row.Created_at || row.created_at || new Date().toISOString()
    const isDeleted = !!(row.Is_Deleted ?? row.is_deleted ?? false)
    const isEdited = !!(row.Is_Edited ?? row.is_edited ?? false)

    // Calculate remaining edit/unsend window (10 minutes = 600,000 ms)
    const elapsedMs = Date.now() - new Date(createdAt).getTime()
    const remainingMs = Math.max(0, 10 * 60 * 1000 - elapsedMs)
    const canEditOrUnsend = isMine && !isDeleted && remainingMs > 0
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))

    let attachments: MessageAttachment[] = []
    const rawAttachments = row.Attachments || row.attachments
    if (Array.isArray(rawAttachments)) {
      attachments = rawAttachments
    } else if (typeof rawAttachments === 'string') {
      try {
        attachments = JSON.parse(rawAttachments)
      } catch {
        attachments = []
      }
    }

    let metadata: any = {}
    const rawMeta = row.Metadata || row.metadata
    if (typeof rawMeta === 'object' && rawMeta !== null) {
      metadata = rawMeta
    } else if (typeof rawMeta === 'string') {
      try {
        metadata = JSON.parse(rawMeta)
      } catch {
        metadata = {}
      }
    }

    return {
      id: row.Message_ID || row.message_id,
      threadId: row.Thread_ID || row.thread_id,
      senderId,
      content: isDeleted ? 'This message was unsent' : (row.Content || row.content || ''),
      isRead: !!(row.Is_Read ?? row.is_read ?? false),
      isEdited,
      editedAt: row.Edited_At || row.edited_at || null,
      isDeleted,
      deletedAt: row.Deleted_At || row.deleted_at || null,
      attachments: isDeleted ? [] : attachments,
      metadata: isDeleted ? {} : metadata,
      createdAt,
      isMine,
      canEditOrUnsend,
      remainingMinutes,
    }
  }

  // 1. Fetch all threads for current user
  const fetchThreads = async () => {
    const uid = await getUserId()
    if (!uid) return

    isLoadingThreads.value = true
    errorMessage.value = null

    try {
      // Fetch threads where user is Participant_1 or Participant_2
      const { data: rawThreads, error: threadsErr } = await db
        .from('MESSAGE_THREAD')
        .select(`
          Thread_ID,
          Participant_1_ID,
          Participant_2_ID,
          Last_Updated,
          Last_Message_Snippet,
          Last_Message_Sender_ID,
          Last_Message_At
        `)
        .or(`Participant_1_ID.eq.${uid},Participant_2_ID.eq.${uid}`)
        .order('Last_Message_At', { ascending: false, nullsFirst: false })

      if (threadsErr) throw threadsErr
      if (!rawThreads || rawThreads.length === 0) {
        threads.value = []
        return
      }

      // Collect other participant IDs
      const otherUserIds = Array.from(
        new Set(
          rawThreads.map((t: any) => {
            const isP1 = t.Participant_1_ID && uid && String(t.Participant_1_ID).toLowerCase() === String(uid).toLowerCase()
            return isP1 ? t.Participant_2_ID : t.Participant_1_ID
          })
        )
      )

      // Fetch user accounts for other participants
      let userAccounts: any[] = []
      try {
        const { data, error } = await db
          .from('USER_ACCOUNT')
          .select('ACCOUNT_ID, Username, Profile_Picture, Last_Active_At')
          .in('ACCOUNT_ID', otherUserIds)
        if (error) throw error
        userAccounts = data || []
      } catch {
        const { data } = await db
          .from('USER_ACCOUNT')
          .select('ACCOUNT_ID, Username, Profile_Picture')
          .in('ACCOUNT_ID', otherUserIds)
        userAccounts = data || []
      }

      // Fetch artist profiles for other participants to get display names & badges
      const { data: artists } = await db
        .from('ARTIST')
        .select(`
          ACCOUNT_ID,
          Artist_Type,
          Is_Verified,
          SOLO_ARTIST ( Artist_Name ),
          BAND ( Band_Name )
        `)
        .in('ACCOUNT_ID', otherUserIds)

      // Fetch unread messages count per thread
      const { data: unreadMessages } = await db
        .from('MESSAGE')
        .select('Thread_ID')
        .eq('Is_Read', false)
        .neq('Sender_ID', uid)
        .in('Thread_ID', rawThreads.map((t: any) => t.Thread_ID))

      const unreadCountMap: Record<string, number> = {}
      if (unreadMessages) {
        unreadMessages.forEach((m: any) => {
          unreadCountMap[m.Thread_ID] = (unreadCountMap[m.Thread_ID] || 0) + 1
        })
      }

      const usersMap = new Map((userAccounts || []).map((u: any) => [String(u.ACCOUNT_ID).toLowerCase(), u]))
      const artistsMap = new Map((artists || []).map((a: any) => [String(a.ACCOUNT_ID).toLowerCase(), a]))

      const mappedThreads: ConversationThread[] = rawThreads.map((t: any) => {
        const isP1 = t.Participant_1_ID && uid && String(t.Participant_1_ID).toLowerCase() === String(uid).toLowerCase()
        const otherId = isP1 ? t.Participant_2_ID : t.Participant_1_ID
        const userAcc: any = usersMap.get(String(otherId).toLowerCase()) || {}
        const artistAcc: any = artistsMap.get(String(otherId).toLowerCase())

        let displayName = userAcc.Username || 'User'
        let isArtist = false
        let artistType: string | null = null
        let isVerified = false

        if (artistAcc) {
          isArtist = true
          artistType = artistAcc.Artist_Type || null
          isVerified = !!artistAcc.Is_Verified
          displayName =
            artistAcc.BAND?.Band_Name ||
            artistAcc.SOLO_ARTIST?.Artist_Name ||
            userAcc.Username ||
            'Artist'
        }

        const lastActiveAt = userAcc.Last_Active_At || userAcc.last_active_at || null
        const isOnline = isUserOnline(otherId, lastActiveAt)

        const participant: ConversationParticipant = {
          accountId: otherId,
          username: userAcc.Username || 'unknown',
          displayName,
          avatarUrl: userAcc.Profile_Picture || null,
          isArtist,
          artistType,
          isVerified,
          isOnline,
          lastActiveAt,
        }

        return {
          threadId: t.Thread_ID,
          participant,
          lastMessageSnippet: t.Last_Message_Snippet || 'No messages yet',
          lastMessageAt: t.Last_Message_At || t.Last_Updated || new Date().toISOString(),
          lastMessageSenderId: t.Last_Message_Sender_ID || null,
          unreadCount: unreadCountMap[t.Thread_ID] || 0,
        }
      })

      threads.value = mappedThreads

      // Keep activeThread participant updated if currently active
      if (activeThread.value) {
        const refreshed = mappedThreads.find((t) => t.threadId === activeThread.value?.threadId)
        if (refreshed) {
          activeThread.value = refreshed
        }
      }
    } catch (err: any) {
      console.error('[useMessaging] Error loading threads:', err)
      errorMessage.value = err?.message || 'Failed to load conversations.'
    } finally {
      isLoadingThreads.value = false
    }
  }

  // 2. Select a thread and load its messages
  const selectThread = async (threadId: string) => {
    const uid = await getUserId()
    if (!uid) return

    // Find existing thread or fetch it
    let target = threads.value.find((t) => t.threadId === threadId)
    if (!target) {
      await fetchThreads()
      target = threads.value.find((t) => t.threadId === threadId)
    }

    // Resilient fallback: direct query MESSAGE_THREAD if thread was newly created
    if (!target) {
      try {
        const { data: threadRow } = await db
          .from('MESSAGE_THREAD')
          .select('Thread_ID, Participant_1_ID, Participant_2_ID, Last_Message_Snippet, Last_Message_At, Last_Message_Sender_ID')
          .eq('Thread_ID', threadId)
          .maybeSingle()

        if (threadRow) {
          const isP1 = String(threadRow.Participant_1_ID || '').toLowerCase() === String(uid).toLowerCase()
          const otherId = isP1 ? threadRow.Participant_2_ID : threadRow.Participant_1_ID

          let uAcc: any = null
          try {
            const { data, error } = await db
              .from('USER_ACCOUNT')
              .select('ACCOUNT_ID, Username, Profile_Picture, Last_Active_At')
              .eq('ACCOUNT_ID', otherId)
              .maybeSingle()
            if (error) throw error
            uAcc = data
          } catch {
            const { data } = await db
              .from('USER_ACCOUNT')
              .select('ACCOUNT_ID, Username, Profile_Picture')
              .eq('ACCOUNT_ID', otherId)
              .maybeSingle()
            uAcc = data
          }

          const { data: aAcc } = await db
            .from('ARTIST')
            .select(`
              ACCOUNT_ID,
              Artist_Type,
              Is_Verified,
              SOLO_ARTIST ( Artist_Name ),
              BAND ( Band_Name )
            `)
            .eq('ACCOUNT_ID', otherId)
            .maybeSingle()

          let displayName = uAcc?.Username || 'User'
          let isArtist = false
          let artistType: string | null = null
          let isVerified = false

          if (aAcc) {
            isArtist = true
            artistType = aAcc.Artist_Type || null
            isVerified = !!aAcc.Is_Verified
            displayName =
              aAcc.BAND?.Band_Name ||
              aAcc.SOLO_ARTIST?.Artist_Name ||
              uAcc?.Username ||
              'Artist'
          }

          const lastActiveAt = uAcc?.Last_Active_At || uAcc?.last_active_at || null

          target = {
            threadId: threadRow.Thread_ID,
            participant: {
              accountId: otherId,
              username: uAcc?.Username || 'unknown',
              displayName,
              avatarUrl: uAcc?.Profile_Picture || null,
              isArtist,
              artistType,
              isVerified,
              isOnline: isUserOnline(otherId, lastActiveAt),
              lastActiveAt,
            },
            lastMessageSnippet: threadRow.Last_Message_Snippet || 'No messages yet',
            lastMessageAt: threadRow.Last_Message_At || new Date().toISOString(),
            lastMessageSenderId: threadRow.Last_Message_Sender_ID || null,
            unreadCount: 0,
          }
          threads.value.unshift(target)
        }
      } catch (e) {
        console.warn('[useMessaging] Fallback direct thread fetch failed:', e)
      }
    }

    if (target) {
      activeThread.value = target
    }

    isLoadingMessages.value = true
    try {
      const { data: rawMessages, error: msgErr } = await db
        .from('MESSAGE')
        .select('*')
        .eq('Thread_ID', threadId)
        .order('Created_at', { ascending: true })

      if (msgErr) throw msgErr

      messages.value = (rawMessages || []).map((row: any) => mapRowToMessage(row, uid))

      // Mark incoming messages as read
      markThreadAsRead(threadId)
    } catch (err: any) {
      console.error('[useMessaging] Error loading messages:', err)
    } finally {
      isLoadingMessages.value = false
    }
  }

  // 3. Mark all messages in a thread as read
  const markThreadAsRead = async (threadId: string) => {
    const uid = await getUserId()
    if (!uid) return

    try {
      // Try stored RPC first
      const { error: rpcErr } = await db.rpc('mark_thread_messages_as_read', {
        target_thread_id: threadId,
      })

      // Fallback direct update if RPC not applied yet
      if (rpcErr) {
        await db
          .from('MESSAGE')
          .update({ Is_Read: true })
          .eq('Thread_ID', threadId)
          .neq('Sender_ID', uid)
          .eq('Is_Read', false)
      }

      // Update local state
      const t = threads.value.find((item) => item.threadId === threadId)
      if (t) t.unreadCount = 0

      messages.value.forEach((m) => {
        if (!m.isMine) m.isRead = true
      })
    } catch (err) {
      // Non-blocking
    }
  }

  // 4. Send Message with attachments, photo compression, and link previews
  const sendMessage = async (content: string, stagedFiles: File[] = []) => {
    const uid = await getUserId()
    const active = activeThread.value
    if (!uid || !active) return false
    if (!content.trim() && stagedFiles.length === 0) return false

    isSending.value = true
    errorMessage.value = null

    try {
      const uploadedAttachments: MessageAttachment[] = []

      // Process and upload attachments
      for (const file of stagedFiles) {
        let fileToUpload: File = file

        // Check if image: apply adaptive client-side compression to <= 1.5MB
        if (file.type && file.type.startsWith('image/')) {
          try {
            fileToUpload = await optimizeChatMessageImage(file, 1.5)
          } catch (compErr) {
            console.warn('[useMessaging] Photo compression failed, using original:', compErr)
            fileToUpload = file
          }
        } else {
          // Document: verify within 10MB limit
          if (file.size > 10 * 1024 * 1024) {
            throw new Error(`Document "${file.name}" exceeds the 10MB file size limit.`)
          }
        }

        // Upload to Supabase Storage 'chat_attachments'
        const fileExt = fileToUpload.name.split('.').pop() || 'bin'
        const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `${active.threadId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${safeName}`

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('chat_attachments')
          .upload(filePath, fileToUpload, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadErr) {
          console.error('[useMessaging] Storage upload error:', uploadErr)
          throw new Error(`Failed to upload ${file.name}: ${uploadErr.message}`)
        }

        const { data: publicUrlData } = supabase.storage
          .from('chat_attachments')
          .getPublicUrl(uploadData.path)

        uploadedAttachments.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name: file.name,
          url: publicUrlData.publicUrl,
          type: fileToUpload.type,
          size: fileToUpload.size,
        })
      }

      // Check for URL in message content to fetch Open Graph link preview
      let linkPreview: LinkPreviewData | null = null
      const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/i
      const match = content.match(urlRegex)
      if (match && match[0]) {
        try {
          let cleanUrl = match[0].replace(/[.,!?:;)\]]+$/, '')
          if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl
          }
          const previewRes = await $fetch<any>('/api/link-preview', {
            query: { url: cleanUrl },
          })
          if (previewRes?.success && previewRes.preview) {
            linkPreview = previewRes.preview
          }
        } catch (linkErr) {
          console.warn('[useMessaging] Link preview fetch failed:', linkErr)
        }
      }

      const metadataPayload: any = {}
      if (linkPreview) {
        metadataPayload.link_preview = linkPreview
      }

      // Insert message into database
      const { data: insertedMsg, error: insertErr } = await db
        .from('MESSAGE')
        .insert({
          Thread_ID: active.threadId,
          Sender_ID: uid,
          Content: content.trim(),
          Is_Read: false,
          Attachments: uploadedAttachments,
          Metadata: metadataPayload,
          Is_Edited: false,
          Is_Deleted: false,
          Created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // Update thread's last message info
      const snippet = content.trim()
        ? content.trim().substring(0, 100)
        : uploadedAttachments.length > 0
          ? 'Sent an attachment'
          : 'Sent a message'

      await db
        .from('MESSAGE_THREAD')
        .update({
          Last_Message_Snippet: snippet,
          Last_Message_Sender_ID: uid,
          Last_Message_At: new Date().toISOString(),
          Last_Updated: new Date().toISOString(),
        })
        .eq('Thread_ID', active.threadId)

      // Add to local messages if not already added by realtime
      if (insertedMsg && !messages.value.some((m) => m.id === insertedMsg.Message_ID)) {
        messages.value.push(mapRowToMessage(insertedMsg, uid))
      }

      // Update local thread item immediately (zero refresh)
      const localThread = threads.value.find((t) => t.threadId === active.threadId)
      if (localThread) {
        localThread.lastMessageSnippet = snippet
        localThread.lastMessageAt = new Date().toISOString()
        localThread.lastMessageSenderId = uid
        // Sort threads in place
        threads.value.sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        )
      }

      // Dispatch real-time in-app notification to the recipient
      let recipientId = active.participant?.accountId
      if (!recipientId || String(recipientId).toLowerCase() === String(uid).toLowerCase()) {
        const foundThread = threads.value.find((t) => t.threadId === active.threadId)
        if (foundThread?.participant?.accountId && String(foundThread.participant.accountId).toLowerCase() !== String(uid).toLowerCase()) {
          recipientId = foundThread.participant.accountId
        }
      }
      if (!recipientId || String(recipientId).toLowerCase() === String(uid).toLowerCase()) {
        try {
          const { data: threadRow } = await db
            .from('MESSAGE_THREAD')
            .select('Participant_1_ID, Participant_2_ID')
            .eq('Thread_ID', active.threadId)
            .maybeSingle()

          if (threadRow) {
            const isP1 = String(threadRow.Participant_1_ID || '').toLowerCase() === String(uid).toLowerCase()
            recipientId = isP1 ? threadRow.Participant_2_ID : threadRow.Participant_1_ID
          }
        } catch (e) {
          console.warn('[useMessaging] Could not resolve recipient from thread row:', e)
        }
      }

      if (recipientId && String(recipientId).toLowerCase() !== String(uid).toLowerCase()) {
        (async () => {
          try {
            const { data: senderAcc } = await db
              .from('USER_ACCOUNT')
              .select('Username, Profile_Picture')
              .eq('ACCOUNT_ID', uid)
              .maybeSingle()

            const senderName = senderAcc?.Username || 'Someone'
            const senderPic = senderAcc?.Profile_Picture || null
            const senderInitials = getTwoLetterInitials(senderName)

            console.log('[useMessaging] Sending DM notification to:', recipientId, 'from sender:', uid, `(${senderName})`)

            const { data: rpcRes, error: rpcErr } = await db.rpc('send_notification', {
              p_account_id: recipientId,
              p_type: 'direct_message',
              p_title: `New message from ${senderName}`,
              p_content: snippet,
              p_action_link: `/Messages?threadId=${active.threadId}`,
              p_svg_type: 'direct_message',
              p_avatar_text: senderInitials,
              p_action_primary: null,
              p_action_secondary: null,
              p_entity_id: active.threadId,
              p_entity_type: 'message_thread',
              p_metadata: {
                avatar_url: senderPic,
                sender_name: senderName,
                thread_id: active.threadId,
              },
              p_sender_account_id: uid,
            })

            if (rpcErr) {
              console.warn('[useMessaging] send_notification RPC returned error, attempting direct insert:', rpcErr)
              const { error: directErr } = await db.from('NOTIFICATION').insert({
                Account_ID: recipientId,
                Type: 'direct_message',
                Title: `New message from ${senderName}`,
                Content: snippet,
                Action_Link: `/Messages?threadId=${active.threadId}`,
                Svg_Type: 'direct_message',
                Avatar_Text: senderInitials,
                Entity_ID: active.threadId,
                Entity_Type: 'message_thread',
                Sender_Account_ID: uid,
                Metadata: {
                  avatar_url: senderPic,
                  sender_name: senderName,
                  thread_id: active.threadId,
                },
                Is_Read: false,
                Created_At: new Date().toISOString(),
              })
              if (directErr) {
                console.error('[useMessaging] Direct fallback notification insert failed:', directErr)
              } else {
                console.log('[useMessaging] Direct fallback notification inserted successfully')
              }
            } else {
              console.log('[useMessaging] Notification dispatched successfully via RPC:', rpcRes)
            }
          } catch (notifErr) {
            console.error('[useMessaging] Unexpected error dispatching DM notification:', notifErr)
          }
        })()
      } else {
        console.warn('[useMessaging] Notification skipped: recipientId could not be resolved or matches sender UID', { recipientId, uid })
      }

      return true
    } catch (err: any) {
      console.error('[useMessaging] Send error:', err)
      errorMessage.value = err?.message || 'Failed to send message.'
      return false
    } finally {
      isSending.value = false
    }
  }

  // 5. Edit a message (Within 10-minute window)
  const editMessage = async (messageId: string, newContent: string) => {
    const uid = await getUserId()
    if (!uid || !newContent.trim()) return false

    const targetMsg = messages.value.find((m) => m.id === messageId)
    if (!targetMsg || !targetMsg.isMine) return false

    // Check 10-minute window
    const elapsedMs = Date.now() - new Date(targetMsg.createdAt).getTime()
    if (elapsedMs > 10 * 60 * 1000) {
      alert('The 10-minute editing window has expired for this message.')
      return false
    }

    try {
      // Try stored RPC first
      const { data: rpcRes, error: rpcErr } = await db.rpc('edit_message', {
        target_message_id: messageId,
        new_content: newContent.trim(),
      })

      // Fallback direct update
      if (rpcErr) {
        const { error: directErr } = await db
          .from('MESSAGE')
          .update({
            Content: newContent.trim(),
            Is_Edited: true,
            Edited_At: new Date().toISOString(),
          })
          .eq('Message_ID', messageId)
          .eq('Sender_ID', uid)

        if (directErr) throw directErr
      }

      // Update locally
      targetMsg.content = newContent.trim()
      targetMsg.isEdited = true
      targetMsg.editedAt = new Date().toISOString()

      // Also update local thread snippet if this was the latest message
      const localThread = threads.value.find((t) => t.threadId === targetMsg.threadId)
      if (localThread && messages.value[messages.value.length - 1]?.id === messageId) {
        localThread.lastMessageSnippet = newContent.trim()
      }

      return true
    } catch (err: any) {
      console.error('[useMessaging] Edit message error:', err)
      alert(err?.message || 'Failed to edit message.')
      return false
    }
  }

  // 6. Unsend a message for everyone (Within 10-minute window)
  const unsendMessage = async (messageId: string) => {
    const uid = await getUserId()
    if (!uid) return false

    const targetMsg = messages.value.find((m) => m.id === messageId)
    if (!targetMsg || !targetMsg.isMine) return false

    // Check 10-minute window
    const elapsedMs = Date.now() - new Date(targetMsg.createdAt).getTime()
    if (elapsedMs > 10 * 60 * 1000) {
      alert('The 10-minute unsend window has expired for this message.')
      return false
    }

    try {
      // Try stored RPC first
      const { error: rpcErr } = await db.rpc('unsend_message', {
        target_message_id: messageId,
      })

      // Fallback direct update
      if (rpcErr) {
        const { error: directErr } = await db
          .from('MESSAGE')
          .update({
            Content: 'This message was unsent',
            Attachments: [],
            Metadata: {},
            Is_Deleted: true,
            Deleted_At: new Date().toISOString(),
          })
          .eq('Message_ID', messageId)
          .eq('Sender_ID', uid)

        if (directErr) throw directErr
      }

      // Update locally
      targetMsg.content = 'This message was unsent'
      targetMsg.isDeleted = true
      targetMsg.attachments = []
      targetMsg.metadata = {}
      targetMsg.canEditOrUnsend = false

      // Roll back thread snippet to previous non-deleted message if this was the latest message
      const localThread = threads.value.find((t) => t.threadId === targetMsg.threadId)
      const nonDeleted = messages.value.filter((m) => !m.isDeleted && m.id !== messageId)
      const lastActive = nonDeleted[nonDeleted.length - 1]

      let rolledSnippet = 'No messages yet'
      let rolledSender: string | null = null
      let rolledAt = new Date().toISOString()

      if (lastActive) {
        rolledSnippet = lastActive.content || (lastActive.attachments.length > 0 ? 'Sent an attachment' : 'Sent a message')
        rolledSender = lastActive.senderId
        rolledAt = lastActive.createdAt
      }

      if (localThread) {
        localThread.lastMessageSnippet = rolledSnippet
        localThread.lastMessageSenderId = rolledSender
        localThread.lastMessageAt = rolledAt
      }

      // Update database MESSAGE_THREAD table to match rolled back snippet
      await db
        .from('MESSAGE_THREAD')
        .update({
          Last_Message_Snippet: rolledSnippet,
          Last_Message_Sender_ID: rolledSender,
          Last_Message_At: rolledAt,
          Last_Updated: new Date().toISOString(),
        })
        .eq('Thread_ID', targetMsg.threadId)

      return true
    } catch (err: any) {
      console.error('[useMessaging] Unsend error:', err)
      alert(err?.message || 'Failed to unsend message.')
      return false
    }
  }

  // 7. Get or Create 1-on-1 thread between current user and target user
  const getOrCreateThread = async (
    targetAccountId: string,
    callerUserId?: string
  ): Promise<string | null> => {
    const uid = callerUserId || (await getUserId())
    if (!uid) {
      throw new Error('You must be logged in to start a conversation.')
    }
    if (uid === targetAccountId) {
      throw new Error('You cannot start a conversation with yourself.')
    }

    try {
      // Try stored RPC first
      const { data: rpcThreadId, error: rpcErr } = await db.rpc('get_or_create_thread', {
        target_user_id: targetAccountId,
      })

      if (!rpcErr && rpcThreadId) {
        await fetchThreads()
        return rpcThreadId
      }

      // Fallback: Check existing thread manually
      const { data: existingThreads } = await db
        .from('MESSAGE_THREAD')
        .select('Thread_ID')
        .or(
          `and(Participant_1_ID.eq.${uid},Participant_2_ID.eq.${targetAccountId}),and(Participant_1_ID.eq.${targetAccountId},Participant_2_ID.eq.${uid})`
        )
        .maybeSingle()

      if (existingThreads?.Thread_ID) {
        await fetchThreads()
        return existingThreads.Thread_ID
      }

      // Create new thread
      const p1 = uid < targetAccountId ? uid : targetAccountId
      const p2 = uid < targetAccountId ? targetAccountId : uid

      const { data: newThread, error: createErr } = await db
        .from('MESSAGE_THREAD')
        .insert({
          Participant_1_ID: p1,
          Participant_2_ID: p2,
          Last_Updated: new Date().toISOString(),
          Last_Message_At: new Date().toISOString(),
        })
        .select('Thread_ID')
        .single()

      if (createErr) throw createErr

      await fetchThreads()
      return newThread.Thread_ID
    } catch (err: any) {
      console.error('[useMessaging] getOrCreateThread error:', err)
      throw err
    }
  }

  // 8. Real-time Subscription Setup with Presence & Heartbeat
  const setupRealtime = async () => {
    const uid = await getUserId()
    if (!uid) return

    if (chatRealtimeChannel) {
      return // already subscribed
    }

    chatRealtimeChannel = supabase
      .channel('tono_chat_realtime_hub', {
        config: {
          presence: {
            key: uid.toLowerCase(),
          },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = chatRealtimeChannel.presenceState()
        const activeIds = new Set<string>()
        for (const key of Object.keys(state)) {
          activeIds.add(key.toLowerCase())
        }
        onlineUserIds.value = activeIds
        syncOnlineStatuses()
      })
      .on('presence', { event: 'join' }, ({ key }: any) => {
        if (key) {
          onlineUserIds.value.add(key.toLowerCase())
          syncOnlineStatuses()
        }
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        if (key) {
          onlineUserIds.value.delete(key.toLowerCase())
          syncOnlineStatuses()
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'MESSAGE' },
        (payload: any) => {
          const eventType = payload.eventType
          const newRow = payload.new
          const oldRow = payload.old

          if (eventType === 'INSERT') {
            const mapped = mapRowToMessage(newRow, uid)

            // If incoming message belongs to currently active thread
            if (activeThread.value && activeThread.value.threadId === mapped.threadId) {
              if (!messages.value.some((m) => m.id === mapped.id)) {
                messages.value.push(mapped)
              }
              if (!mapped.isMine) {
                markThreadAsRead(mapped.threadId)
              }
            }

            // Update thread snippet & resort
            const targetThread = threads.value.find((t) => t.threadId === mapped.threadId)
            if (targetThread) {
              targetThread.lastMessageSnippet = mapped.isDeleted
                ? 'This message was unsent'
                : mapped.content || 'Sent an attachment'
              targetThread.lastMessageAt = mapped.createdAt
              targetThread.lastMessageSenderId = mapped.senderId

              if (!mapped.isMine && activeThread.value?.threadId !== mapped.threadId) {
                targetThread.unreadCount = (targetThread.unreadCount || 0) + 1
              }

              // Sort threads so most recently active is first
              threads.value.sort(
                (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
              )
            } else {
              // New thread not in list yet, refetch
              fetchThreads()
            }
          } else if (eventType === 'UPDATE') {
            const mapped = mapRowToMessage(newRow, uid)

            if (activeThread.value && activeThread.value.threadId === mapped.threadId) {
              const idx = messages.value.findIndex((m) => m.id === mapped.id)
              if (idx !== -1) {
                messages.value[idx] = mapped
              }
            }

            if (mapped.isDeleted) {
              const targetThread = threads.value.find((t) => t.threadId === mapped.threadId)
              if (targetThread) {
                const nonDeleted = messages.value.filter((m) => !m.isDeleted && m.id !== mapped.id)
                const lastActive = nonDeleted[nonDeleted.length - 1]
                if (lastActive) {
                  targetThread.lastMessageSnippet = lastActive.content || (lastActive.attachments.length > 0 ? 'Sent an attachment' : 'Sent a message')
                  targetThread.lastMessageSenderId = lastActive.senderId
                  targetThread.lastMessageAt = lastActive.createdAt
                } else {
                  targetThread.lastMessageSnippet = 'No messages yet'
                  targetThread.lastMessageSenderId = null
                }
              }
            } else if (mapped.isEdited) {
              const targetThread = threads.value.find((t) => t.threadId === mapped.threadId)
              if (targetThread && messages.value[messages.value.length - 1]?.id === mapped.id) {
                targetThread.lastMessageSnippet = mapped.content
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'MESSAGE_THREAD' },
        () => {
          fetchThreads()
        }
      )
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          try {
            await chatRealtimeChannel.track({
              user_id: uid.toLowerCase(),
              online_at: new Date().toISOString(),
            })
          } catch (trackErr) {
            console.warn('[useMessaging] Presence track error:', trackErr)
          }

          // Record activity in database on session connect
          recordUserActivity(uid)

          // Setup periodic heartbeat every 2 minutes while active
          if (!presenceHeartbeatTimer) {
            presenceHeartbeatTimer = setInterval(() => {
              recordUserActivity(uid)
            }, 2 * 60 * 1000)
          }
        }
      })
  }

  const cleanupRealtime = () => {
    if (presenceHeartbeatTimer) {
      clearInterval(presenceHeartbeatTimer)
      presenceHeartbeatTimer = null
    }
    if (chatRealtimeChannel) {
      try {
        chatRealtimeChannel.untrack()
      } catch {
        // Non-blocking
      }
      supabase.removeChannel(chatRealtimeChannel)
      chatRealtimeChannel = null
    }
  }

  return {
    threads,
    activeThread,
    messages,
    isLoadingThreads,
    isLoadingMessages,
    isSending,
    errorMessage,
    totalUnreadCount,
    currentUserId,
    formatTimeAgo,
    formatClockTime,
    formatLastActive,
    isUserOnline,
    onlineUserIds,
    recordUserActivity,
    fetchThreads,
    selectThread,
    sendMessage,
    editMessage,
    unsendMessage,
    markThreadAsRead,
    getOrCreateThread,
    setupRealtime,
    cleanupRealtime,
  }
}
