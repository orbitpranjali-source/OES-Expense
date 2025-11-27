import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const Approvals = () => {
  const { user } = useAuth();
  const { primaryRole } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['approvals', primaryRole, user?.id],
    queryFn: async () => {
      // Fetch pending expenses based on role
      let pendingQuery = supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (primaryRole === 'manager') {
        pendingQuery = pendingQuery.in('status', ['submitted', 'reviewed']);
      } else if (primaryRole === 'owner') {
        pendingQuery = pendingQuery.eq('status', 'manager_approved');
      }

      const { data: pendingData, error: pendingError } = await pendingQuery;
      if (pendingError) throw pendingError;

      // Fetch completed expenses (approved/rejected by this user)
      let completedQuery = supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (primaryRole === 'manager') {
        // Manager's completed: expenses they approved or rejected
        completedQuery = completedQuery.or(`manager_approved_by.eq.${user?.id},and(status.eq.manager_rejected,manager_rejection_reason.neq.null)`);
      } else if (primaryRole === 'owner') {
        // Owner's completed: expenses they approved or rejected
        completedQuery = completedQuery.or(`owner_approved_by.eq.${user?.id},and(status.eq.owner_rejected,owner_rejection_reason.neq.null)`);
      }

      const { data: completedData, error: completedError } = await completedQuery;
      if (completedError) throw completedError;

      // Combine and deduplicate
      const allExpenses = [...(pendingData || []), ...(completedData || [])];
      const uniqueExpenses = Array.from(new Map(allExpenses.map(e => [e.id, e])).values());

      const userIds = uniqueExpenses?.map(e => e.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

      return uniqueExpenses?.map(expense => ({
        ...expense,
        profile: profilesMap.get(expense.user_id),
      })) || [];
    },
    enabled: primaryRole === 'manager' || primaryRole === 'owner',
  });

  const approveMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const newStatus = primaryRole === 'manager' ? 'manager_approved' : 'owner_approved';
      const approvalField = primaryRole === 'manager' ? 'manager_approved_by' : 'owner_approved_by';
      const approvalDateField = primaryRole === 'manager' ? 'manager_approved_at' : 'owner_approved_at';

      const { error } = await supabase
        .from('expenses')
        .update({
          status: newStatus,
          [approvalField]: user?.id,
          [approvalDateField]: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast({ title: 'Expense approved successfully' });
      setSelectedExpense(null);
    },
    onError: (error) => {
      toast({ title: 'Error approving expense', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ expenseId, reason }: { expenseId: string; reason: string }) => {
      const newStatus = primaryRole === 'manager' ? 'manager_rejected' : 'owner_rejected';
      const rejectionField = primaryRole === 'manager' ? 'manager_rejection_reason' : 'owner_rejection_reason';

      const { error } = await supabase
        .from('expenses')
        .update({
          status: newStatus,
          [rejectionField]: reason,
        })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast({ title: 'Expense rejected' });
      setSelectedExpense(null);
      setRejectionReason('');
    },
    onError: (error) => {
      toast({ title: 'Error rejecting expense', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-500',
      reviewed: 'bg-purple-500',
      manager_approved: 'bg-green-500',
      manager_rejected: 'bg-red-500',
      owner_approved: 'bg-emerald-500',
      owner_rejected: 'bg-red-600',
    };
    return colors[status] || 'bg-gray-500';
  };

  const isPending = (expense: any) => {
    if (primaryRole === 'manager') {
      return ['submitted', 'reviewed'].includes(expense.status);
    } else if (primaryRole === 'owner') {
      return expense.status === 'manager_approved';
    }
    return false;
  };

  const isCompleted = (expense: any) => {
    if (primaryRole === 'manager') {
      // Completed if manager approved this expense OR it's manager_rejected
      return expense.manager_approved_by === user?.id || expense.status === 'manager_rejected';
    } else if (primaryRole === 'owner') {
      // Completed if owner approved this expense OR it's owner_rejected
      return expense.owner_approved_by === user?.id || expense.status === 'owner_rejected';
    }
    return false;
  };

  const pendingExpenses = expenses?.filter(e => isPending(e)) || [];
  const completedExpenses = expenses?.filter(e => isCompleted(e)) || [];

  if (primaryRole !== 'manager' && primaryRole !== 'owner') {
    return (
      <DashboardLayout>
        <div className="text-center">
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  const renderExpenseCard = (expense: any, showActions: boolean) => (
    <Card key={expense.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{expense.title}</CardTitle>
            <CardDescription>
              Submitted by {expense.profile?.full_name || 'Unknown'} • {formatDateTime(expense.created_at)}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(expense.status)}>
            {expense.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-semibold text-lg">{formatCurrency(expense.amount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Category</p>
            <p className="font-medium">{expense.category}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expense Date</p>
            <p className="font-medium">{formatDateTime(expense.expense_date)}</p>
          </div>
        </div>

        {expense.description && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{expense.description}</p>
          </div>
        )}

        {(expense.manager_rejection_reason || expense.owner_rejection_reason) && (
          <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Rejection Reason</p>
            <p className="text-sm text-red-700 dark:text-red-300">
              {expense.manager_rejection_reason || expense.owner_rejection_reason}
            </p>
          </div>
        )}

        {showActions && (
          selectedExpense === expense.id ? (
            <div className="space-y-3 pt-2 border-t">
              <Textarea
                placeholder="Enter rejection reason (optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => approveMutation.mutate(expense.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate({ expenseId: expense.id, reason: rejectionReason })}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedExpense(null);
                    setRejectionReason('');
                  }}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="default"
                size="sm"
                onClick={() => setSelectedExpense(expense.id)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Review
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Expense Approvals</h2>
          <p className="text-muted-foreground">Review pending and completed expense approvals</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList>
              <TabsTrigger value="pending">
                Pending ({pendingExpenses.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedExpenses.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingExpenses.length > 0 ? (
                <div className="grid gap-4">
                  {pendingExpenses.map((expense) => renderExpenseCard(expense, true))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No pending approvals at the moment</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedExpenses.length > 0 ? (
                <div className="grid gap-4">
                  {completedExpenses.map((expense) => renderExpenseCard(expense, false))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No completed approvals yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
