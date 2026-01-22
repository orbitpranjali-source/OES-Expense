-- Allow owners to insert new user roles
CREATE POLICY "Owners can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::user_role));

-- Allow owners to delete user roles
CREATE POLICY "Owners can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::user_role));

-- Allow owners to update user roles
CREATE POLICY "Owners can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::user_role));

-- Allow owners to delete profiles (for removing users)
CREATE POLICY "Owners can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::user_role));