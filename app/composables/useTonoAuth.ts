export type TonoUserRole = 'Artist' | 'User'
export type TonoArtistType = 'Solo' | 'Band'

export type TonoUserAccount = {
  ACCOUNT_ID: string
  Username: string
  Email: string
  City: string | null
  Barangay: string | null
  Created_at?: string | null
}

export type TonoBusinessProfile = {
  BUSINESS_ID?: string
  ACCOUNT_ID: string
  Business_Name: string
  Business_Address: string | null
  Contact_Information: string | null
  Business_Service: string | null
}

export type TonoArtistProfile = {
  ARTIST_ID: string
  ACCOUNT_ID: string
  Artist_Type: TonoArtistType
  StageName: string
  Bio: string | null
  Links: Record<string, unknown> | null
  Is_Verified: boolean
  Status: string
  Created_at?: string | null
}

export type TonoProfile = {
  account: TonoUserAccount | null
  businessProfile: TonoBusinessProfile | null
  artistProfile: TonoArtistProfile | null
  genres: string[]
  instruments: string[]
}

export const useTonoAuth = () => {
  const supabase = useSupabaseClient()
  const db = supabase as any

  const resolveLoginEmail = async (rawValue: string): Promise<string> => {
    const value = rawValue.trim()
    if (!value) return ''
    if (value.includes('@')) return value

    // Call a secure database function to look up the email without triggering RLS
    const { data, error } = await db.rpc('get_email_by_username', { p_username: value })

    if (error) {
      console.error('Error resolving username:', error)
      throw new Error('Unable to look up username. (Is the RPC function created in Supabase?)')
    }

    if (!data) {
      throw new Error('Username not found.')
    }
    
    return data
  }

  const checkUserUniqueness = async (email: string, username: string) => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanUsername = username.trim()

    if (!cleanEmail && !cleanUsername) {
      return { emailTaken: false, usernameTaken: false }
    }

    const { data, error } = await db
      .from('USER_ACCOUNT')
      .select('Email, Username')
      .or(`Email.eq.${cleanEmail},Username.eq.${cleanUsername}`)

    if (error) throw error

    const rows = data ?? []

    return {
      emailTaken: rows.some((row: Record<string, any>) => row.Email?.toLowerCase() === cleanEmail),
      usernameTaken: rows.some((row: Record<string, any>) => row.Username === cleanUsername),
    }
  }



  const fetchCurrentUserProfile = async (userIdOverride?: string): Promise<TonoProfile | null> => {
    const { data: authUserData } = await supabase.auth.getUser()
    const userId = userIdOverride || authUserData.user?.id

    if (!userId) return null

    const { data: account, error: accountError } = await db
      .from('USER_ACCOUNT')
      .select('*')
      .eq('ACCOUNT_ID', userId)
      .maybeSingle()

    if (accountError) throw accountError
    if (!account) return null

    const { data: businessProfile } = await db
      .from('BUSINESS_PROFILE')
      .select('*')
      .eq('ACCOUNT_ID', userId)
      .maybeSingle()

    const { data: artistRows } = await db
      .from('ARTIST')
      .select('*')
      .eq('ACCOUNT_ID', userId)

    let artistProfile: TonoArtistProfile | null = null
    let genres: string[] = []
    let instruments: string[] = []

    if (artistRows && artistRows.length > 0) {
      artistProfile = artistRows[0] as TonoArtistProfile
      const artistId = artistProfile.ARTIST_ID

      if (artistProfile.Artist_Type === 'Solo') {
        const { data: soloGenreRows } = await db
          .from('SOLO_GENRES')
          .select('Genre_ID')
          .eq('ARTIST_ID', artistId)

        const { data: soloInstrumentRows } = await db
          .from('SOLO_INSTRUMENTS')
          .select('Instrument_ID')
          .eq('ARTIST_ID', artistId)

        const genreIds = (soloGenreRows ?? []).map((row: Record<string, any>) => row.Genre_ID)
        const instrumentIds = (soloInstrumentRows ?? []).map((row: Record<string, any>) => row.Instrument_ID)

        if (genreIds.length) {
          const { data: genreRows } = await db
            .from('TAG_GENRE')
            .select('Name')
            .in('Genre_ID', genreIds)
          genres = (genreRows ?? []).map((row: Record<string, any>) => row.Name)
        }

        if (instrumentIds.length) {
          const { data: instrumentRows } = await db
            .from('TAG_INSTRUMENT')
            .select('Name')
            .in('Instrument_ID', instrumentIds)
          instruments = (instrumentRows ?? []).map((row: Record<string, any>) => row.Name)
        }
      }

      if (artistProfile.Artist_Type === 'Band') {
        const { data: bandGenreRows } = await db
          .from('BAND_GENRES')
          .select('Genre_ID')
          .eq('ARTIST_ID', artistId)

        const genreIds = (bandGenreRows ?? []).map((row: Record<string, any>) => row.Genre_ID)
        if (genreIds.length) {
          const { data: genreRows } = await db
            .from('TAG_GENRE')
            .select('Name')
            .in('Genre_ID', genreIds)
          genres = (genreRows ?? []).map((row: Record<string, any>) => row.Name)
        }
      }
    }

    if (!artistProfile) {
      const { data: userGenreRows } = await db
        .from('ACCOUNT_PREF_GENRE')
        .select('Genre_ID')
        .eq('ACCOUNT_ID', userId)

      const { data: userInstrumentRows } = await db
        .from('ACCOUNT_PREF_INSTRUMENTS')
        .select('Instrument_ID')
        .eq('ACCOUNT_ID', userId)

      const genreIds = (userGenreRows ?? []).map((row: Record<string, any>) => row.Genre_ID)
      const instrumentIds = (userInstrumentRows ?? []).map((row: Record<string, any>) => row.Instrument_ID)

      if (genreIds.length) {
        const { data: genreRows } = await db
          .from('TAG_GENRE')
          .select('Name')
          .in('Genre_ID', genreIds)
        genres = (genreRows ?? []).map((row: Record<string, any>) => row.Name)
      }

      if (instrumentIds.length) {
        const { data: instrumentRows } = await db
          .from('TAG_INSTRUMENT')
          .select('Name')
          .in('Instrument_ID', instrumentIds)
        instruments = (instrumentRows ?? []).map((row: Record<string, any>) => row.Name)
      }
    }

    return {
      account,
      businessProfile: businessProfile ?? null,
      artistProfile,
      genres,
      instruments,
    }
  }

  const signUpWithTonoAccount = async (payload: {
    email: string
    password: string
    username: string
    city: string
    barangay: string
    userType: TonoUserRole
    artistType?: TonoArtistType | null
    artistProfile: {
      stageName: string
      bio: string
      facebook: string
      instagram: string
      youtube: string
      specialty: string
      additionalLinks: string[]
    }
    businessProfile: {
      businessName: string
      businessAddress: string
      businessService: string
      cellphone: number
      isBusinessOwner: boolean
    }
    genres: string[]
    instruments: string[]
  }) => {
    const cleanEmail = payload.email.trim().toLowerCase()
    const cleanUsername = payload.username.trim()

    await supabase.auth.signOut()

    const { emailTaken, usernameTaken } = await checkUserUniqueness(cleanEmail, cleanUsername)
    if (emailTaken) throw new Error('This email is already registered.')
    if (usernameTaken) throw new Error('This username is already taken.')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: payload.password,
      options: {
        data: {
          username: cleanUsername,
          city: payload.city,
          barangay: payload.barangay,
          userType: payload.userType,
          artistType: payload.artistType,
          artistProfile: payload.artistProfile,
          businessProfile: payload.businessProfile,
          genres: payload.genres,
          instruments: payload.instruments,
        },
      },
    })

    if (authError) throw authError

    const userId = authData.user?.id
    if (!userId) throw new Error('No user ID returned after signup.')

    const accountPayload = {
      ACCOUNT_ID: userId,
      Username: cleanUsername,
      Email: cleanEmail,
      City: payload.city || null,
      Barangay: payload.barangay || null,
    }

    const { error: accountInsertError } = await db.from('USER_ACCOUNT').upsert(accountPayload, { onConflict: 'ACCOUNT_ID' })
    if (accountInsertError) throw accountInsertError

    if (payload.userType === 'User' && payload.businessProfile?.isBusinessOwner) {
      const { error: businessInsertError } = await db.from('BUSINESS_PROFILE').insert({
        ACCOUNT_ID: userId,
        Business_Name: payload.businessProfile.businessName,
        Business_Address: payload.businessProfile.businessAddress || null,
        Contact_Information: payload.businessProfile.cellphone ? payload.businessProfile.cellphone.toString() : null,
        Business_Service: payload.businessProfile.businessService || null,
      })
      if (businessInsertError) throw businessInsertError
    }

    let artistId: string | null = null

    if (payload.userType === 'Artist') {
      const { data: artistData, error: artistError } = await db.from('ARTIST').insert({
        ACCOUNT_ID: userId,
        Artist_Type: payload.artistType,
        Bio: payload.artistProfile.bio,
        Links: {
          facebook: payload.artistProfile.facebook,
          instagram: payload.artistProfile.instagram,
          youtube: payload.artistProfile.youtube,
          additionalLinks: payload.artistProfile.additionalLinks,
        },
      }).select().single()

      if (artistError) throw artistError
      artistId = artistData.ARTIST_ID

      if (payload.artistType === 'Solo') {
        const { error: soloError } = await db.from('SOLO_ARTIST').insert({
          ARTIST_ID: artistId,
          Artist_Name: payload.artistProfile.stageName,
          Specialty: payload.artistProfile.specialty,
        })
        if (soloError) throw soloError
      } else if (payload.artistType === 'Band') {
        const { error: bandError } = await db.from('BAND').insert({
          ARTIST_ID: artistId,
          Band_Name: payload.artistProfile.stageName,
        })
        if (bandError) throw bandError
      }
    }

    // Resolve Genres
    let genreIds: string[] = []
    if (payload.genres && payload.genres.length > 0) {
      const { data: genreData } = await db.from('TAG_GENRE').select('Genre_ID').in('Name', payload.genres)
      if (genreData) genreIds = genreData.map((g: any) => g.Genre_ID)
    }

    // Resolve Instruments
    let instrumentIds: string[] = []
    if (payload.instruments && payload.instruments.length > 0) {
      const { data: instData } = await db.from('TAG_INSTRUMENT').select('Instrument_ID').in('Name', payload.instruments)
      if (instData) instrumentIds = instData.map((i: any) => i.Instrument_ID)
    }

    if (payload.userType === 'User') {
      if (genreIds.length > 0) {
        await db.from('ACCOUNT_PREF_GENRE').insert(genreIds.map((id: string) => ({ ACCOUNT_ID: userId, Genre_ID: id })))
      }
      if (instrumentIds.length > 0) {
        await db.from('ACCOUNT_PREF_INSTRUMENTS').insert(instrumentIds.map((id: string) => ({ ACCOUNT_ID: userId, Instrument_ID: id })))
      }
    } else if (payload.userType === 'Artist' && artistId) {
      if (payload.artistType === 'Solo') {
        if (genreIds.length > 0) {
          await db.from('SOLO_GENRES').insert(genreIds.map((id: string) => ({ ARTIST_ID: artistId, Genre_ID: id })))
        }
        if (instrumentIds.length > 0) {
          await db.from('SOLO_INSTRUMENTS').insert(instrumentIds.map((id: string) => ({ ARTIST_ID: artistId, Instrument_ID: id })))
        }
      } else if (payload.artistType === 'Band') {
        if (genreIds.length > 0) {
          await db.from('BAND_GENRES').insert(genreIds.map((id: string) => ({ ARTIST_ID: artistId, Genre_ID: id })))
        }
      }
    }

    return {
      userId,
      account: accountPayload,
    }
  }

  const signInWithTonoAccount = async (identifier: string, password: string) => {
    const email = await resolveLoginEmail(identifier)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) throw authError

    const profile = await fetchCurrentUserProfile(authData.user?.id)

    return {
      user: authData.user,
      profile,
    }
  }

  return {
    resolveLoginEmail,
    checkUserUniqueness,
    fetchCurrentUserProfile,
    signUpWithTonoAccount,
    signInWithTonoAccount,
  }
}
