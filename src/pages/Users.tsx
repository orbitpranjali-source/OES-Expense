import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { Loader2, Users as UsersIcon } from 'lucide-react';

const Users = () => {
  const { primaryRole } = useUserRole();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map<string, any[]>();
      rolesData?.forEach(role => {
        const existing = rolesMap.get(role.user_id) || [];
        rolesMap.set(role.user_id, [...existing, { role: role.role }]);
      });

      return profilesData?.map(profile => ({
        ...profile,
        user_roles: rolesMap.get(profile.id) || [],
      })) || [];
    },
    enabled: primaryRole === 'owner',
  });

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-500',
      manager: 'bg-blue-500',
      accounts: 'bg-green-500',
      employee: 'bg-gray-500',
    };
    return colors[role] || 'bg-gray-500';
  };

  if (primaryRole !== 'owner') {
    return (
      <DashboardLayout>
        <div className="text-center">
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">View and manage system users</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users && users.length > 0 ? (
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <UsersIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle>{user.full_name}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {user.user_roles?.map((roleObj: any, idx: number) => (
                        <Badge key={idx} className={getRoleBadgeColor(roleObj.role)}>
                          {roleObj.role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {user.department && (
                      <div>
                        <p className="text-muted-foreground">Department</p>
                        <p className="font-medium">{user.department}</p>
                      </div>
                    )}
                    {user.phone && (
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{user.phone}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Joined</p>
                      <p className="font-medium">{formatDateTime(user.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Users;
