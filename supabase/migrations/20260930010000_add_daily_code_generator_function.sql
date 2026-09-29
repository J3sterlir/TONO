-- =============================================================================
-- Migration: 20260930010000_add_daily_code_generator_function.sql
-- Description: Adds get_next_daily_code(p_prefix) function to compute
--              daily sequential codes (e.g., JB-093001-2026, BK-093001-2026)
--              with smooth rollover handling for counts >= 99 (100, 101, ...).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_next_daily_code(p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    v_mmdd TEXT := to_char(CURRENT_DATE, 'MMDD');
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_pattern TEXT;
    v_max_seq INT := 0;
    v_next_seq INT;
    v_formatted_seq TEXT;
BEGIN
    v_pattern := upper(p_prefix) || '-' || v_mmdd || '%-' || v_year;
    
    IF upper(p_prefix) = 'JB' THEN
        SELECT COALESCE(MAX(
            NULLIF(regexp_replace("Job_Code", '^' || upper(p_prefix) || '-' || v_mmdd || '(\d+)-' || v_year || '$', '\1', 'i'), "Job_Code")::INT
        ), 0)
        INTO v_max_seq
        FROM public."JOB_LISTING"
        WHERE "Job_Code" ILIKE v_pattern;
    ELSIF upper(p_prefix) = 'BK' THEN
        SELECT COALESCE(MAX(
            NULLIF(regexp_replace("Contract_Code", '^' || upper(p_prefix) || '-' || v_mmdd || '(\d+)-' || v_year || '$', '\1', 'i'), "Contract_Code")::INT
        ), 0)
        INTO v_max_seq
        FROM public."BOOKING_CONTRACT"
        WHERE "Contract_Code" ILIKE v_pattern;
    END IF;

    v_next_seq := v_max_seq + 1;
    
    IF v_next_seq < 100 THEN
        v_formatted_seq := lpad(v_next_seq::TEXT, 2, '0');
    ELSE
        v_formatted_seq := v_next_seq::TEXT;
    END IF;

    RETURN upper(p_prefix) || '-' || v_mmdd || v_formatted_seq || '-' || v_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
