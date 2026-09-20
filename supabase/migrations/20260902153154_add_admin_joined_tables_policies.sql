-- Allow admins to read USER_ACCOUNT profiles
CREATE POLICY "Admins can view all USER_ACCOUNTs" ON "public"."USER_ACCOUNT"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to read SOLO_ARTIST details
CREATE POLICY "Admins can view all SOLO_ARTISTs" ON "public"."SOLO_ARTIST"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to read BAND details
CREATE POLICY "Admins can view all BANDs" ON "public"."BAND"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

-- Allow admins to read genres and instruments
CREATE POLICY "Admins can view all SOLO_GENRES" ON "public"."SOLO_GENRES"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

CREATE POLICY "Admins can view all BAND_GENRES" ON "public"."BAND_GENRES"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

CREATE POLICY "Admins can view all SOLO_INSTRUMENTS" ON "public"."SOLO_INSTRUMENTS"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));
