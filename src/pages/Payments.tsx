import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Payments = () => {
  const { user } = useAuth();
  const { primaryRole } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');

  const { data: pendingExpenses, isLoading: loadingPending } = useQuery({
    queryKey: ['payments-pending'],
    queryFn: async () => {
      const { data: expensesData, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'owner_approved')
        .order('owner_approved_at', { ascending: false });

      if (error) throw error;

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
    enabled: primaryRole === 'accounts',
  });

  const { data: paidExpenses, isLoading: loadingPaid } = useQuery({
    queryKey: ['payments-paid'],
    queryFn: async () => {
      const { data: expensesData, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(50);

      if (error) throw error;

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
    enabled: primaryRole === 'accounts',
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ expenseId, reference }: { expenseId: string; reference: string }) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'paid',
          paid_by: user?.id,
          paid_at: new Date().toISOString(),
          payment_reference: reference,
        })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-pending'] });
      queryClient.invalidateQueries({ queryKey: ['payments-paid'] });
      toast({ title: 'Payment processed successfully' });
      setSelectedExpense(null);
      setPaymentReference('');
    },
    onError: (error) => {
      toast({ title: 'Error processing payment', description: error.message, variant: 'destructive' });
    },
  });

  if (primaryRole !== 'accounts') {
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
          <h2 className="text-2xl font-bold">Payment Management</h2>
          <p className="text-muted-foreground">Process approved expense payments</p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending Payments</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {loadingPending ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingExpenses && pendingExpenses.length > 0 ? (
              <div className="grid gap-4">
                {pendingExpenses.map((expense) => (
                  <Card key={expense.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{expense.title}</CardTitle>
                          <CardDescription>
                            Employee: {expense.profile?.full_name || 'Unknown'} • Approved: {formatDateTime(expense.owner_approved_at || '')}
                          </CardDescription>
                        </div>
                        <Badge className="bg-green-500">Approved</Badge>
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
                      </div>

                      {selectedExpense === expense.id ? (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="space-y-2">
                            <Label htmlFor="payment-ref">Payment Reference</Label>
                            <Input
                              id="payment-ref"
                              placeholder="Enter transaction/reference number"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => markAsPaidMutation.mutate({ expenseId: expense.id, reference: paymentReference })}
                              disabled={markAsPaidMutation.isPending || !paymentReference.trim()}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedExpense(null);
                                setPaymentReference('');
                              }}
                              disabled={markAsPaidMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t">
                          <Button
                            size="sm"
                            onClick={() => setSelectedExpense(expense.id)}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Process Payment
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
                  <p className="text-muted-foreground">No pending payments at the moment</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {loadingPaid ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : paidExpenses && paidExpenses.length > 0 ? (
              <div className="grid gap-4">
                {paidExpenses.map((expense) => (
                  <Card key={expense.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                        <CardTitle>{expense.title}</CardTitle>
                        <CardDescription>
                          Employee: {expense.profile?.full_name || 'Unknown'} • Paid: {formatDateTime(expense.paid_at || '')}
                        </CardDescription>
                        </div>
                        <Badge className="bg-blue-500">Paid</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-semibold text-lg">{formatCurrency(expense.amount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Reference</p>
                          <p className="font-medium">{expense.payment_reference || 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No completed payments yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
