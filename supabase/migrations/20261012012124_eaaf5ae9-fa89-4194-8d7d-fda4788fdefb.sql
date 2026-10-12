REVOKE EXECUTE ON FUNCTION public.fn_create_seller_payout_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_eligible_seller_payouts() FROM PUBLIC, anon;