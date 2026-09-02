-- Add Status column to ARTIST table with a default of 'Pending'
ALTER TABLE public."ARTIST"
ADD COLUMN "Status" TEXT NOT NULL DEFAULT 'Pending';

-- Optional: Add a check constraint to ensure only valid statuses are used
ALTER TABLE public."ARTIST"
ADD CONSTRAINT check_artist_status 
CHECK ("Status" IN ('Pending', 'Active', 'Rejected', 'Banned'));
