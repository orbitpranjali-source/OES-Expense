-- Create advance request status enum
CREATE TYPE public.advance_status AS ENUM ('pending', 'approved', 'rejected', 'disbursed');

-- Create advance_requests table
CREATE TABLE public.advance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  status advance_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  disbursed_by UUID REFERENCES auth.users(id),
  disbursed_at TIMESTAMP WITH TIME ZONE,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own advance requests"
ON public.advance_requests FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own advance requests"
ON public.advance_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view all advance requests"
ON public.advance_requests FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) OR has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Managers can update advance requests"
ON public.advance_requests FOR UPDATE
USING (has_role(auth.uid(), 'manager'::user_role) OR has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Accounts can view approved advances"
ON public.advance_requests FOR SELECT
USING (has_role(auth.uid(), 'accounts'::user_role) AND status IN ('approved', 'disbursed'));

CREATE POLICY "Accounts can update approved advances"
ON public.advance_requests FOR UPDATE
USING (has_role(auth.uid(), 'accounts'::user_role) AND status IN ('approved', 'disbursed'));

-- Trigger for updated_at
CREATE TRIGGER update_advance_requests_updated_at
BEFORE UPDATE ON public.advance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();