-- admin to read account pref genres and pref ins
CREATE POLICY "Admins can view all ACCOUNT_PREF_GENRE" ON "public"."ACCOUNT_PREF_GENRE"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));

CREATE POLICY "Admins can view all ACCOUNT_PREF_INSTRUMENTS" ON "public"."ACCOUNT_PREF_INSTRUMENTS"
AS PERMISSIVE FOR SELECT TO authenticated
USING (exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid()));
