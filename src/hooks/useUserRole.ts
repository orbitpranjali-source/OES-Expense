import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';

export type { UserRole };

export const useUserRole = () => {
  const { roles, primaryRole, loading } = useAuth();

  const hasRole = (role: UserRole) => roles.includes(role);

  return {
    roles,
    hasRole,
    primaryRole: primaryRole || 'employee', // Default to employee only if we really need a string, but loading should be checked first
    loading
  };
};
