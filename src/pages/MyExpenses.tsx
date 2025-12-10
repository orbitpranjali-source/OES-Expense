import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2, Search, Plus, FileText, Eye, TrendingUp, TrendingDown, Clock, Wallet, Banknote, CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-react';
import { AdvanceRequestDialog } from '@/components/AdvanceRequestDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
const MyExpenses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      // First delete associated files
      const { error: filesError } = await supabase
        .from('expense_files')
        .delete()
        .eq('expense_id', expenseId);
      
      if (filesError) throw filesError;

      // Then delete the expense
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-expenses'] });
      toast.success('Expense deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete expense: ' + error.message);
    },
  });

  const canEditOrDelete = (status: string) => {
    return status === 'draft';
  };
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['my-expenses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch advance requests
  const { data: advances, isLoading: advancesLoading } = useQuery({
    queryKey: ['advance-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advance_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate advance summary
  const advanceSummary = useMemo(() => {
    if (!advances) return { pending: 0, approved: 0, disbursed: 0, rejected: 0 };
    
    return advances.reduce((acc, advance) => {
      const amount = Number(advance.amount);
      if (advance.status === 'pending') acc.pending += amount;
      else if (advance.status === 'approved') acc.approved += amount;
      else if (advance.status === 'disbursed') acc.disbursed += amount;
      else if (advance.status === 'rejected') acc.rejected += amount;
      return acc;
    }, { pending: 0, approved: 0, disbursed: 0, rejected: 0 });
  }, [advances]);

  const getAdvanceStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', text: string, className?: string }> = {
      pending: { variant: 'secondary', text: 'Pending Approval' },
      approved: { variant: 'default', text: 'Approved', className: 'bg-green-500' },
      rejected: { variant: 'destructive', text: 'Rejected' },
      disbursed: { variant: 'default', text: 'Disbursed', className: 'bg-emerald-600' },
    };
    const config = variants[status] || { variant: 'outline' as const, text: status };
    return <Badge variant={config.variant} className={config.className}>{config.text}</Badge>;
  };

  // Calculate credit/debit summary
  const financialSummary = useMemo(() => {
    if (!expenses) return { pending: 0, paid: 0, rejected: 0, inProgress: 0 };

    return expenses.reduce((acc, expense) => {
      const amount = Number(expense.amount);
      
      // Pending reimbursement: approved but not yet paid
      if (['owner_approved', 'pending_payment'].includes(expense.status)) {
        acc.pending += amount;
      }
      // Paid: money received
      else if (expense.status === 'paid') {
        acc.paid += amount;
      }
      // Rejected: not getting reimbursed
      else if (['manager_rejected', 'owner_rejected'].includes(expense.status)) {
        acc.rejected += amount;
      }
      // In progress: still being reviewed
      else if (['submitted', 'reviewed', 'manager_approved'].includes(expense.status)) {
        acc.inProgress += amount;
      }
      
      return acc;
    }, { pending: 0, paid: 0, rejected: 0, inProgress: 0 });
  }, [expenses]);

  // Get recent transactions (paid expenses)
  const recentTransactions = useMemo(() => {
    if (!expenses) return [];
    return expenses
      .filter(e => e.status === 'paid')
      .slice(0, 5);
  }, [expenses]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', text: string, className?: string }> = {
      draft: { variant: 'outline', text: 'Draft' },
      submitted: { variant: 'secondary', text: 'Submitted' },
      reviewed: { variant: 'secondary', text: 'Reviewed' },
      manager_approved: { variant: 'default', text: 'Manager Approved', className: 'bg-blue-500' },
      manager_rejected: { variant: 'destructive', text: 'Rejected by Manager' },
      owner_approved: { variant: 'default', text: 'Owner Approved', className: 'bg-green-500' },
      owner_rejected: { variant: 'destructive', text: 'Rejected by Owner' },
      pending_payment: { variant: 'secondary', text: 'Pending Payment', className: 'bg-amber-500' },
      paid: { variant: 'default', text: 'Paid', className: 'bg-emerald-600' },
    };

    const config = variants[status] || { variant: 'outline' as const, text: status };
    return <Badge variant={config.variant} className={config.className}>{config.text}</Badge>;
  };

  const filteredExpenses = expenses?.filter(expense => {
    const matchesSearch = expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">My Expenses</h2>
            <p className="text-muted-foreground">View and manage all your expenses</p>
          </div>
          <Button onClick={() => navigate('/expense/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Expense
          </Button>
        </div>

        {/* Credit/Debit Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reimbursement</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(financialSummary.pending)}</div>
              <p className="text-xs text-muted-foreground">Approved, awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(financialSummary.paid)}</div>
              <p className="text-xs text-muted-foreground">Reimbursements received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Review</CardTitle>
              <Wallet className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(financialSummary.inProgress)}</div>
              <p className="text-xs text-muted-foreground">Under approval process</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(financialSummary.rejected)}</div>
              <p className="text-xs text-muted-foreground">Not reimbursable</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expenses">All Expenses</TabsTrigger>
            <TabsTrigger value="advances">Advances</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, category, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="manager_approved">Manager Approved</SelectItem>
                  <SelectItem value="manager_rejected">Manager Rejected</SelectItem>
                  <SelectItem value="owner_approved">Owner Approved</SelectItem>
                  <SelectItem value="owner_rejected">Owner Rejected</SelectItem>
                  <SelectItem value="pending_payment">Pending Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredExpenses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No expenses found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {expenses?.length === 0 
                      ? "You haven't created any expenses yet" 
                      : "No expenses match your search criteria"}
                  </p>
                  {expenses?.length === 0 && (
                    <Button onClick={() => navigate('/expense/new')}>
                      Create Your First Expense
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredExpenses.map((expense) => (
                  <Card 
                    key={expense.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/expense/${expense.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{expense.title}</CardTitle>
                          <CardDescription>
                            {expense.category} • {formatDate(expense.expense_date)}
                          </CardDescription>
                        </div>
                        {getStatusBadge(expense.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-2xl font-bold">{formatCurrency(expense.amount)}</p>
                          {expense.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {expense.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditOrDelete(expense.status) && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/expense/${expense.id}`);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{expense.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteExpenseMutation.mutate(expense.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                      
                      {(expense.manager_rejection_reason || expense.owner_rejection_reason) && (
                        <div className="mt-3 p-2 bg-destructive/10 rounded-md">
                          <p className="text-sm text-destructive">
                            <strong>Rejection Reason:</strong> {expense.manager_rejection_reason || expense.owner_rejection_reason}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="advances" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="font-semibold text-amber-600">{formatCurrency(advanceSummary.pending)}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Approved</p>
                      <p className="font-semibold text-green-600">{formatCurrency(advanceSummary.approved)}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Disbursed</p>
                      <p className="font-semibold text-emerald-600">{formatCurrency(advanceSummary.disbursed)}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                      <p className="font-semibold text-destructive">{formatCurrency(advanceSummary.rejected)}</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="ml-4">
                <AdvanceRequestDialog />
              </div>
            </div>

            {advancesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !advances || advances.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No advance requests</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    You haven't requested any advances yet
                  </p>
                  <AdvanceRequestDialog />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {advances.map((advance) => (
                  <Card key={advance.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{formatCurrency(advance.amount)}</CardTitle>
                          <CardDescription>
                            Requested on {formatDate(advance.requested_at)}
                          </CardDescription>
                        </div>
                        {getAdvanceStatusBadge(advance.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{advance.reason}</p>
                      
                      {advance.status === 'rejected' && advance.rejection_reason && (
                        <div className="mt-3 p-2 bg-destructive/10 rounded-md">
                          <p className="text-sm text-destructive">
                            <strong>Rejection Reason:</strong> {advance.rejection_reason}
                          </p>
                        </div>
                      )}
                      
                      {advance.status === 'disbursed' && (
                        <div className="mt-3 p-2 bg-green-500/10 rounded-md">
                          <p className="text-sm text-green-700">
                            <strong>Disbursed on:</strong> {advance.disbursed_at ? formatDate(advance.disbursed_at) : 'N/A'}
                            {advance.payment_reference && (
                              <span className="ml-2">• Ref: {advance.payment_reference}</span>
                            )}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Your reimbursement transaction history</CardDescription>
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No payment history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/expense/${transaction.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">{transaction.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.category} • Paid on {transaction.paid_at ? formatDate(transaction.paid_at) : 'N/A'}
                            </p>
                            {transaction.payment_reference && (
                              <p className="text-xs text-muted-foreground">
                                Ref: {transaction.payment_reference}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">+{formatCurrency(transaction.amount)}</p>
                          <Badge variant="default" className="bg-emerald-600">Paid</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MyExpenses;
