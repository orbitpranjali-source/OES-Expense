import { ReactNode } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  LayoutDashboard,
  Plus,
  CheckCircle,
  Users,
  CreditCard,
  LogOut,
  Bell,
  FileText,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface DashboardLayoutProps {
  children?: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { primaryRole, loading } = useUserRole();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['employee', 'manager', 'owner', 'accounts'] },
    { name: 'My Expenses', href: '/expenses', icon: FileText, roles: ['employee', 'manager', 'owner', 'accounts'] },
    { name: 'Add Expense', href: '/expense/new', icon: Plus, roles: ['employee', 'manager', 'owner', 'accounts'] },
    { name: 'Approvals', href: '/approvals', icon: CheckCircle, roles: ['manager', 'owner'] },
    { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['accounts'] },
    { name: 'Users', href: '/users', icon: Users, roles: ['owner'] },
  ];

  const filteredNav = navigation.filter(item => item.roles.includes(primaryRole));

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <img src={`${import.meta.env.BASE_URL}orbit-logo.png`} alt="OES Logo" className="h-10 w-10 object-contain" />
            <span className="text-lg font-bold tracking-tight">OES Expense Flow</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.name} to={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(user?.user_metadata?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {user?.user_metadata?.full_name || 'User'}
                </p>
                <Badge variant="outline" className="mt-1 text-xs capitalize">
                  {primaryRole}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              className="mt-2 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <h1 className="text-xl font-semibold">
            {filteredNav.find(item => item.href === location.pathname)?.name || 'Dashboard'}
          </h1>
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
