'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  CheckSquare,
  Users,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Attendance', href: '/attendance', icon: <Clock className="h-5 w-5" /> },
  { label: 'Leave', href: '/leave', icon: <Calendar className="h-5 w-5" /> },
  { label: 'Tasks', href: '/tasks', icon: <CheckSquare className="h-5 w-5" /> },
];

const adminNavItems: NavItem[] = [
  { label: 'Admin Dashboard', href: '/admin', icon: <Shield className="h-5 w-5" />, adminOnly: true },
  { label: 'Employees', href: '/admin/employees', icon: <Users className="h-5 w-5" />, adminOnly: true },
  { label: 'Projects', href: '/admin/projects', icon: <Briefcase className="h-5 w-5" />, adminOnly: true },
  { label: 'Leave Requests', href: '/admin/leave-applications', icon: <FileText className="h-5 w-5" />, adminOnly: true },
  { label: 'Reports', href: '/admin/reports', icon: <FileText className="h-5 w-5" />, adminOnly: true },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: <Clock className="h-5 w-5" />, adminOnly: true },
  { label: 'Settings', href: '/admin/settings', icon: <Settings className="h-5 w-5" />, adminOnly: true },
];

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}



export function Sidebar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('ForceFriction AI');
  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    fetch('/api/public/config')
      .then(res => res.json())
      .then(data => {
        if (data.logoUrl) setLogoUrl(data.logoUrl);
        if (data.companyName) setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, []);

  const allNavItems = [...navItems, ...(isAdmin ? adminNavItems : [])];

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="mr-2">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b px-4 gap-2">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={logoUrl} 
                  alt={companyName}
                  className="object-contain w-7 h-7"
                />
              ) : null}
              <span className="text-lg font-bold truncate">{companyName}</span>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {allNavItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setOpen(false)} />
              ))}
            </nav>
            <div className="border-t p-4">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex h-full flex-col border-r bg-white">
          <div className="flex h-16 items-center border-b px-4 gap-2">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={logoUrl} 
                alt={companyName}
                className="object-contain w-8 h-8"
              />
            ) : null}
            <span className="text-lg font-bold text-slate-900 truncate">{companyName}</span>
          </div>
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {allNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
          <div className="border-t p-4">
            <div className="mb-4 px-3">
              <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{session?.user?.role}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
