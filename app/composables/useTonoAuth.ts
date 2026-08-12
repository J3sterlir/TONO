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
  Bio: string | null
  Links: Record<string, unknown> | null
  Is_Verified: boolean
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

    const { data, error } = await db
      .from('USER_ACCOUNT')
      .select('Email')
      .eq('Username', value)
      .maybeSingle()

    if (error) throw error
    return data?.Email || value
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

  const getOrCreateTagIds = async (table: 'TAG_GENRE' | 'TAG_INSTRUMENT', values: string[]): Promise<string[]> => {
    const uniqueValues = [...new Set(values.map((value: string) => value.trim()).filter(Boolean))]
    if (!uniqueValues.length) return []

    const selectField = table === 'TAG_GENRE' ? 'Genre_ID, Name' : 'Instrument_ID, Name'
    const { data: existingRows, error: readError } = await db
      .from(table)
      .select(selectField)
      .in('Name', uniqueValues)

    if (readError) throw readError

    const typedRows: Record<string, any>[] = existingRows ?? []
    const existingNames = new Set(typedRows.map((row) => row.Name))
    const missingValues = uniqueValues.filter((value) => !existingNames.has(value))

    if (missingValues.length) {
      const createdRows = await db
        .from(table)
        .insert(missingValues.map((value) => ({ Name: value, Is_active: true })))
        .select(selectField)

      if (createdRows.error) throw createdRows.error

      const allRows = [...typedRows, ...(createdRows.data ?? [])]
      return allRows.map((row) => (table === 'TAG_GENRE' ? row.Genre_ID : row.Instrument_ID))
    }

    return typedRows.map((row) => (table === 'TAG_GENRE' ? row.Genre_ID : row.Instrument_ID))
  }

  const insertUserTagLinks = async (userId: string, genres: string[], instruments: string[]) => {
    const genreIds = await getOrCreateTagIds('TAG_GENRE', genres)
    const instrumentIds = await getOrCreateTagIds('TAG_INSTRUMENT', instruments)

    if (genreIds.length) {
      const { error: genreError } = await db
        .from('ACCOUNT_PREF_GENRE')
        .insert(genreIds.map((genreId: string) => ({ ACCOUNT_ID: userId, Genre_ID: genreId })))

      if (genreError) throw genreError
    }

    if (instrumentIds.length) {
      const { error: instrumentError } = await db
        .from('ACCOUNT_PREF_INSTRUMENTS')
        .insert(instrumentIds.map((instrumentId: string) => ({ ACCOUNT_ID: userId, Instrument_ID: instrumentId })))

      if (instrumentError) throw instrumentError
    }
  }

  const insertArtistTagLinks = async (artistId: string, artistType: TonoArtistType, genres: string[], instruments: string[]) => {
    const genreIds = await getOrCreateTagIds('TAG_GENRE', genres)
    const instrumentIds = await getOrCreateTagIds('TAG_INSTRUMENT', instruments)

    if (artistType === 'Solo') {
      if (genreIds.length) {
        const { error: genreError } = await db
          .from('SOLO_GENRES')
          .insert(genreIds.map((genreId: string) => ({ ARTIST_ID: artistId, Genre_ID: genreId })))

        if (genreError) throw genreError
      }

      if (instrumentIds.length) {
        const { error: instrumentError } = await db
          .from('SOLO_INSTRUMENTS')
          .insert(instrumentIds.map((instrumentId: string) => ({ ARTIST_ID: artistId, Instrument_ID: instrumentId })))

        if (instrumentError) throw instrumentError
      }
    }

    if (artistType === 'Band') {
      if (genreIds.length) {
        const { error: genreError } = await db
          .from('BAND_GENRES')
          .insert(genreIds.map((genreId: string) => ({ ARTIST_ID: artistId, Genre_ID: genreId })))

        if (genreError) throw genreError
      }
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
        },
      },
    })

    if (authError) throw authError

    const userId = authData.user?.id
    if (!userId) throw new Error('No user ID returned after signup.')

    const { data: existingUserProfile } = await db
      .from('USER_ACCOUNT')
      .select('ACCOUNT_ID')
      .eq('ACCOUNT_ID', userId)
      .maybeSingle()

    if (existingUserProfile) {
      throw new Error('This account already has a profile record.')
    }

    const accountPayload = {
      ACCOUNT_ID: userId,
      Username: cleanUsername,
      Email: cleanEmail,
      City: payload.city || null,
      Barangay: payload.barangay || null,
    }

    const { error: accountError } = await db.from('USER_ACCOUNT').insert(accountPayload)
    if (accountError) throw accountError

    if (payload.userType === 'Artist') {
      const { data: existingArtistProfile } = await db
        .from('ARTIST')
        .select('ARTIST_ID')
        .eq('ACCOUNT_ID', userId)
        .maybeSingle()

      if (existingArtistProfile) {
        throw new Error('This account already has an artist profile.')
      }

      const artistPayload = {
        ACCOUNT_ID: userId,
        Artist_Type: payload.artistType,
        Bio: payload.artistProfile.bio.trim(),
        Links: {
          facebook: payload.artistProfile.facebook.trim() || null,
          instagram: payload.artistProfile.instagram.trim() || null,
          youtube: payload.artistProfile.youtube.trim() || null,
          specialty: payload.artistProfile.specialty.trim() || null,
          additionalLinks: payload.artistProfile.additionalLinks
            .filter((link) => link && link.trim())
            .map((link) => link.trim()),
        },
        Is_Verified: false,
      }

      const { data: artistRow, error: artistError } = await db
        .from('ARTIST')
        .insert(artistPayload)
        .select('ARTIST_ID')
        .single()

      if (artistError) throw artistError

      if (payload.artistType === 'Solo') {
        const { error: soloError } = await db
          .from('SOLO_ARTIST')
          .insert({
            ARTIST_ID: artistRow.ARTIST_ID,
            Artist_Name: payload.artistProfile.stageName.trim(),
          })

        if (soloError) throw soloError
      }

      if (payload.artistType === 'Band') {
        const { error: bandError } = await db
          .from('BAND')
          .insert({
            ARTIST_ID: artistRow.ARTIST_ID,
            Band_Name: payload.artistProfile.stageName.trim(),
            Formation_Date: null,
          })

        if (bandError) throw bandError
      }

      await insertArtistTagLinks(artistRow.ARTIST_ID, payload.artistType || 'Solo', payload.genres, payload.instruments)
    }

    if (payload.userType === 'User') {
      if (payload.businessProfile.isBusinessOwner) {
        const { error: businessError } = await db.from('BUSINESS_PROFILE').insert({
          ACCOUNT_ID: userId,
          Business_Name: payload.businessProfile.businessName.trim(),
          Business_Address: payload.businessProfile.businessAddress.trim(),
          Contact_Information: String(payload.businessProfile.cellphone || ''),
          Business_Service: payload.businessProfile.businessService.trim(),
        })

        if (businessError) throw businessError
      }
    }

    await insertUserTagLinks(userId, payload.genres, payload.instruments)

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
