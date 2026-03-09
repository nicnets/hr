'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Calendar, 
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveBalance {
  total_leaves: number;
  used_leaves: number;
  remaining_leaves: number;
  lop_days: number;
}

interface LeaveApplication {
  id: number;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  days_requested: number;
  status: 'pending' | 'approved' | 'rejected';
  is_lop: boolean;
  created_at: string;
  rejection_reason?: string;
}

const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  emergency: 'Emergency Leave',
  unpaid: 'Unpaid Leave',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

export default function LeavePage() {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchLeaveData();
  }, []);

  async function fetchLeaveData() {
    try {
      const [balanceRes, appsRes] = await Promise.all([
        fetch('/api/leave/balance'),
        fetch('/api/leave/applications'),
      ]);

      if (balanceRes.ok) {
        setBalance(await balanceRes.json());
      }
      if (appsRes.ok) {
        setApplications(await appsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch leave data:', error);
      toast.error('Failed to load leave data');
    } finally {
      setIsLoading(false);
    }
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Check if a date is within any approved leave period
  const getLeaveForDate = (date: Date): LeaveApplication | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return applications.find(app => 
      app.status === 'approved' &&
      dateStr >= app.start_date && 
      dateStr <= app.end_date
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const approvedCount = applications.filter(a => a.status === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leave Management</h1>
        <Link href="/leave/apply">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Apply for Leave
          </Button>
        </Link>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leaves</p>
                <p className="text-2xl font-bold">{balance?.total_leaves || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Used</p>
                <p className="text-2xl font-bold">{balance?.used_leaves || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold">{balance?.remaining_leaves || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LOP Days</p>
                <p className="text-2xl font-bold">{balance?.lop_days || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Calendar
          </CardTitle>
          <CardDescription>
            View your approved leave days. {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const leave = getLeaveForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              
              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[60px] p-2 border rounded-lg",
                    !isCurrentMonth && "opacity-50 bg-slate-50",
                    isTodayDate && "ring-2 ring-blue-500",
                    leave && "bg-blue-100 border-blue-200"
                  )}
                >
                  <div className="text-sm font-medium">{format(day, 'd')}</div>
                  {leave && (
                    <div className="text-xs text-blue-700 mt-1">
                      {leaveTypeLabels[leave.leave_type]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
              <span>Approved Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
              <span>Pending Request</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
          <CardDescription>
            {approvedCount} approved, {pendingCount} pending
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leave applications yet</p>
              <Link href="/leave/apply">
                <Button variant="link" className="mt-2">
                  Apply for your first leave
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div 
                  key={app.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">
                        {format(parseISO(app.start_date), 'MMM d')} - {format(parseISO(app.end_date), 'MMM d, yyyy')}
                      </p>
                      <Badge className={statusColors[app.status]}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </Badge>
                      {app.is_lop && (
                        <Badge variant="destructive">LOP</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {leaveTypeLabels[app.leave_type]} • {app.days_requested} day{app.days_requested !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm mt-1">{app.reason}</p>
                    {app.rejection_reason && (
                      <p className="text-sm text-red-600 mt-1">
                        Reason: {app.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Applied {format(parseISO(app.created_at), 'MMM d')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
