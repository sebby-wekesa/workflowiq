import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth';

export default function AccountingPage() {
  const { appUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!appUser) {
      navigate('/sign-in');
    }
  }, [appUser, navigate]);

  if (!appUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Accounting</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <h3 className="font-semibold mb-2">Chart of Accounts</h3>
            <p className="text-sm text-muted-foreground">View and manage your chart of accounts</p>
          </div>
          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <h3 className="font-semibold mb-2">Journal Entries</h3>
            <p className="text-sm text-muted-foreground">Create and view journal entries</p>
          </div>
          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <h3 className="font-semibold mb-2">Trial Balance</h3>
            <p className="text-sm text-muted-foreground">View trial balance report</p>
          </div>
        </div>
      </div>
    </div>
  );
}
