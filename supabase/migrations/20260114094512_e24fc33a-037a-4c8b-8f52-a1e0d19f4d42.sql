-- =====================================================
-- SECURITY FIX: Multiple Critical Vulnerabilities
-- =====================================================

-- 1. Fix profiles table - restrict to own profile + managers/owners
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Managers and owners can view all profiles" 
  ON public.profiles FOR SELECT 
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::user_role) OR has_role(auth.uid(), 'owner'::user_role) OR has_role(auth.uid(), 'accounts'::user_role));

-- 2. Fix notifications table - restrict inserts to own notifications only
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can create own notifications" 
  ON public.notifications FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix handle_new_user function to always assign employee role (ignore user-supplied role)
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
  
  -- SECURITY FIX: Always assign employee role on signup - ignore user-supplied role
  -- Role upgrades must be done by an owner through a separate admin interface
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee'::user_role);
  
  RETURN NEW;
END;
$$;

-- 4. Fix storage policies for expense-files bucket
DROP POLICY IF EXISTS "Users can view expense files they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload expense files" ON storage.objects;

-- Restrict SELECT to files user owns or has role-based access to
CREATE POLICY "Users can view authorized expense files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-files' AND (
      -- File is in user's own folder
      auth.uid()::text = (storage.foldername(name))[1]
      -- OR user has manager/owner/accounts role
      OR has_role(auth.uid(), 'manager'::user_role)
      OR has_role(auth.uid(), 'owner'::user_role)
      OR has_role(auth.uid(), 'accounts'::user_role)
    )
  );

-- Restrict INSERT to user's own folder only
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );