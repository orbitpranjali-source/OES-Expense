-- Drop the existing restrictive SELECT policies on advance_requests
DROP POLICY IF EXISTS "Managers can view all advance requests" ON public.advance_requests;
DROP POLICY IF EXISTS "Users can view own advance requests" ON public.advance_requests;
DROP POLICY IF EXISTS "Accounts can view approved advances" ON public.advance_requests;

-- Recreate as PERMISSIVE policies (which is the default)
-- Permissive policies use OR logic - if ANY policy passes, access is granted

CREATE POLICY "Users can view own advance requests" 
ON public.advance_requests 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Managers can view all advance requests" 
ON public.advance_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::user_role) OR has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Accounts can view approved advances" 
ON public.advance_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'accounts'::user_role) AND status IN ('approved', 'disbursed'));