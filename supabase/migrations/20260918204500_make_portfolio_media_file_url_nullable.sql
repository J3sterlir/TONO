-- Allow milestones (and other portfolio media) to have optional images / nullable File_URL
ALTER TABLE public."PORTFOLIO_MEDIA"
  ALTER COLUMN "File_URL" DROP NOT NULL;
