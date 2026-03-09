'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Clock, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Briefcase,
  ArrowRight,
  Loader2,
  Play,
  Square
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface DashboardData {
  user: {
    id: string;
    name: string;
    role: string;
  };
  leaveBalance: {
    total_leaves: number;
    used_leaves: number;
    remaining_leaves: number;
    lop_days: number;
  };
  todayAttendance: {
    id: number;
    clock_in: string | null;
    clock_out: string | null;
    total_hours: number | null;
    status: string;
  } | null;
  recentTasks: {
    id: number;
    project_name: string;
    task_description: string;
    hours_spent: number;
  }[];
  pendingLeaves: {
    id: number;
    start_date: string;
    end_date: string;
    days_requested: number;
  }[];
  notifications: {
    id: number;
    title: string;
    message: string;
  }[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClockIn() {
    setIsClocking(true);
    try {
      const response = await fetch('/api/clock-in', { method: 'POST' });
      const result = await response.json();

      if (response.ok) {
        toast.success(result.status === 'late' 
          ? 'Clocked in (Late - after grace period)' 
          : 'Clocked in successfully');
        fetchDashboardData();
      } else {
        toast.error(result.error || 'Failed to clock in');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsClocking(false);
    }
  }

  async function handleClockOut() {
    setIsClocking(true);
    try {
      const response = await fetch('/api/clock-out', { method: 'POST' });
      const result = await response.json();

      if (response.ok) {
        toast.success(`Clocked out. Worked ${result.hoursWorked} hours`);
        fetchDashboardData();
      } else {
        toast.error(result.error || 'Failed to clock out');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsClocking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div>Error loading dashboard</div>;
  }

  const isClockedIn = !!data.todayAttendance?.clock_in && !data.todayAttendance?.clock_out;
  const totalHours = data.todayAttendance?.total_hours || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Welcome, {data.user.name}</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Clock In/Out Section */}
      <Card className={isClockedIn ? 'border-green-200 bg-green-50/50' : ''}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                isClockedIn ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
              }`}>
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Status</p>
                <p className="text-lg font-semibold">
                  {isClockedIn ? 'Currently Working' : data.todayAttendance?.clock_out ? 'Shift Complete' : 'Not Started'}
                </p>
                {data.todayAttendance?.clock_in && (
                  <p className="text-sm text-muted-foreground">
                    In: {format(new Date(data.todayAttendance.clock_in), 'h:mm a')}
                    {data.todayAttendance.clock_out && ` • Out: ${format(new Date(data.todayAttendance.clock_out), 'h:mm a')}`}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Hours Worked</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
              
              {isClockedIn ? (
                <Button 
                  onClick={handleClockOut} 
                  disabled={isClocking}
                  variant="outline"
                  size="lg"
                  className="border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  {isClocking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="mr-2 h-4 w-4 fill-current" />
                  )}
                  Clock Out
                </Button>
              ) : (
                <Button 
                  onClick={handleClockIn} 
                  disabled={isClocking || !!data.todayAttendance?.clock_out}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isClocking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {data.todayAttendance?.clock_out ? 'Completed' : 'Clock In'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leave Balance</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.leaveBalance.remaining_leaves}</div>
            <p className="text-xs text-muted-foreground">
              of {data.leaveBalance.total_leaves} days
              {data.leaveBalance.lop_days > 0 && ` • ${data.leaveBalance.lop_days} LOP`}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.recentTasks.length}</div>
            <p className="text-xs text-muted-foreground">tasks logged</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingLeaves.length}</div>
            <p className="text-xs text-muted-foreground">leave requests</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today's Tasks</CardTitle>
              <CardDescription>Tasks logged today</CardDescription>
            </div>
            <Link href="/tasks/log">
              <Button variant="outline" size="sm">Log Task</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentTasks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>No tasks logged today</p>
                <p className="text-sm">Start logging tasks to track your productivity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentTasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{task.project_name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{task.task_description}</p>
                    </div>
                    <Badge variant="secondary">{task.hours_spent}h</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Notifications & Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Recent updates and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {data.notifications.length === 0 && data.pendingLeaves.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>No new notifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.pendingLeaves.length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">
                        {data.pendingLeaves.length} Pending Leave Request{data.pendingLeaves.length > 1 ? 's' : ''}
                      </p>
                      <Link href="/leave">
                        <Button variant="link" className="h-auto p-0 text-yellow-700">
                          View Status
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
                
                {data.notifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{notif.title}</p>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Links */}
      <div className="flex flex-wrap gap-4">
        <Link href="/attendance">
          <Button variant="outline">
            <Clock className="mr-2 h-4 w-4" />
            View Attendance History
          </Button>
        </Link>
        <Link href="/leave">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Manage Leave
          </Button>
        </Link>
      </div>
    </div>
  );
}
