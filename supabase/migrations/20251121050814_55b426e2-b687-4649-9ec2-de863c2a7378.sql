-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('employee', 'manager', 'owner', 'accounts');

-- Create enum for expense status
CREATE TYPE public.expense_status AS ENUM (
  'draft',
  'submitted',
  'reviewed',
  'manager_approved',
  'manager_rejected',
  'owner_approved', 
  'owner_rejected',
  'pending_payment',
  'paid'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  expense_date DATE NOT NULL,
  status expense_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  manager_approved_by UUID REFERENCES auth.users(id),
  manager_approved_at TIMESTAMPTZ,
  manager_rejection_reason TEXT,
  owner_approved_by UUID REFERENCES auth.users(id),
  owner_approved_at TIMESTAMPTZ,
  owner_rejection_reason TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create expense_files table for bills and payment proofs
CREATE TABLE public.expense_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_category TEXT NOT NULL CHECK (file_category IN ('bill', 'payment_proof')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create expense_status_logs table for timeline tracking
CREATE TABLE public.expense_status_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  status expense_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- User roles RLS policies
CREATE POLICY "Users can view all user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Expenses RLS policies
CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view submitted expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::user_role) 
    AND status IN ('submitted', 'reviewed', 'manager_approved', 'manager_rejected')
  );

CREATE POLICY "Owners can view all expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Accounts can view approved expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounts'::user_role)
    AND status IN ('owner_approved', 'pending_payment', 'paid')
  );

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Managers can update submitted expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Owners can update manager approved expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::user_role));

CREATE POLICY "Accounts can update owner approved expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'accounts'::user_role));

-- Expense files RLS policies
CREATE POLICY "Users can view files for expenses they can see"
  ON public.expense_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE id = expense_id
      AND (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'manager'::user_role)
        OR public.has_role(auth.uid(), 'owner'::user_role)
        OR public.has_role(auth.uid(), 'accounts'::user_role)
      )
    )
  );

CREATE POLICY "Users can upload files for own expenses"
  ON public.expense_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE id = expense_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Accounts can upload payment proofs"
  ON public.expense_files FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'accounts'::user_role)
    AND file_category = 'payment_proof'
  );

-- Status logs RLS policies
CREATE POLICY "Users can view status logs for visible expenses"
  ON public.expense_status_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE id = expense_id
      AND (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'manager'::user_role)
        OR public.has_role(auth.uid(), 'owner'::user_role)
        OR public.has_role(auth.uid(), 'accounts'::user_role)
      )
    )
  );

CREATE POLICY "System can insert status logs"
  ON public.expense_status_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Notifications RLS policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  -- Insert user role from metadata
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role)
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for expense files
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-files', 'expense-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expense files
CREATE POLICY "Users can upload expense files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'expense-files');

CREATE POLICY "Users can view expense files they have access to"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'expense-files');

CREATE POLICY "Users can delete own expense files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'expense-files' AND auth.uid()::text = (storage.foldername(name))[1]);