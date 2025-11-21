import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
    queryKey: ['approvals', primaryRole],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (primaryRole === 'manager') {
        query = query.in('status', ['submitted', 'reviewed']);
      } else if (primaryRole === 'owner') {
        query = query.in('status', ['manager_approved']);
      }

      const { data: expensesData, error: expensesError } = await query;

      if (expensesError) throw expensesError;

      const userIds = expensesData?.map(e => e.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

      return expensesData?.map(expense => ({
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
    };
    return colors[status] || 'bg-gray-500';
  };

  if (primaryRole !== 'manager' && primaryRole !== 'owner') {
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
          <h2 className="text-2xl font-bold">Pending Approvals</h2>
          <p className="text-muted-foreground">Review and approve expense requests</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : expenses && expenses.length > 0 ? (
          <div className="grid gap-4">
            {expenses.map((expense) => (
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
                      {expense.status.replace('_', ' ')}
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

                  {selectedExpense === expense.id ? (
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
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No pending approvals at the moment</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
