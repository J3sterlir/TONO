CREATE POLICY "Admins can view all artists" ON "public"."ARTIST"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid())
);

-- If you also want admins to be able to UPDATE (Approve/Reject) the artist status, run this too:
CREATE POLICY "Admins can update artists" ON "public"."ARTIST"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid())
)
WITH CHECK (
  exists(select 1 from "public"."ADMIN" where "ADMIN"."ADMIN_ID" = auth.uid())
);