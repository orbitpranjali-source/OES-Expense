import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Receipt, CheckCircle, Users, TrendingUp, ArrowRight } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-background to-accent">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Receipt className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ExpenseFlow</span>
          </div>
          <Button onClick={() => navigate('/auth')}>
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Streamline Your
            <span className="block text-primary">Expense Management</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            A complete expense approval workflow system with multi-level reviews,
            file uploads, and real-time status tracking.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold">Easy Submission</h3>
            <p className="text-sm text-muted-foreground">
              Submit expenses with bills, descriptions, and automatic categorization
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <h3 className="mb-2 font-semibold">Multi-Level Approval</h3>
            <p className="text-sm text-muted-foreground">
              Manager → Owner → Accounts approval workflow with complete audit trail
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Users className="h-6 w-6 text-warning" />
            </div>
            <h3 className="mb-2 font-semibold">Role-Based Access</h3>
            <p className="text-sm text-muted-foreground">
              Employee, Manager, Owner, and Accounts roles with specific permissions
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold">Real-Time Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Track expense status, view timeline, and get instant notifications
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2024 ExpenseFlow. Production-ready expense management system.
        </div>
      </footer>
    </div>
  );
};

export default Index;
