REVOKE EXECUTE ON FUNCTION public.run_monthly_carryover() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_carryover(uuid, date) FROM anon, PUBLIC;