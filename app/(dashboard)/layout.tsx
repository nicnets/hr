import { SidebarWrapper } from '@/components/layout/SidebarWrapper';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { authOptions } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SidebarWrapper />
      <div className="lg:pl-64">
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
