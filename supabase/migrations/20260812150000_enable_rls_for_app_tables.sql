ALTER TABLE "TAG_INSTRUMENT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TAG_GENRE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "USER_ACCOUNT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BUSINESS_PROFILE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ARTIST" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SOLO_ARTIST" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BAND" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ACCOUNT_PREF_INSTRUMENTS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ACCOUNT_PREF_GENRE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SOLO_INSTRUMENTS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SOLO_GENRES" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BAND_GENRES" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active genre tags"
ON "TAG_GENRE"
FOR SELECT
USING ("Is_active" = true);

CREATE POLICY "Public can read active instrument tags"
ON "TAG_INSTRUMENT"
FOR SELECT
USING ("Is_active" = true);

CREATE POLICY "Authenticated users can insert genre tags"
ON "TAG_GENRE"
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert instrument tags"
ON "TAG_INSTRUMENT"
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read own account"
ON "USER_ACCOUNT"
FOR SELECT
USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can insert own account"
ON "USER_ACCOUNT"
FOR INSERT
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can update own account"
ON "USER_ACCOUNT"
FOR UPDATE
USING (auth.uid() = "ACCOUNT_ID")
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can read own business profile"
ON "BUSINESS_PROFILE"
FOR SELECT
USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can insert own business profile"
ON "BUSINESS_PROFILE"
FOR INSERT
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can update own business profile"
ON "BUSINESS_PROFILE"
FOR UPDATE
USING (auth.uid() = "ACCOUNT_ID")
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can read own artist profile"
ON "ARTIST"
FOR SELECT
USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can insert own artist profile"
ON "ARTIST"
FOR INSERT
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can update own artist profile"
ON "ARTIST"
FOR UPDATE
USING (auth.uid() = "ACCOUNT_ID")
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can read own solo artist profile"
ON "SOLO_ARTIST"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "SOLO_ARTIST"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can update own solo artist profile"
ON "SOLO_ARTIST"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "SOLO_ARTIST"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "SOLO_ARTIST"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can insert own solo artist profile"
ON "SOLO_ARTIST"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "SOLO_ARTIST"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can read own band profile"
ON "BAND"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "BAND"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can update own band profile"
ON "BAND"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "BAND"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "BAND"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can insert own band profile"
ON "BAND"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "ARTIST" a
    WHERE a."ARTIST_ID" = "BAND"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can read own account genre preferences"
ON "ACCOUNT_PREF_GENRE"
FOR SELECT
USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can manage own account genre preferences"
ON "ACCOUNT_PREF_GENRE"
FOR INSERT
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can read own account instrument preferences"
ON "ACCOUNT_PREF_INSTRUMENTS"
FOR SELECT
USING (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can manage own account instrument preferences"
ON "ACCOUNT_PREF_INSTRUMENTS"
FOR INSERT
WITH CHECK (auth.uid() = "ACCOUNT_ID");

CREATE POLICY "Users can read own solo genre tags"
ON "SOLO_GENRES"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "SOLO_ARTIST" sa
    JOIN "ARTIST" a ON a."ARTIST_ID" = sa."ARTIST_ID"
    WHERE sa."ARTIST_ID" = "SOLO_GENRES"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can manage own solo genre tags"
ON "SOLO_GENRES"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "SOLO_ARTIST" sa
    JOIN "ARTIST" a ON a."ARTIST_ID" = sa."ARTIST_ID"
    WHERE sa."ARTIST_ID" = "SOLO_GENRES"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can read own solo instrument tags"
ON "SOLO_INSTRUMENTS"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "SOLO_ARTIST" sa
    JOIN "ARTIST" a ON a."ARTIST_ID" = sa."ARTIST_ID"
    WHERE sa."ARTIST_ID" = "SOLO_INSTRUMENTS"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can manage own solo instrument tags"
ON "SOLO_INSTRUMENTS"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "SOLO_ARTIST" sa
    JOIN "ARTIST" a ON a."ARTIST_ID" = sa."ARTIST_ID"
    WHERE sa."ARTIST_ID" = "SOLO_INSTRUMENTS"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can read own band genre tags"
ON "BAND_GENRES"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "BAND" b
    JOIN "ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
    WHERE b."ARTIST_ID" = "BAND_GENRES"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);

CREATE POLICY "Users can manage own band genre tags"
ON "BAND_GENRES"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "BAND" b
    JOIN "ARTIST" a ON a."ARTIST_ID" = b."ARTIST_ID"
    WHERE b."ARTIST_ID" = "BAND_GENRES"."ARTIST_ID"
      AND a."ACCOUNT_ID" = auth.uid()
  )
);
