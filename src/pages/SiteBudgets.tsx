import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import {
    Loader2,
    Plus,
    Building2,
    IndianRupee,
    TrendingUp,
    AlertTriangle,
    Pencil,
    Trash2,
    X,
    Check,
    PieChart,
    ShieldAlert,
    ArrowUpRight,
    BarChart3
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface SiteBudget {
    id: string;
    site_name: string;
    total_budget: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

interface ExpenseForSite {
    id: string;
    amount: number;
    site_name: string | null;
    status: string;
}

const SiteBudgets = () => {
    const { user } = useAuth();
    const { primaryRole } = useUserRole();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [siteName, setSiteName] = useState('');
    const [totalBudget, setTotalBudget] = useState('');
    const [editSiteName, setEditSiteName] = useState('');
    const [editTotalBudget, setEditTotalBudget] = useState('');

    const canManage = primaryRole === 'owner' || primaryRole === 'manager';

    // Fetch site budgets
    const { data: siteBudgets, isLoading: budgetsLoading } = useQuery({
        queryKey: ['site-budgets'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('site_budgets')
                .select('*')
                .order('site_name', { ascending: true });

            if (error) throw error;
            return (data || []) as SiteBudget[];
        },
    });

    // Fetch all expenses with site_name (non-draft, non-rejected)
    const { data: expenses, isLoading: expensesLoading } = useQuery({
        queryKey: ['site-expenses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('expenses')
                .select('id, amount, site_name, status')
                .not('site_name', 'is', null)
                .not('status', 'in', '("draft","manager_rejected","owner_rejected")');

            if (error) throw error;
            return (data || []) as ExpenseForSite[];
        },
    });

    // Calculate expense totals per site
    const siteExpenseTotals = useMemo(() => {
        if (!expenses) return new Map<string, number>();

        const totals = new Map<string, number>();
        expenses.forEach(expense => {
            if (expense.site_name) {
                const current = totals.get(expense.site_name) || 0;
                totals.set(expense.site_name, current + Number(expense.amount));
            }
        });
        return totals;
    }, [expenses]);

    // Summary stats
    const summary = useMemo(() => {
        if (!siteBudgets) return { totalBudget: 0, totalUsed: 0, totalRemaining: 0, sitesOverBudget: 0, sitesWarning: 0 };

        let totalBudget = 0;
        let totalUsed = 0;
        let sitesOverBudget = 0;
        let sitesWarning = 0;

        siteBudgets.forEach(site => {
            const budget = Number(site.total_budget);
            const used = siteExpenseTotals.get(site.site_name) || 0;
            const percentage = budget > 0 ? (used / budget) * 100 : 0;

            totalBudget += budget;
            totalUsed += used;

            if (percentage >= 100) sitesOverBudget++;
            else if (percentage >= 80) sitesWarning++;
        });

        return {
            totalBudget,
            totalUsed,
            totalRemaining: totalBudget - totalUsed,
            sitesOverBudget,
            sitesWarning,
        };
    }, [siteBudgets, siteExpenseTotals]);

    // Add site budget mutation
    const addBudgetMutation = useMutation({
        mutationFn: async ({ name, budget }: { name: string; budget: number }) => {
            const { error } = await supabase
                .from('site_budgets')
                .insert({
                    site_name: name,
                    total_budget: budget,
                    created_by: user?.id!,
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-budgets'] });
            toast({ title: 'Site budget created successfully' });
            setShowAddForm(false);
            setSiteName('');
            setTotalBudget('');
        },
        onError: (error: Error) => {
            toast({ title: 'Error creating site budget', description: error.message, variant: 'destructive' });
        },
    });

    // Update site budget mutation
    const updateBudgetMutation = useMutation({
        mutationFn: async ({ id, name, budget }: { id: string; name: string; budget: number }) => {
            const { error } = await supabase
                .from('site_budgets')
                .update({
                    site_name: name,
                    total_budget: budget,
                })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-budgets'] });
            toast({ title: 'Site budget updated successfully' });
            setEditingId(null);
        },
        onError: (error: Error) => {
            toast({ title: 'Error updating site budget', description: error.message, variant: 'destructive' });
        },
    });

    // Delete site budget mutation
    const deleteBudgetMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('site_budgets')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-budgets'] });
            toast({ title: 'Site budget deleted successfully' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error deleting site budget', description: error.message, variant: 'destructive' });
        },
    });

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteName.trim() || !totalBudget) return;

        const budgetNum = parseFloat(totalBudget);
        if (isNaN(budgetNum) || budgetNum <= 0) {
            toast({ title: 'Invalid budget amount', variant: 'destructive' });
            return;
        }

        addBudgetMutation.mutate({ name: siteName.trim(), budget: budgetNum });
    };

    const handleEditSubmit = (id: string) => {
        if (!editSiteName.trim() || !editTotalBudget) return;

        const budgetNum = parseFloat(editTotalBudget);
        if (isNaN(budgetNum) || budgetNum <= 0) {
            toast({ title: 'Invalid budget amount', variant: 'destructive' });
            return;
        }

        updateBudgetMutation.mutate({ id, name: editSiteName.trim(), budget: budgetNum });
    };

    const startEditing = (site: SiteBudget) => {
        setEditingId(site.id);
        setEditSiteName(site.site_name);
        setEditTotalBudget(site.total_budget.toString());
    };

    const getUsageColor = (percentage: number) => {
        if (percentage >= 100) return 'text-red-600 dark:text-red-400';
        if (percentage >= 80) return 'text-amber-600 dark:text-amber-400';
        if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-emerald-600 dark:text-emerald-400';
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 100) return 'bg-red-500';
        if (percentage >= 80) return 'bg-amber-500';
        if (percentage >= 60) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    const getProgressBgColor = (percentage: number) => {
        if (percentage >= 100) return 'bg-red-100 dark:bg-red-950/30';
        if (percentage >= 80) return 'bg-amber-100 dark:bg-amber-950/30';
        if (percentage >= 60) return 'bg-yellow-100 dark:bg-yellow-950/30';
        return 'bg-emerald-100 dark:bg-emerald-950/30';
    };

    const isLoading = budgetsLoading || expensesLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="h-7 w-7 text-primary" />
                        Site Budget Management
                    </h2>
                    <p className="text-muted-foreground">Track and manage budgets for all project sites</p>
                </div>
                {canManage && (
                    <Button onClick={() => setShowAddForm(!showAddForm)} id="btn-add-site-budget">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Site Budget
                    </Button>
                )}
            </div>

            {/* Over-budget alerts */}
            {summary.sitesOverBudget > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-red-800 dark:text-red-200">
                            Budget Exceeded!
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            {summary.sitesOverBudget} site{summary.sitesOverBudget > 1 ? 's have' : ' has'} exceeded the allocated budget.
                            Please review the expenses immediately.
                        </p>
                    </div>
                </div>
            )}

            {summary.sitesWarning > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-200">
                            Budget Warning
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            {summary.sitesWarning} site{summary.sitesWarning > 1 ? 's are' : ' is'} approaching the budget limit (above 80% utilization).
                        </p>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Budget (All Sites)</CardTitle>
                        <IndianRupee className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(summary.totalBudget)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across {siteBudgets?.length || 0} sites
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses Used</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(summary.totalUsed)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {summary.totalBudget > 0 ? `${((summary.totalUsed / summary.totalBudget) * 100).toFixed(1)}% of total budget` : 'No budget allocated'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Remaining Budget</CardTitle>
                        <BarChart3 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${summary.totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.abs(summary.totalRemaining))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {summary.totalRemaining < 0 ? 'Over budget!' : 'Available balance'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-violet-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sites Overview</CardTitle>
                        <PieChart className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{siteBudgets?.length || 0}</div>
                        <div className="flex items-center gap-2 mt-1">
                            {summary.sitesOverBudget > 0 && (
                                <Badge variant="destructive" className="text-xs">{summary.sitesOverBudget} over</Badge>
                            )}
                            {summary.sitesWarning > 0 && (
                                <Badge className="bg-amber-500 text-xs">{summary.sitesWarning} warning</Badge>
                            )}
                            {summary.sitesOverBudget === 0 && summary.sitesWarning === 0 && (
                                <p className="text-xs text-muted-foreground">All sites within budget</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Overall Progress */}
            {siteBudgets && siteBudgets.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Overall Budget Utilization</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {formatCurrency(summary.totalUsed)} of {formatCurrency(summary.totalBudget)} used
                                </span>
                                <span className={`font-semibold ${getUsageColor(summary.totalBudget > 0 ? (summary.totalUsed / summary.totalBudget) * 100 : 0)}`}>
                                    {summary.totalBudget > 0 ? `${((summary.totalUsed / summary.totalBudget) * 100).toFixed(1)}%` : '0%'}
                                </span>
                            </div>
                            <div className={`relative h-3 rounded-full overflow-hidden ${getProgressBgColor(summary.totalBudget > 0 ? (summary.totalUsed / summary.totalBudget) * 100 : 0)}`}>
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${getProgressColor(summary.totalBudget > 0 ? (summary.totalUsed / summary.totalBudget) * 100 : 0)}`}
                                    style={{ width: `${Math.min(summary.totalBudget > 0 ? (summary.totalUsed / summary.totalBudget) * 100 : 0, 100)}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Add Site Budget Form */}
            {showAddForm && canManage && (
                <Card className="border-primary/50 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CardHeader>
                        <CardTitle className="text-lg">Add New Site Budget</CardTitle>
                        <CardDescription>Assign a budget to a new project site</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="site-name">Site / Project Name *</Label>
                                <Input
                                    id="site-name"
                                    placeholder="e.g., UAD Amrut Phase 2"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="site-budget">Total Budget (₹) *</Label>
                                <Input
                                    id="site-budget"
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    placeholder="500000"
                                    value={totalBudget}
                                    onChange={(e) => setTotalBudget(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <Button type="submit" disabled={addBudgetMutation.isPending}>
                                    {addBudgetMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Check className="h-4 w-4 mr-2" />
                                    )}
                                    Add
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setSiteName('');
                                        setTotalBudget('');
                                    }}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Site Budget Cards */}
            {!siteBudgets || siteBudgets.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No site budgets defined</p>
                        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                            Start by adding a site budget. Once added, expenses linked to each site will be automatically tracked against its budget.
                        </p>
                        {canManage && (
                            <Button onClick={() => setShowAddForm(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add First Site Budget
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {siteBudgets.map((site) => {
                        const budget = Number(site.total_budget);
                        const used = siteExpenseTotals.get(site.site_name) || 0;
                        const remaining = budget - used;
                        const percentage = budget > 0 ? (used / budget) * 100 : 0;
                        const isEditing = editingId === site.id;

                        return (
                            <Card
                                key={site.id}
                                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${percentage >= 100
                                        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/10'
                                        : percentage >= 80
                                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10'
                                            : 'hover:border-primary/30'
                                    }`}
                            >
                                {/* Status indicator strip */}
                                <div className={`absolute top-0 left-0 right-0 h-1 ${getProgressColor(percentage)}`} />

                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        {isEditing ? (
                                            <div className="flex-1 pr-2">
                                                <Input
                                                    value={editSiteName}
                                                    onChange={(e) => setEditSiteName(e.target.value)}
                                                    className="font-semibold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-1">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                                                    {site.site_name}
                                                </CardTitle>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {percentage >= 100 && (
                                                <Badge variant="destructive" className="animate-pulse">
                                                    <ShieldAlert className="h-3 w-3 mr-1" />
                                                    Over Budget
                                                </Badge>
                                            )}
                                            {percentage >= 80 && percentage < 100 && (
                                                <Badge className="bg-amber-500">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Warning
                                                </Badge>
                                            )}
                                            {percentage < 80 && percentage > 0 && (
                                                <Badge className="bg-emerald-500">
                                                    <ArrowUpRight className="h-3 w-3 mr-1" />
                                                    On Track
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {/* Budget Info */}
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <p className="text-xs text-muted-foreground">Total Budget</p>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="1"
                                                    value={editTotalBudget}
                                                    onChange={(e) => setEditTotalBudget(e.target.value)}
                                                    className="h-7 text-sm font-semibold text-center mt-1"
                                                />
                                            ) : (
                                                <p className="text-sm font-semibold mt-1">{formatCurrency(budget)}</p>
                                            )}
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <p className="text-xs text-muted-foreground">Used</p>
                                            <p className={`text-sm font-semibold mt-1 ${getUsageColor(percentage)}`}>
                                                {formatCurrency(used)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-2">
                                            <p className="text-xs text-muted-foreground">Remaining</p>
                                            <p className={`text-sm font-semibold mt-1 ${remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatCurrency(Math.abs(remaining))}
                                                {remaining < 0 && <span className="text-xs ml-1">(over)</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Budget Usage</span>
                                            <span className={`font-semibold ${getUsageColor(percentage)}`}>
                                                {percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className={`relative h-2.5 rounded-full overflow-hidden ${getProgressBgColor(percentage)}`}>
                                            <div
                                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${getProgressColor(percentage)}`}
                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {canManage && (
                                        <div className="flex gap-2 pt-2 border-t">
                                            {isEditing ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleEditSubmit(site.id)}
                                                        disabled={updateBudgetMutation.isPending}
                                                    >
                                                        {updateBudgetMutation.isPending ? (
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                        ) : (
                                                            <Check className="h-3 w-3 mr-1" />
                                                        )}
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => startEditing(site)}
                                                    >
                                                        <Pencil className="h-3 w-3 mr-1" />
                                                        Edit
                                                    </Button>
                                                    {primaryRole === 'owner' && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button size="sm" variant="destructive">
                                                                    <Trash2 className="h-3 w-3 mr-1" />
                                                                    Delete
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Site Budget</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete the budget for "{site.site_name}"?
                                                                        This will not delete any associated expenses, but they will no longer be tracked against this budget.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => deleteBudgetMutation.mutate(site.id)}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SiteBudgets;
