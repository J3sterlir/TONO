-- =============================================================================
-- Migration: 20260910001000_add_specialty_to_matching_rpc.sql
-- Description: Add specialty column to tono_match_recommendations RPC output
-- =============================================================================

DROP FUNCTION IF EXISTS public.tono_match_recommendations(UUID, TEXT, BOOLEAN, NUMERIC, NUMERIC, INT);

CREATE OR REPLACE FUNCTION public.tono_match_recommendations(
    p_user_id UUID DEFAULT auth.uid(),
    p_context TEXT DEFAULT 'discovery',           -- 'discovery' | 'recruitment'
    p_apply_location_filter BOOLEAN DEFAULT TRUE,  -- TRUE = Barangay -> City fallback; FALSE = Global
    p_weight_genre NUMERIC DEFAULT NULL,         -- Defaults: 0.8 (discovery), 0.3 (recruitment)
    p_weight_instrument NUMERIC DEFAULT NULL,    -- Defaults: 0.2 (discovery), 0.7 (recruitment)
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    user_id UUID,
    artist_id UUID,
    display_name TEXT,
    specialty TEXT,
    artist_type TEXT,
    profile_picture TEXT,
    cover_picture TEXT,
    city TEXT,
    barangay TEXT,
    matched_location_level TEXT, -- 'Barangay', 'City', or 'Global'
    genres TEXT[],
    instruments TEXT[],
    shared_genres TEXT[],
    shared_instruments TEXT[],
    genre_score NUMERIC,
    instrument_score NUMERIC,
    total_score NUMERIC,
    match_tier TEXT              -- 'High', 'Medium', 'Low', 'Unmatched'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_city TEXT;
    v_user_barangay TEXT;
    v_w_genre NUMERIC;
    v_w_inst NUMERIC;
    v_user_genres UUID[] := ARRAY[]::UUID[];
    v_user_instruments UUID[] := ARRAY[]::UUID[];
    v_selected_loc_level TEXT := 'Global';
    v_brgy_count INT := 0;
    v_city_count INT := 0;
BEGIN
    -- 1. Resolve User ID (prefer argument, fallback to auth.uid())
    v_user_id := COALESCE(p_user_id, auth.uid());

    -- 2. Determine Context Weights
    IF p_context = 'recruitment' THEN
        v_w_genre := COALESCE(p_weight_genre, 0.3);
        v_w_inst  := COALESCE(p_weight_instrument, 0.7);
    ELSE
        v_w_genre := COALESCE(p_weight_genre, 0.8);
        v_w_inst  := COALESCE(p_weight_instrument, 0.2);
    END IF;

    -- 3. Resolve Requesting User Profile & Location
    IF v_user_id IS NOT NULL THEN
        SELECT TRIM("City"), TRIM("Barangay")
        INTO v_user_city, v_user_barangay
        FROM public."USER_ACCOUNT"
        WHERE "ACCOUNT_ID" = v_user_id;

        IF v_user_city = '' THEN v_user_city := NULL; END IF;
        IF v_user_barangay = '' THEN v_user_barangay := NULL; END IF;

        -- Resolve Requester Genres (combining USER and ARTIST tag entries)
        SELECT COALESCE(ARRAY_AGG(DISTINCT g_id), ARRAY[]::UUID[])
        INTO v_user_genres
        FROM (
            SELECT "Genre_ID" AS g_id FROM public."ACCOUNT_PREF_GENRE" WHERE "ACCOUNT_ID" = v_user_id
            UNION
            SELECT sg."Genre_ID" FROM public."SOLO_GENRES" sg
            JOIN public."ARTIST" a ON a."ARTIST_ID" = sg."ARTIST_ID"
            WHERE a."ACCOUNT_ID" = v_user_id
            UNION
            SELECT bg."Genre_ID" FROM public."BAND_GENRES" bg
            JOIN public."ARTIST" a ON a."ARTIST_ID" = bg."ARTIST_ID"
            WHERE a."ACCOUNT_ID" = v_user_id
        ) q_genres
        WHERE g_id IS NOT NULL;

        -- Resolve Requester Instruments
        SELECT COALESCE(ARRAY_AGG(DISTINCT i_id), ARRAY[]::UUID[])
        INTO v_user_instruments
        FROM (
            SELECT "Instrument_ID" AS i_id FROM public."ACCOUNT_PREF_INSTRUMENTS" WHERE "ACCOUNT_ID" = v_user_id
            UNION
            SELECT si."Instrument_ID" FROM public."SOLO_INSTRUMENTS" si
            JOIN public."ARTIST" a ON a."ARTIST_ID" = si."ARTIST_ID"
            WHERE a."ACCOUNT_ID" = v_user_id
        ) q_inst
        WHERE i_id IS NOT NULL;
    END IF;

    -- 4. Location Gateway: Determine Active Location Level
    IF p_apply_location_filter IS TRUE AND v_user_city IS NOT NULL THEN
        IF v_user_barangay IS NOT NULL THEN
            SELECT COUNT(*) INTO v_brgy_count
            FROM public."USER_ACCOUNT" ua
            JOIN public."ARTIST" a ON a."ACCOUNT_ID" = ua."ACCOUNT_ID"
            WHERE (v_user_id IS NULL OR ua."ACCOUNT_ID" <> v_user_id)
              AND (ua."Is_Banned" IS NOT TRUE)
              AND a."Status" = 'Active'
              AND LOWER(TRIM(COALESCE(ua."City", ''))) = LOWER(v_user_city)
              AND LOWER(TRIM(COALESCE(ua."Barangay", ''))) = LOWER(v_user_barangay);

            IF v_brgy_count > 0 THEN
                v_selected_loc_level := 'Barangay';
            END IF;
        END IF;

        IF v_selected_loc_level = 'Global' THEN
            SELECT COUNT(*) INTO v_city_count
            FROM public."USER_ACCOUNT" ua
            JOIN public."ARTIST" a ON a."ACCOUNT_ID" = ua."ACCOUNT_ID"
            WHERE (v_user_id IS NULL OR ua."ACCOUNT_ID" <> v_user_id)
              AND (ua."Is_Banned" IS NOT TRUE)
              AND a."Status" = 'Active'
              AND LOWER(TRIM(COALESCE(ua."City", ''))) = LOWER(v_user_city);

            IF v_city_count > 0 THEN
                v_selected_loc_level := 'City';
            END IF;
        END IF;
    END IF;

    -- 5. Candidate Aggregation, Jaccard Similarity Calculation & Delivery
    RETURN QUERY
    WITH candidate_base AS (
        SELECT
            ua."ACCOUNT_ID" AS c_user_id,
            a."ARTIST_ID" AS c_artist_id,
            COALESCE(b."Band_Name", sa."Artist_Name", ua."Username", 'Artist') AS c_name,
            COALESCE(sa."Specialty", CASE WHEN a."Artist_Type"::TEXT = 'Band' THEN 'Band' ELSE 'Musician' END) AS c_specialty,
            a."Artist_Type"::TEXT AS c_type,
            ua."Profile_Picture" AS c_profile_pic,
            ua."Cover_Picture" AS c_cover_pic,
            ua."City" AS c_city,
            ua."Barangay" AS c_brgy,
            CASE
                WHEN v_user_city IS NOT NULL AND v_user_barangay IS NOT NULL
                     AND LOWER(TRIM(COALESCE(ua."City", ''))) = LOWER(v_user_city)
                     AND LOWER(TRIM(COALESCE(ua."Barangay", ''))) = LOWER(v_user_barangay) THEN 'Barangay'
                WHEN v_user_city IS NOT NULL
                     AND LOWER(TRIM(COALESCE(ua."City", ''))) = LOWER(v_user_city) THEN 'City'
                ELSE 'Global'
            END AS c_loc_level,
            -- Aggregate candidate genre UUIDs
            COALESCE((
                SELECT ARRAY_AGG(DISTINCT g_id)
                FROM (
                    SELECT sg."Genre_ID" AS g_id FROM public."SOLO_GENRES" sg WHERE sg."ARTIST_ID" = a."ARTIST_ID"
                    UNION
                    SELECT bg."Genre_ID" AS g_id FROM public."BAND_GENRES" bg WHERE bg."ARTIST_ID" = a."ARTIST_ID"
                    UNION
                    SELECT apg."Genre_ID" AS g_id FROM public."ACCOUNT_PREF_GENRE" apg WHERE apg."ACCOUNT_ID" = ua."ACCOUNT_ID"
                ) tg WHERE g_id IS NOT NULL
            ), ARRAY[]::UUID[]) AS c_genre_ids,
            -- Aggregate candidate instrument UUIDs
            COALESCE((
                SELECT ARRAY_AGG(DISTINCT i_id)
                FROM (
                    SELECT si."Instrument_ID" AS i_id FROM public."SOLO_INSTRUMENTS" si WHERE si."ARTIST_ID" = a."ARTIST_ID"
                    UNION
                    SELECT api."Instrument_ID" AS i_id FROM public."ACCOUNT_PREF_INSTRUMENTS" api WHERE api."ACCOUNT_ID" = ua."ACCOUNT_ID"
                    UNION
                    SELECT bapi."Instrument_ID" AS i_id
                    FROM public."BAND_MEMBERS" bm
                    JOIN public."ACCOUNT_PREF_INSTRUMENTS" bapi ON bapi."ACCOUNT_ID" = bm."Member_ID"
                    WHERE bm."Band_ID" = a."ARTIST_ID" AND bm."Status" = 'Accepted'
                ) ti WHERE i_id IS NOT NULL
            ), ARRAY[]::UUID[]) AS c_inst_ids
        FROM public."ARTIST" a
        JOIN public."USER_ACCOUNT" ua ON ua."ACCOUNT_ID" = a."ACCOUNT_ID"
        LEFT JOIN public."SOLO_ARTIST" sa ON sa."ARTIST_ID" = a."ARTIST_ID"
        LEFT JOIN public."BAND" b ON b."ARTIST_ID" = a."ARTIST_ID"
        WHERE (v_user_id IS NULL OR ua."ACCOUNT_ID" <> v_user_id)
          AND (ua."Is_Banned" IS NOT TRUE)
          AND a."Status" = 'Active'
          AND (
              p_apply_location_filter IS FALSE
              OR v_selected_loc_level = 'Global'
              OR (v_selected_loc_level = 'Barangay' AND LOWER(TRIM(COALESCE(ua."City", ''))) = LOWER(v_user_city) AND LOWER(TRIM(COALESCE(ua."Barangay", ''))) = LOWER(v_user_barangay))
              OR (v_selected_loc_level = 'City' AND LOWER(TRIM(COALESCE(ua."City", ''))) = LOWER(v_user_city))
          )
    ),
    similarity_calc AS (
        SELECT
            cb.*,
            -- Intersected & United Genres
            COALESCE((SELECT ARRAY_AGG(x) FROM (SELECT unnest(v_user_genres) INTERSECT SELECT unnest(cb.c_genre_ids)) i(x)), ARRAY[]::UUID[]) AS g_inter,
            COALESCE((SELECT ARRAY_AGG(x) FROM (SELECT unnest(v_user_genres) UNION SELECT unnest(cb.c_genre_ids)) u(x)), ARRAY[]::UUID[]) AS g_union,
            -- Intersected & United Instruments
            COALESCE((SELECT ARRAY_AGG(x) FROM (SELECT unnest(v_user_instruments) INTERSECT SELECT unnest(cb.c_inst_ids)) i(x)), ARRAY[]::UUID[]) AS i_inter,
            COALESCE((SELECT ARRAY_AGG(x) FROM (SELECT unnest(v_user_instruments) UNION SELECT unnest(cb.c_inst_ids)) u(x)), ARRAY[]::UUID[]) AS i_union
        FROM candidate_base cb
    ),
    scored_candidates AS (
        SELECT
            sc.c_user_id,
            sc.c_artist_id,
            sc.c_name AS display_name,
            sc.c_specialty AS specialty,
            sc.c_type,
            sc.c_profile_pic,
            sc.c_cover_pic,
            sc.c_city,
            sc.c_brgy,
            sc.c_loc_level,
            -- Resolve candidate tag text names
            COALESCE((SELECT ARRAY_AGG(tg."Name" ORDER BY tg."Name") FROM public."TAG_GENRE" tg WHERE tg."Genre_ID" = ANY(sc.c_genre_ids)), ARRAY[]::TEXT[]) AS tag_genres,
            COALESCE((SELECT ARRAY_AGG(ti."Name" ORDER BY ti."Name") FROM public."TAG_INSTRUMENT" ti WHERE ti."Instrument_ID" = ANY(sc.c_inst_ids)), ARRAY[]::TEXT[]) AS tag_insts,
            COALESCE((SELECT ARRAY_AGG(tg."Name" ORDER BY tg."Name") FROM public."TAG_GENRE" tg WHERE tg."Genre_ID" = ANY(sc.g_inter)), ARRAY[]::TEXT[]) AS shared_g,
            COALESCE((SELECT ARRAY_AGG(ti."Name" ORDER BY ti."Name") FROM public."TAG_INSTRUMENT" ti WHERE ti."Instrument_ID" = ANY(sc.i_inter)), ARRAY[]::TEXT[]) AS shared_i,
            -- Isolated Jaccard Scores with Zero-Division Protection
            CASE
                WHEN cardinality(sc.g_union) = 0 OR sc.g_union IS NULL THEN 0.0
                ELSE ROUND((cardinality(sc.g_inter)::numeric / cardinality(sc.g_union)::numeric), 4)
            END AS score_g,
            CASE
                WHEN cardinality(sc.i_union) = 0 OR sc.i_union IS NULL THEN 0.0
                ELSE ROUND((cardinality(sc.i_inter)::numeric / cardinality(sc.i_union)::numeric), 4)
            END AS score_i
        FROM similarity_calc sc
    )
    SELECT
        s.c_user_id AS user_id,
        s.c_artist_id AS artist_id,
        s.display_name,
        s.specialty,
        s.c_type AS artist_type,
        s.c_profile_pic AS profile_picture,
        s.c_cover_pic AS cover_picture,
        s.c_city AS city,
        s.c_brgy AS barangay,
        s.c_loc_level AS matched_location_level,
        s.tag_genres AS genres,
        s.tag_insts AS instruments,
        s.shared_g AS shared_genres,
        s.shared_i AS shared_instruments,
        s.score_g AS genre_score,
        s.score_i AS instrument_score,
        ROUND((s.score_g * v_w_genre) + (s.score_i * v_w_inst), 4) AS total_score,
        CASE
            WHEN ROUND((s.score_g * v_w_genre) + (s.score_i * v_w_inst), 4) >= 0.70 THEN 'High'
            WHEN ROUND((s.score_g * v_w_genre) + (s.score_i * v_w_inst), 4) >= 0.30 THEN 'Medium'
            WHEN ROUND((s.score_g * v_w_genre) + (s.score_i * v_w_inst), 4) > 0.00 THEN 'Low'
            ELSE 'Unmatched'
        END AS match_tier
    FROM scored_candidates s
    ORDER BY
        CASE s.c_loc_level
            WHEN 'Barangay' THEN 1
            WHEN 'City' THEN 2
            ELSE 3
        END ASC,
        ROUND((s.score_g * v_w_genre) + (s.score_i * v_w_inst), 4) DESC,
        s.display_name ASC
    LIMIT p_limit;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.tono_match_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION public.tono_match_recommendations TO anon;
