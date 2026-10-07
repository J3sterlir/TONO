import { ref } from 'vue'
import { optimizePostMedia } from '~/utils/imageOptimizer'
import type { PostCropOptions } from '~/utils/imageOptimizer'

export interface PostItem {
  POST_ID: string
  ARTIST_ID?: string | null
  BUSINESS_ID?: string | null
  Media: string | null
  File_URL: string | null
  Caption: string | null
  Location: string | null
  Created_at: string
  likeCount: number
  commentCount: number
  userHasLiked: boolean
  authorName?: string
  authorAvatar?: string | null
}

export interface PostCommentItem {
  Comment_ID: string
  POST_ID: string
  ACCOUNT_ID: string
  Content: string
  Created_at: string
  Username: string
  Profile_Picture?: string | null
}

export interface CreatePostPayload {
  imageFile?: File | null
  caption: string
  location?: string
  aspectRatio?: 'original' | '1:1' | '4:5' | '16:9'
  cropData?: { zoom: number; pan: { x: number; y: number } }
}

export interface UpdatePostPayload {
  caption: string
  location?: string | null
  imageFile?: File | null
  removeExistingImage?: boolean
  aspectRatio?: 'original' | '1:1' | '4:5' | '16:9'
  cropData?: { zoom: number; pan: { x: number; y: number } }
}

export const useArtistPosts = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any
  const user = useSupabaseUser()

  const posts = useState<PostItem[]>('tono_artist_posts', () => [])
  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const activePost = ref<PostItem | null>(null)
  const comments = ref<PostCommentItem[]>([])
  const isLoadingComments = ref(false)

  let realtimeChannel: any = null

  const getUserId = async (): Promise<string | null> => {
    if (user.value?.id) return user.value.id
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        return data.user.id
      }
    } catch {
      // ignore
    }
    return null
  }

  /**
   * Fetches all posts for a given artist ID, along with like counts, comment counts, and like state.
   */
  const fetchArtistPosts = async (artistId: string): Promise<PostItem[]> => {
    if (!artistId) return []
    isLoading.value = true

    try {
      const currentUserId = await getUserId()

      // 1. Fetch posts
      const { data: rawPosts, error: postsError } = await db
        .from('POST')
        .select('*')
        .eq('ARTIST_ID', artistId)
        .order('Created_at', { ascending: false })

      if (postsError) throw postsError
      if (!rawPosts || rawPosts.length === 0) {
        posts.value = []
        return []
      }

      const postIds = rawPosts.map((p: any) => p.POST_ID)

      // 2. Fetch all likes for these posts
      const { data: likesData } = await db
        .from('POST_LIKES')
        .select('POST_ID, ACCOUNT_ID')
        .in('POST_ID', postIds)

      // 3. Fetch all comments for count
      const { data: commentsData } = await db
        .from('POST_COMMENTS')
        .select('POST_ID, Comment_ID')
        .in('POST_ID', postIds)

      const likesList = likesData || []
      const commentsList = commentsData || []

      // 4. Assemble post items
      const assembled: PostItem[] = rawPosts.map((p: any) => {
        const postLikes = likesList.filter((l: any) => l.POST_ID === p.POST_ID)
        const postComments = commentsList.filter((c: any) => c.POST_ID === p.POST_ID)
        const userHasLiked = currentUserId
          ? postLikes.some((l: any) => l.ACCOUNT_ID === currentUserId)
          : false

        return {
          POST_ID: p.POST_ID,
          ARTIST_ID: p.ARTIST_ID,
          Media: p.Media || null,
          File_URL: p.File_URL || null,
          Caption: p.Caption || '',
          Location: p.Location || null,
          Created_at: p.Created_at,
          likeCount: postLikes.length,
          commentCount: postComments.length,
          userHasLiked,
        }
      })

      posts.value = assembled
      return assembled
    } catch (err) {
      console.error('Error fetching artist posts:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches all posts for a given business ID, along with like counts, comment counts, and like state.
   */
  const fetchBusinessPosts = async (businessId: string): Promise<PostItem[]> => {
    if (!businessId) return []
    isLoading.value = true

    try {
      const currentUserId = await getUserId()

      // 1. Fetch posts
      const { data: rawPosts, error: postsError } = await db
        .from('POST')
        .select('*')
        .eq('BUSINESS_ID', businessId)
        .order('Created_at', { ascending: false })

      if (postsError) throw postsError
      if (!rawPosts || rawPosts.length === 0) {
        posts.value = []
        return []
      }

      const postIds = rawPosts.map((p: any) => p.POST_ID)

      // 2. Fetch all likes for these posts
      const { data: likesData } = await db
        .from('POST_LIKES')
        .select('POST_ID, ACCOUNT_ID')
        .in('POST_ID', postIds)

      // 3. Fetch all comments for count
      const { data: commentsData } = await db
        .from('POST_COMMENTS')
        .select('POST_ID, Comment_ID')
        .in('POST_ID', postIds)

      const likesList = likesData || []
      const commentsList = commentsData || []

      // 4. Assemble post items
      const assembled: PostItem[] = rawPosts.map((p: any) => {
        const postLikes = likesList.filter((l: any) => l.POST_ID === p.POST_ID)
        const postComments = commentsList.filter((c: any) => c.POST_ID === p.POST_ID)
        const userHasLiked = currentUserId
          ? postLikes.some((l: any) => l.ACCOUNT_ID === currentUserId)
          : false

        return {
          POST_ID: p.POST_ID,
          ARTIST_ID: p.ARTIST_ID || null,
          BUSINESS_ID: p.BUSINESS_ID || null,
          Media: p.Media || null,
          File_URL: p.File_URL || null,
          Caption: p.Caption || '',
          Location: p.Location || null,
          Created_at: p.Created_at,
          likeCount: postLikes.length,
          commentCount: postComments.length,
          userHasLiked,
        }
      })

      posts.value = assembled
      return assembled
    } catch (err) {
      console.error('Error fetching business posts:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches a single post by ID (for deep-linking from notifications)
   */
  const fetchPostById = async (postId: string): Promise<PostItem | null> => {
    if (!postId) return null
    try {
      const currentUserId = await getUserId()

      const { data: rawPost, error } = await db
        .from('POST')
        .select('*')
        .eq('POST_ID', postId)
        .single()

      if (error || !rawPost) return null

      // Get likes
      const { data: likesData } = await db
        .from('POST_LIKES')
        .select('POST_ID, ACCOUNT_ID')
        .eq('POST_ID', postId)

      // Get comments count
      const { data: commentsData } = await db
        .from('POST_COMMENTS')
        .select('Comment_ID')
        .eq('POST_ID', postId)

      const likesList = likesData || []
      const commentsList = commentsData || []
      const userHasLiked = currentUserId
        ? likesList.some((l: any) => l.ACCOUNT_ID === currentUserId)
        : false

      const item: PostItem = {
        POST_ID: rawPost.POST_ID,
        ARTIST_ID: rawPost.ARTIST_ID || null,
        BUSINESS_ID: rawPost.BUSINESS_ID || null,
        Media: rawPost.Media || null,
        File_URL: rawPost.File_URL || null,
        Caption: rawPost.Caption || '',
        Location: rawPost.Location || null,
        Created_at: rawPost.Created_at,
        likeCount: likesList.length,
        commentCount: commentsList.length,
        userHasLiked,
      }

      // If exists in posts array, update it, otherwise push
      const idx = posts.value.findIndex((p) => p.POST_ID === postId)
      if (idx !== -1) {
        posts.value[idx] = item
      }

      return item
    } catch (err) {
      console.error('Error fetching post by ID:', err)
      return null
    }
  }

  /**
   * Creates a post (with image optimization or text-only) for either an artist or a business.
   */
  const createPost = async (
    ownerId: string,
    payload: CreatePostPayload,
    ownerType: 'artist' | 'business' = 'artist'
  ): Promise<{ success: boolean; post?: PostItem; error?: string }> => {
    isSubmitting.value = true
    try {
      const currentUserId = await getUserId()
      if (!currentUserId) {
        return { success: false, error: 'User is not authenticated.' }
      }

      let uploadedMediaUrl: string | null = null

      // 1. Optimize and upload image if provided
      if (payload.imageFile) {
        const cropOpts: PostCropOptions = {
          aspectRatio: payload.aspectRatio || 'original',
          zoom: payload.cropData?.zoom || 1.0,
          pan: payload.cropData?.pan || { x: 0, y: 0 },
        }

        const optimizedBlob = await optimizePostMedia(payload.imageFile, cropOpts, 1920, 0.82)
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`
        const filePath = `${currentUserId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, optimizedBlob, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (uploadError) {
          throw new Error(`Failed to upload post image: ${uploadError.message}`)
        }

        const { data: publicUrlData } = supabase.storage.from('posts').getPublicUrl(filePath)
        uploadedMediaUrl = publicUrlData.publicUrl
      }

      // 2. Insert post row into POST table
      const insertRecord: Record<string, any> = {
        Media: uploadedMediaUrl,
        File_URL: uploadedMediaUrl,
        Caption: payload.caption.trim() || null,
        Location: payload.location?.trim() || null,
      }

      if (ownerType === 'business') {
        insertRecord.BUSINESS_ID = ownerId
        insertRecord.ARTIST_ID = null
      } else {
        insertRecord.ARTIST_ID = ownerId
        insertRecord.BUSINESS_ID = null
      }

      const { data: newRow, error: insertError } = await db
        .from('POST')
        .insert(insertRecord)
        .select()
        .single()

      if (insertError) throw insertError

      const newPost: PostItem = {
        POST_ID: newRow.POST_ID,
        ARTIST_ID: newRow.ARTIST_ID || null,
        BUSINESS_ID: newRow.BUSINESS_ID || null,
        Media: newRow.Media || null,
        File_URL: newRow.File_URL || null,
        Caption: newRow.Caption || '',
        Location: newRow.Location || null,
        Created_at: newRow.Created_at,
        likeCount: 0,
        commentCount: 0,
        userHasLiked: false,
      }

      // Prepend to posts list
      posts.value.unshift(newPost)

      return { success: true, post: newPost }
    } catch (err: any) {
      console.error('Error creating post:', err)
      return { success: false, error: err?.message || 'Failed to create post.' }
    } finally {
      isSubmitting.value = false
    }
  }

  /**
   * Updates an existing post (caption, location, media update or removal)
   */
  const updatePost = async (
    postId: string,
    payload: UpdatePostPayload
  ): Promise<{ success: boolean; post?: PostItem; error?: string }> => {
    isSubmitting.value = true
    try {
      const currentUserId = await getUserId()
      if (!currentUserId) {
        return { success: false, error: 'User is not authenticated.' }
      }

      const targetPost = posts.value.find((p) => p.POST_ID === postId)
      let mediaUrl: string | null = targetPost?.Media || null

      // Case 1: User uploaded a new image
      if (payload.imageFile) {
        const cropOpts: PostCropOptions = {
          aspectRatio: payload.aspectRatio || 'original',
          zoom: payload.cropData?.zoom || 1.0,
          pan: payload.cropData?.pan || { x: 0, y: 0 },
        }

        const optimizedBlob = await optimizePostMedia(payload.imageFile, cropOpts, 1920, 0.82)
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`
        const filePath = `${currentUserId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, optimizedBlob, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (uploadError) {
          throw new Error(`Failed to upload post image: ${uploadError.message}`)
        }

        const { data: publicUrlData } = supabase.storage.from('posts').getPublicUrl(filePath)

        // Clean up previous storage asset if it was stored in the posts bucket
        if (targetPost?.Media && targetPost.Media.includes('/posts/')) {
          try {
            const parts = targetPost.Media.split('/posts/')
            const rawPath = parts[1]?.split('?')[0]
            if (rawPath) {
              const oldStoragePath = decodeURIComponent(rawPath)
              await supabase.storage.from('posts').remove([oldStoragePath])
            }
          } catch (storageErr) {
            console.warn('Could not remove previous storage asset:', storageErr)
          }
        }

        mediaUrl = publicUrlData.publicUrl
      } else if (payload.removeExistingImage) {
        // Case 2: User explicitly removed existing image
        if (targetPost?.Media && targetPost.Media.includes('/posts/')) {
          try {
            const parts = targetPost.Media.split('/posts/')
            const rawPath = parts[1]?.split('?')[0]
            if (rawPath) {
              const oldStoragePath = decodeURIComponent(rawPath)
              await supabase.storage.from('posts').remove([oldStoragePath])
            }
          } catch (storageErr) {
            console.warn('Could not remove storage asset on image removal:', storageErr)
          }
        }
        mediaUrl = null
      }

      const newCaption = payload.caption.trim() || null
      const newLocation = payload.location?.trim() || null

      const { data: updatedRow, error: updateError } = await db
        .from('POST')
        .update({
          Media: mediaUrl,
          File_URL: mediaUrl,
          Caption: newCaption,
          Location: newLocation,
        })
        .eq('POST_ID', postId)
        .select()
        .single()

      if (updateError) throw updateError

      const updatedPostItem: PostItem = {
        POST_ID: updatedRow.POST_ID,
        ARTIST_ID: updatedRow.ARTIST_ID,
        Media: updatedRow.Media || null,
        File_URL: updatedRow.File_URL || null,
        Caption: updatedRow.Caption || '',
        Location: updatedRow.Location || null,
        Created_at: updatedRow.Created_at,
        likeCount: targetPost?.likeCount || 0,
        commentCount: targetPost?.commentCount || 0,
        userHasLiked: targetPost?.userHasLiked || false,
      }

      const idx = posts.value.findIndex((p) => p.POST_ID === postId)
      if (idx !== -1) {
        posts.value[idx] = updatedPostItem
      }

      const currentActive = activePost.value
      if (currentActive && currentActive.POST_ID === postId) {
        activePost.value = {
          ...currentActive,
          Media: updatedPostItem.Media,
          File_URL: updatedPostItem.File_URL,
          Caption: updatedPostItem.Caption,
          Location: updatedPostItem.Location,
        }
      }

      return { success: true, post: updatedPostItem }
    } catch (err: any) {
      console.error('Error updating post:', err)
      return { success: false, error: err?.message || 'Failed to update post.' }
    } finally {
      isSubmitting.value = false
    }
  }

  const inFlightLikes = new Set<string>()

  /**
   * Toggles like on a post with optimistic UI update and spam prevention
   */
  const toggleLike = async (postId: string): Promise<boolean> => {
    if (!postId || inFlightLikes.has(postId)) {
      return false
    }

    const currentUserId = await getUserId()
    if (!currentUserId) return false

    inFlightLikes.add(postId)

    // Find in memory post
    const targetPost = posts.value.find((p) => p.POST_ID === postId)
    const active = activePost.value?.POST_ID === postId ? activePost.value : null

    const previousLiked = targetPost ? targetPost.userHasLiked : (active ? active.userHasLiked : false)
    const newLiked = !previousLiked

    // Optimistic update (exactly 1 increment or decrement)
    if (targetPost) {
      targetPost.userHasLiked = newLiked
      targetPost.likeCount = newLiked
        ? targetPost.likeCount + 1
        : Math.max(0, targetPost.likeCount - 1)
    }
    if (active) {
      active.userHasLiked = newLiked
      active.likeCount = newLiked
        ? active.likeCount + 1
        : Math.max(0, active.likeCount - 1)
    }

    try {
      if (newLiked) {
        const { error } = await db.from('POST_LIKES').insert({
          POST_ID: postId,
          ACCOUNT_ID: currentUserId,
        })
        if (error && error.code !== '23505') { // 23505 is unique violation (already liked)
          throw error
        }
      } else {
        const { error } = await db
          .from('POST_LIKES')
          .delete()
          .match({ POST_ID: postId, ACCOUNT_ID: currentUserId })
        if (error) throw error
      }
      return true
    } catch (err) {
      console.error('Error toggling like:', err)
      // Revert optimistic update
      if (targetPost) {
        targetPost.userHasLiked = previousLiked
        targetPost.likeCount = previousLiked
          ? targetPost.likeCount + 1
          : Math.max(0, targetPost.likeCount - 1)
      }
      if (active) {
        active.userHasLiked = previousLiked
        active.likeCount = previousLiked
          ? active.likeCount + 1
          : Math.max(0, active.likeCount - 1)
      }
      return false
    } finally {
      inFlightLikes.delete(postId)
    }
  }

  /**
   * Deletes a post and cleans up associated storage assets
   */
  const deletePost = async (postId: string): Promise<boolean> => {
    try {
      const target = posts.value.find((p) => p.POST_ID === postId)

      // Clean up Supabase storage media file if present
      if (target?.Media && target.Media.includes('/posts/')) {
        try {
          const parts = target.Media.split('/posts/')
          const rawPath = parts[1]?.split('?')[0]
          if (rawPath) {
            const storagePath = decodeURIComponent(rawPath)
            await supabase.storage.from('posts').remove([storagePath])
          }
        } catch (storageErr) {
          console.warn('Could not remove storage asset for post:', storageErr)
        }
      }

      const { error } = await db.from('POST').delete().eq('POST_ID', postId)
      if (error) throw error

      // Remove from local reactive state
      posts.value = posts.value.filter((p) => p.POST_ID !== postId)
      if (activePost.value?.POST_ID === postId) {
        activePost.value = null
      }
      return true
    } catch (err) {
      console.error('Error deleting post:', err)
      return false
    }
  }

  /**
   * Fetches comments for a specific post with author username and avatar
   */
  const fetchComments = async (postId: string): Promise<PostCommentItem[]> => {
    if (!postId) return []
    isLoadingComments.value = true

    try {
      // 1. Try calling dedicated RPC get_post_comments (bypasses RLS safely via SECURITY DEFINER & handles stage names)
      const { data: rpcData, error: rpcError } = await db.rpc('get_post_comments', {
        p_post_id: postId,
      })

      if (!rpcError && Array.isArray(rpcData)) {
        const formatted: PostCommentItem[] = rpcData.map((row: any) => ({
          Comment_ID: row.Comment_ID,
          POST_ID: row.POST_ID,
          ACCOUNT_ID: row.ACCOUNT_ID,
          Content: row.Content,
          Created_at: row.Created_at,
          Username: row.Username || 'User',
          Profile_Picture: row.Profile_Picture || null,
        }))
        comments.value = formatted
        return formatted
      }

      // 2. Direct table fallback if RPC is not created yet
      const { data, error } = await db
        .from('POST_COMMENTS')
        .select(`
          Comment_ID,
          POST_ID,
          ACCOUNT_ID,
          Content,
          Created_at,
          USER_ACCOUNT!ACCOUNT_ID (
            Username,
            Profile_Picture
          )
        `)
        .eq('POST_ID', postId)
        .order('Created_at', { ascending: true })

      if (error) throw error

      const commentItems = data || []
      const currentUserId = await getUserId()

      // 3. Fallback for comments where USER_ACCOUNT is null (due to restrictive RLS)
      // Check artist's notifications for post comments which contain commenter_username
      const usernameMap = new Map<string, { username: string; avatar: string | null }>()
      const missingAccounts = commentItems
        .filter((c: any) => !c.USER_ACCOUNT?.Username)
        .map((c: any) => c.ACCOUNT_ID)

      if (missingAccounts.length > 0) {
        try {
          // A. If current user is one of the commenters, get their own username directly
          if (currentUserId && missingAccounts.includes(currentUserId)) {
            const { data: selfUser } = await db
              .from('USER_ACCOUNT')
              .select('Username, Profile_Picture')
              .eq('ACCOUNT_ID', currentUserId)
              .maybeSingle()
            if (selfUser?.Username) {
              usernameMap.set(currentUserId, {
                username: selfUser.Username,
                avatar: selfUser.Profile_Picture || null,
              })
            }
          }

          // B. For post owner (artist), check their NOTIFICATION records where trigger stored commenter_username
          const { data: notifData } = await db
            .from('NOTIFICATION')
            .select('Metadata, Sender_Account_ID')
            .eq('Type', 'post_commented')
            .eq('Entity_ID', postId)

          if (notifData) {
            for (const notif of notifData) {
              const meta = typeof notif.Metadata === 'string' ? JSON.parse(notif.Metadata) : notif.Metadata
              if (meta?.comment_id && meta?.commenter_username) {
                usernameMap.set(meta.comment_id, {
                  username: meta.commenter_username,
                  avatar: null,
                })
              }
              if (notif.Sender_Account_ID && meta?.commenter_username) {
                usernameMap.set(notif.Sender_Account_ID, {
                  username: meta.commenter_username,
                  avatar: null,
                })
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('Fallback username lookup error:', fallbackErr)
        }
      }

      const formatted: PostCommentItem[] = commentItems.map((row: any) => {
        const fallback = usernameMap.get(row.Comment_ID) || usernameMap.get(row.ACCOUNT_ID)
        return {
          Comment_ID: row.Comment_ID,
          POST_ID: row.POST_ID,
          ACCOUNT_ID: row.ACCOUNT_ID,
          Content: row.Content,
          Created_at: row.Created_at,
          Username: row.USER_ACCOUNT?.Username || fallback?.username || 'User',
          Profile_Picture: row.USER_ACCOUNT?.Profile_Picture || fallback?.avatar || null,
        }
      })

      comments.value = formatted
      return formatted
    } catch (err) {
      console.error('Error fetching post comments:', err)
      return []
    } finally {
      isLoadingComments.value = false
    }
  }

  /**
   * Adds a comment to a post
   */
  const addComment = async (
    postId: string,
    content: string
  ): Promise<{ success: boolean; comment?: PostCommentItem; error?: string }> => {
    if (!content.trim()) return { success: false, error: 'Comment cannot be empty.' }

    try {
      const currentUserId = await getUserId()
      if (!currentUserId) return { success: false, error: 'User is not authenticated.' }

      const { data, error } = await db
        .from('POST_COMMENTS')
        .insert({
          POST_ID: postId,
          ACCOUNT_ID: currentUserId,
          Content: content.trim(),
        })
        .select(`
          Comment_ID,
          POST_ID,
          ACCOUNT_ID,
          Content,
          Created_at,
          USER_ACCOUNT!ACCOUNT_ID (
            Username,
            Profile_Picture
          )
        `)
        .single()

      if (error) throw error

      // Get current user's profile info (current user can ALWAYS read their own profile under auth.uid() = ACCOUNT_ID)
      let authorUsername = data.USER_ACCOUNT?.Username
      let authorAvatar = data.USER_ACCOUNT?.Profile_Picture || null

      if (!authorUsername) {
        const { data: myUser } = await db
          .from('USER_ACCOUNT')
          .select('Username, Profile_Picture')
          .eq('ACCOUNT_ID', currentUserId)
          .maybeSingle()
        if (myUser?.Username) {
          authorUsername = myUser.Username
          authorAvatar = myUser.Profile_Picture || authorAvatar
        }
      }

      const newComment: PostCommentItem = {
        Comment_ID: data.Comment_ID,
        POST_ID: data.POST_ID,
        ACCOUNT_ID: data.ACCOUNT_ID,
        Content: data.Content,
        Created_at: data.Created_at,
        Username: authorUsername || 'User',
        Profile_Picture: authorAvatar,
      }

      comments.value.push(newComment)

      // Increment comment count locally on post
      const targetPost = posts.value.find((p) => p.POST_ID === postId)
      if (targetPost) {
        targetPost.commentCount += 1
      }
      if (activePost.value?.POST_ID === postId) {
        activePost.value.commentCount += 1
      }

      return { success: true, comment: newComment }
    } catch (err: any) {
      console.error('Error adding comment:', err)
      return { success: false, error: err?.message || 'Failed to submit comment.' }
    }
  }

  /**
   * Realtime subscription for posts, likes, and comments
   */
  const subscribeToPostsRealtime = (artistId: string) => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    realtimeChannel = supabase
      .channel(`artist_posts_${artistId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'POST_LIKES' },
        async (payload: any) => {
          const postId = payload.new?.POST_ID || payload.old?.POST_ID
          if (!postId) return

          // Ignore current user's own like/unlike events since toggleLike already updated the UI optimistically
          const currentUserId = await getUserId()
          const eventAccountId = payload.new?.ACCOUNT_ID || payload.old?.ACCOUNT_ID
          if (currentUserId && eventAccountId && eventAccountId === currentUserId) {
            return
          }

          const target = posts.value.find((p) => p.POST_ID === postId)
          const active = activePost.value?.POST_ID === postId ? activePost.value : null
          if (payload.eventType === 'INSERT') {
            if (target) target.likeCount += 1
            if (active) active.likeCount += 1
          } else if (payload.eventType === 'DELETE') {
            if (target) target.likeCount = Math.max(0, target.likeCount - 1)
            if (active) active.likeCount = Math.max(0, active.likeCount - 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'POST_COMMENTS' },
        async (payload: any) => {
          const postId = payload.new?.POST_ID
          if (!postId) return

          // Ignore current user's own comment events since addComment already updated the UI optimistically
          const currentUserId = await getUserId()
          if (currentUserId && payload.new?.ACCOUNT_ID === currentUserId) {
            return
          }

          const target = posts.value.find((p) => p.POST_ID === postId)
          if (target) {
            target.commentCount += 1
          }
          if (activePost.value?.POST_ID === postId) {
            fetchComments(postId)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'POST' },
        (payload: any) => {
          const updated = payload.new
          if (!updated?.POST_ID) return
          const target = posts.value.find((p) => p.POST_ID === updated.POST_ID)
          if (target) {
            target.Caption = updated.Caption || ''
            target.Location = updated.Location || null
            target.Media = updated.Media || null
            target.File_URL = updated.File_URL || null
          }
          const currentActive = activePost.value
          if (currentActive && currentActive.POST_ID === updated.POST_ID) {
            currentActive.Caption = updated.Caption || ''
            currentActive.Location = updated.Location || null
            currentActive.Media = updated.Media || null
            currentActive.File_URL = updated.File_URL || null
          }
        }
      )
      .subscribe()
  }

  const unsubscribeFromPostsRealtime = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  return {
    posts,
    isLoading,
    isSubmitting,
    activePost,
    comments,
    isLoadingComments,
    fetchArtistPosts,
    fetchBusinessPosts,
    fetchPostById,
    createPost,
    updatePost,
    toggleLike,
    deletePost,
    fetchComments,
    addComment,
    subscribeToPostsRealtime,
    unsubscribeFromPostsRealtime,
  }
}
