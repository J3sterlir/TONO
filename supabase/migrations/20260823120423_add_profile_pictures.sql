ALTER TABLE public."USER_ACCOUNT" 
ADD COLUMN "Profile_Picture" text,
ADD COLUMN "Cover_Picture" text;

ALTER TABLE public."BUSINESS_PROFILE" 
ADD COLUMN "Profile_Picture" text;