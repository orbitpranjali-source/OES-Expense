import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Receipt, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ExpenseStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  paid: number;
  totalAmount: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { primaryRole, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ExpenseStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    paid: 0,
    totalAmount: 0,
  });
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityStats, setActivityStats] = useState<{ approvedCount?: number; paidCount?: number }>({});

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch expenses based on role
        let query = supabase.from('expenses').select('*');

        if (primaryRole === 'employee') {
          query = query.eq('user_id', user.id);
        } else if (primaryRole === 'manager') {
          query = query.or(`user_id.eq.${user.id},status.in.(submitted,reviewed)`);
        }
        // Owner and Accounts can see all

        const { data: expenses, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate stats based on role
        const pendingStatuses = primaryRole === 'manager'
          ? ['submitted', 'reviewed']
          : ['submitted', 'reviewed', 'manager_approved'];
        
        const approvedStatuses = primaryRole === 'manager' 
          ? ['manager_approved', 'owner_approved', 'pending_payment', 'paid']
          : ['owner_approved', 'pending_payment', 'paid'];

        const stats: ExpenseStats = {
          total: expenses?.length || 0,
          pending: expenses?.filter(e => 
            pendingStatuses.includes(e.status)
          ).length || 0,
          approved: expenses?.filter(e => 
            approvedStatuses.includes(e.status)
          ).length || 0,
          rejected: expenses?.filter(e => 
            ['manager_rejected', 'owner_rejected'].includes(e.status)
          ).length || 0,
          paid: expenses?.filter(e => e.status === 'paid').length || 0,
          totalAmount: expenses?.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
        };

        setStats(stats);
        setRecentExpenses(expenses?.slice(0, 5) || []);

        // Fetch role-specific activity stats
        if (primaryRole === 'manager') {
          const { data: managerApprovals } = await supabase
            .from('expenses')
            .select('id')
            .eq('manager_approved_by', user.id);
          setActivityStats({ approvedCount: managerApprovals?.length || 0 });
        } else if (primaryRole === 'owner') {
          const { data: ownerApprovals } = await supabase
            .from('expenses')
            .select('id')
            .eq('owner_approved_by', user.id);
          setActivityStats({ approvedCount: ownerApprovals?.length || 0 });
        } else if (primaryRole === 'accounts') {
          const { data: payments } = await supabase
            .from('expenses')
            .select('id')
            .eq('paid_by', user.id);
          setActivityStats({ paidCount: payments?.length || 0 });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading) {
      fetchDashboardData();
    }
  }, [user, primaryRole, roleLoading]);

  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', text: string }> = {
      draft: { variant: 'outline', text: 'Draft' },
      submitted: { variant: 'secondary', text: 'Submitted' },
      reviewed: { variant: 'secondary', text: 'Reviewed' },
      manager_approved: { variant: 'default', text: 'Manager Approved' },
      manager_rejected: { variant: 'destructive', text: 'Rejected' },
      owner_approved: { variant: 'default', text: 'Owner Approved' },
      owner_rejected: { variant: 'destructive', text: 'Rejected' },
      pending_payment: { variant: 'secondary', text: 'Pending Payment' },
      paid: { variant: 'default', text: 'Paid' },
    };

    const config = variants[status] || { variant: 'outline' as const, text: status };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">
                Including paid
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">
                Total rejections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paid}</div>
              <p className="text-xs text-muted-foreground">
                Completed payments
              </p>
            </CardContent>
          </Card>

          {/* Role-specific activity stats */}
          {primaryRole === 'manager' && activityStats.approvedCount !== undefined && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Approvals</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{activityStats.approvedCount}</div>
                <p className="text-xs text-muted-foreground">
                  Expenses approved by you
                </p>
              </CardContent>
            </Card>
          )}

          {primaryRole === 'owner' && activityStats.approvedCount !== undefined && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Approvals</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{activityStats.approvedCount}</div>
                <p className="text-xs text-muted-foreground">
                  Expenses approved by you
                </p>
              </CardContent>
            </Card>
          )}

          {primaryRole === 'accounts' && activityStats.paidCount !== undefined && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Payments</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{activityStats.paidCount}</div>
                <p className="text-xs text-muted-foreground">
                  Expenses paid by you
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Expenses</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (primaryRole === 'manager' || primaryRole === 'owner') {
                    navigate('/approvals');
                  } else if (primaryRole === 'accounts') {
                    navigate('/payments');
                  } else {
                    navigate('/expenses');
                  }
                }}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No expenses yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Start by creating your first expense
                </p>
                <Button onClick={() => navigate('/expense/new')}>
                  Add Expense
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                    onClick={() => navigate(`/expense/${expense.id}`)}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{expense.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          {new Date(expense.expense_date).toLocaleDateString()}
                        </p>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-sm font-medium">{formatCurrency(expense.amount)}</p>
                      </div>
                    </div>
                    {getStatusBadge(expense.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Button
                className="h-auto flex-col items-start gap-2 p-4"
                variant="outline"
                onClick={() => navigate('/expense/new')}
              >
                <Receipt className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">New Expense</div>
                  <div className="text-xs text-muted-foreground">
                    Submit a new expense for approval
                  </div>
                </div>
              </Button>

              {(primaryRole === 'manager' || primaryRole === 'owner') && (
                <Button
                  className="h-auto flex-col items-start gap-2 p-4"
                  variant="outline"
                  onClick={() => navigate('/approvals')}
                >
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div className="text-left">
                    <div className="font-semibold">Review Expenses</div>
                    <div className="text-xs text-muted-foreground">
                      Approve or reject pending expenses
                    </div>
                  </div>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
