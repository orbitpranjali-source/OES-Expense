-- Create site_budgets table
CREATE TABLE public.site_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_name TEXT NOT NULL UNIQUE,
  total_budget DECIMAL(14, 2) NOT NULL CHECK (total_budget > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add site_name column to expenses table
ALTER TABLE public.expenses ADD COLUMN site_name TEXT;

-- Enable RLS on site_budgets
ALTER TABLE public.site_budgets ENABLE ROW LEVEL SECURITY;

-- RLS policies for site_budgets
CREATE POLICY "All authenticated users can view site budgets"
  ON public.site_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can insert site budgets"
  ON public.site_budgets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Owners can update site budgets"
  ON public.site_budgets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Owners can delete site budgets"
  ON public.site_budgets FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Managers can insert site budgets"
  ON public.site_budgets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Managers can update site budgets"
  ON public.site_budgets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::user_role));

-- Create trigger for updated_at on site_budgets
CREATE TRIGGER update_site_budgets_updated_at
  BEFORE UPDATE ON public.site_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
