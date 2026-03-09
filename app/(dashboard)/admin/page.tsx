'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Users, 
  Clock, 
  FileText, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  TrendingUp,
  Calendar,
  Activity,
  Briefcase,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardData {
  stats: {
    totalEmployees: number;
    currentlyClockedIn: number;
    pendingLeaveRequests: number;
    pendingExceptions: number;
    todayAttendance: {
      present: number;
      late: number;
      onLeave: number;
      absent: number;
    };
  };
  weeklyAttendance: {
    date: string;
    present: number;
    late: number;
    onLeave: number;
    absent: number;
  }[];
  pendingApprovals: {
    leaves: {
      id: number;
      user_name: string;
      start_date: string;
      end_date: string;
      leave_type: string;
      days_requested: number;
      status: string;
      created_at: string;
    }[];
    exceptions: {
      id: number;
      user_name: string;
      date: string;
      exception_type: string;
      status: string;
      created_at: string;
    }[];
  };
  recentActivity: {
    id: number;
    user_name: string | null;
    action: string;
    entity_type: string;
    created_at: string;
  }[];
  onLeaveToday: {
    name: string;
    start_date: string;
    end_date: string;
    leave_type: string;
  }[];
  recentClockIns: {
    name: string;
    clock_in: string;
    status: string;
  }[];
}

const COLORS = ['#22c55e', '#eab308', '#3b82f6', '#ef4444'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const response = await fetch('/api/admin/dashboard');
      if (response.ok) {
        setData(await response.json());
      } else {
        toast.error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
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
    return <div>Failed to load dashboard data</div>;
  }

  const { stats, weeklyAttendance, pendingApprovals, recentActivity, onLeaveToday, recentClockIns } = data;

  // Prepare chart data
  const attendanceChartData = weeklyAttendance.map(day => ({
    name: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
    Present: day.present,
    Late: day.late,
    'On Leave': day.onLeave,
    Absent: day.absent,
  }));

  const todayData = [
    { name: 'Present', value: stats.todayAttendance.present, color: '#22c55e' },
    { name: 'Late', value: stats.todayAttendance.late, color: '#eab308' },
    { name: 'On Leave', value: stats.todayAttendance.onLeave, color: '#3b82f6' },
    { name: 'Absent', value: stats.todayAttendance.absent, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your organization&apos;s HR metrics
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchDashboardData()}>
          <Activity className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Working</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.currentlyClockedIn}</div>
            <p className="text-xs text-muted-foreground">
              {stats.currentlyClockedIn > 0 
                ? `${Math.round((stats.currentlyClockedIn / stats.totalEmployees) * 100)}% of team`
                : 'No one clocked in'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingLeaveRequests}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Exceptions</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.pendingExceptions}</div>
            <p className="text-xs text-muted-foreground">
              Need review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Attendance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weekly Attendance Trend
            </CardTitle>
            <CardDescription>
              Attendance breakdown for the current week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Present" fill="#22c55e" />
                  <Bar dataKey="Late" fill="#eab308" />
                  <Bar dataKey="On Leave" fill="#3b82f6" />
                  <Bar dataKey="Absent" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Today's Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today&apos;s Attendance
            </CardTitle>
            <CardDescription>
              Current day attendance distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {todayData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={todayData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {todayData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No attendance data for today
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals & Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Pending Approvals
              </CardTitle>
              <CardDescription>
                {stats.pendingLeaveRequests + stats.pendingExceptions} items need your attention
              </CardDescription>
            </div>
            <Link href="/admin/leave-applications">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Pending Leaves */}
              {pendingApprovals.leaves.slice(0, 3).map((leave) => (
                <div key={leave.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{leave.user_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {leave.leave_type} • {leave.days_requested} day{leave.days_requested !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    Pending
                  </Badge>
                </div>
              ))}
              
              {/* Pending Exceptions */}
              {pendingApprovals.exceptions.slice(0, 3).map((exception) => (
                <div key={exception.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{exception.user_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {exception.exception_type.replace(/_/g, ' ')} • {new Date(exception.date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    Pending
                  </Badge>
                </div>
              ))}

              {pendingApprovals.leaves.length === 0 && pendingApprovals.exceptions.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>All caught up! No pending approvals.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest actions in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5">
                    {activity.action === 'create' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {activity.action === 'update' && <Activity className="h-4 w-4 text-blue-500" />}
                    {activity.action === 'delete' && <XCircle className="h-4 w-4 text-red-500" />}
                    {activity.action === 'approve' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {activity.action === 'reject' && <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1">
                    <p>
                      <span className="font-medium">{activity.user_name || 'System'}</span>
                      {' '}<span className="text-muted-foreground">{activity.action}d</span>{' '}
                      <span className="font-medium">{activity.entity_type}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Who's On Leave & Recent Clock-ins */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Who's On Leave Today */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              On Leave Today
            </CardTitle>
            <CardDescription>
              Employees currently on approved leave
            </CardDescription>
          </CardHeader>
          <CardContent>
            {onLeaveToday.length > 0 ? (
              <div className="space-y-3">
                {onLeaveToday.map((person, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {person.leave_type} leave
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Until {new Date(person.end_date).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No one is on leave today</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Clock-ins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-500" />
              Recent Clock-ins
            </CardTitle>
            <CardDescription>
              Most recent employee check-ins today
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentClockIns.length > 0 ? (
              <div className="space-y-3">
                {recentClockIns.map((clockIn, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        clockIn.status === 'late' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <div>
                        <p className="font-medium">{clockIn.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(clockIn.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={clockIn.status === 'late' ? 'destructive' : 'secondary'}>
                      {clockIn.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <p>No clock-ins recorded today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/employees">
          <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Manage Employees</p>
                <p className="text-xs text-muted-foreground">Add, edit, or deactivate</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/projects">
          <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Manage Projects</p>
                <p className="text-xs text-muted-foreground">Configure task projects</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/reports">
          <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">View Reports</p>
                <p className="text-xs text-muted-foreground">Attendance & leave reports</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/settings">
          <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">System Settings</p>
                <p className="text-xs text-muted-foreground">Configure rules & policies</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
