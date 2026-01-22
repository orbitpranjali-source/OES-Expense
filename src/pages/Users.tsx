import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { Loader2, Users as UsersIcon, UserPlus, Trash2, Shield } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const Users = () => {
  const { primaryRole } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>('');

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

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: role as any });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Role added successfully' });
      setIsRoleDialogOpen(false);
      setSelectedUserId(null);
      setNewRole('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error adding role', 
        description: error.message?.includes('duplicate') ? 'User already has this role' : error.message, 
        variant: 'destructive' 
      });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as 'employee' | 'manager' | 'accounts' | 'owner');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Role removed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error removing role', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // First delete all roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      // Then delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User removed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error removing user', description: error.message, variant: 'destructive' });
    },
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

  const availableRoles = ['employee', 'manager', 'accounts', 'owner'];

  const getAvailableRolesForUser = (userRoles: any[]) => {
    const existingRoles = userRoles.map(r => r.role);
    return availableRoles.filter(role => !existingRoles.includes(role));
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">User Management</h2>
            <p className="text-muted-foreground">View and manage system users and their roles</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Note: New users must sign up through the login page.</p>
            <p>You can manage their roles after they register.</p>
          </div>
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
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {user.user_roles?.map((roleObj: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1">
                            <Badge className={getRoleBadgeColor(roleObj.role)}>
                              {roleObj.role}
                            </Badge>
                            {user.user_roles.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 hover:bg-destructive/20"
                                onClick={() => removeRoleMutation.mutate({ userId: user.id, role: roleObj.role })}
                                disabled={removeRoleMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-2 gap-4 text-sm flex-1">
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
                    <div className="flex gap-2">
                      {getAvailableRolesForUser(user.user_roles).length > 0 && (
                        <Dialog open={isRoleDialogOpen && selectedUserId === user.id} onOpenChange={(open) => {
                          setIsRoleDialogOpen(open);
                          if (!open) {
                            setSelectedUserId(null);
                            setNewRole('');
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUserId(user.id)}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Add Role
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Role to {user.full_name}</DialogTitle>
                              <DialogDescription>
                                Select a role to assign to this user.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select value={newRole} onValueChange={setNewRole}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableRolesForUser(user.user_roles).map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={() => addRoleMutation.mutate({ userId: user.id, role: newRole })}
                                disabled={!newRole || addRoleMutation.isPending}
                              >
                                {addRoleMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Add Role
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove User
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {user.full_name}? This will delete their profile and all associated roles. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteUserMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
