-- for artist type enum or static stypes
CREATE TYPE artist_type_enum AS ENUM ('Solo', 'Band');

-- for user and admin tables
CREATE TABLE "ADMIN" (
    "ADMIN_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Username" TEXT UNIQUE NOT NULL,
    "Email" TEXT UNIQUE NOT NULL,
    "Password" TEXT NOT NULL, -- if using Supabase Auth, remove this column
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "USER_ACCOUNT" (
    "ACCOUNT_ID" UUID PRIMARY KEY, -- reference to auth.users(id)
    "Username" TEXT UNIQUE NOT NULL,
    "Email" TEXT UNIQUE NOT NULL,
    "Password" TEXT, -- if using Supabase Auth, remove this column
    "City" TEXT,
    "Barangay" TEXT,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Business Profile
CREATE TABLE "BUSINESS_PROFILE" (
    "BUSINESS_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ACCOUNT_ID" UUID REFERENCES "USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Business_Name" TEXT NOT NULL,
    "Business_Address" TEXT,
    "Contact_Information" TEXT, 
    "Business_Service" TEXT
);

-- for artist tables Supertype & Subtypes
CREATE TABLE "ARTIST" (
    "ARTIST_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ACCOUNT_ID" UUID REFERENCES "USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Artist_Type" artist_type_enum NOT NULL,
    "Bio" TEXT,
    "Links" JSONB, -- arrays links (FB, IG, YouTube)JSONB to use
    "Is_Verified" BOOLEAN DEFAULT FALSE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "SOLO_ARTIST" (
    "ARTIST_ID" UUID PRIMARY KEY REFERENCES "ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Artist_Name" TEXT NOT NULL
);

CREATE TABLE "BAND" (
    "ARTIST_ID" UUID PRIMARY KEY REFERENCES "ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Band_Name" TEXT NOT NULL,
    "Formation_Date" DATE
);

--Tag Tables
CREATE TABLE "TAG_INSTRUMENT" (
    "Instrument_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" TEXT UNIQUE NOT NULL,
    "Is_active" BOOLEAN DEFAULT TRUE
);

CREATE TABLE "TAG_GENRE" (
    "Genre_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" TEXT UNIQUE NOT NULL,
    "Is_active" BOOLEAN DEFAULT TRUE
);

-- JUNCTION TABLES M TO M Tables

-- User PREF TAGS
CREATE TABLE "ACCOUNT_PREF_INSTRUMENTS" (
    "ACCOUNT_ID" UUID REFERENCES "USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Instrument_ID" UUID REFERENCES "TAG_INSTRUMENT"("Instrument_ID") ON DELETE CASCADE,
    PRIMARY KEY ("ACCOUNT_ID", "Instrument_ID") -- Prevents duping
);

CREATE TABLE "ACCOUNT_PREF_GENRE" (
    "ACCOUNT_ID" UUID REFERENCES "USER_ACCOUNT"("ACCOUNT_ID") ON DELETE CASCADE,
    "Genre_ID" UUID REFERENCES "TAG_GENRE"("Genre_ID") ON DELETE CASCADE,
    PRIMARY KEY ("ACCOUNT_ID", "Genre_ID")
);

-- Solo Artist Tags
CREATE TABLE "SOLO_INSTRUMENTS" (
    "ARTIST_ID" UUID REFERENCES "SOLO_ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Instrument_ID" UUID REFERENCES "TAG_INSTRUMENT"("Instrument_ID") ON DELETE CASCADE,
    PRIMARY KEY ("ARTIST_ID", "Instrument_ID")
);

CREATE TABLE "SOLO_GENRES" (
    "ARTIST_ID" UUID REFERENCES "SOLO_ARTIST"("ARTIST_ID") ON DELETE CASCADE,
    "Genre_ID" UUID REFERENCES "TAG_GENRE"("Genre_ID") ON DELETE CASCADE,
    PRIMARY KEY ("ARTIST_ID", "Genre_ID")
);

-- Band Tags
CREATE TABLE "BAND_GENRES" (
    "ARTIST_ID" UUID REFERENCES "BAND"("ARTIST_ID") ON DELETE CASCADE,
    "Genre_ID" UUID REFERENCES "TAG_GENRE"("Genre_ID") ON DELETE CASCADE,
    PRIMARY KEY ("ARTIST_ID", "Genre_ID")
);