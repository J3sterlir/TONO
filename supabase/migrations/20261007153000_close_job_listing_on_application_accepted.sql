-- Migration: 20261007153000_close_job_listing_on_application_accepted.sql
-- Description: Automatically updates JOB_LISTING status to 'Closed' whenever an APPLICATION status transitions to 'Accepted'.

CREATE OR REPLACE FUNCTION public.close_job_listing_on_application_accepted()
RETURNS TRIGGER AS $$
BEGIN
    -- When an application is marked as 'Accepted'
    IF NEW."Status" = 'Accepted' AND (OLD."Status" IS DISTINCT FROM 'Accepted') THEN
        -- Close the parent JOB_LISTING so no more applications are accepted
        UPDATE public."JOB_LISTING"
        SET "Status" = 'Closed'
        WHERE "Job_ID" = NEW."Job_ID"
          AND "Status" != 'Closed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists to guarantee idempotency
DROP TRIGGER IF EXISTS trg_close_job_listing_on_application_accepted ON public."APPLICATION";

-- Trigger whenever an APPLICATION is updated or inserted with Status = 'Accepted'
CREATE TRIGGER trg_close_job_listing_on_application_accepted
AFTER INSERT OR UPDATE OF "Status" ON public."APPLICATION"
FOR EACH ROW
EXECUTE FUNCTION public.close_job_listing_on_application_accepted();
