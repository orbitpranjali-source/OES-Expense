import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2, Search, Plus, FileText, Eye } from 'lucide-react';

const MyExpenses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
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
      </div>
    </DashboardLayout>
  );
};

export default MyExpenses;
