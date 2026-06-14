DROP POLICY IF EXISTS "Anyone can insert outcome selections" ON public.outcome_selections;
DROP POLICY IF EXISTS "Anyone can update own device selections" ON public.outcome_selections;

CREATE POLICY "Insert with device id"
ON public.outcome_selections FOR INSERT
TO anon, authenticated
WITH CHECK (device_id IS NOT NULL AND length(device_id) > 0);

CREATE OR REPLACE FUNCTION public.record_outcome_checkin(
  p_id UUID,
  p_device_id TEXT,
  p_status TEXT,
  p_energy TEXT,
  p_digestion TEXT,
  p_reorder BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.outcome_selections
  SET checkin_status = p_status,
      checkin_energy = p_energy,
      checkin_digestion = p_digestion,
      checkin_reorder = p_reorder,
      checkin_at = now()
  WHERE id = p_id AND device_id = p_device_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_outcome_checkin(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;