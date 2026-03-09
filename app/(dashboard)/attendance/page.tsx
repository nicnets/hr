'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Clock, 
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  Square
} from 'lucide-react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, subMonths, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: number;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: 'present' | 'late' | 'half_day' | 'unaccounted' | 'on_leave' | 'lop' | 'pending';
  is_auto_clockout: boolean;
}

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-800 border-green-200',
  late: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  half_day: 'bg-orange-100 text-orange-800 border-orange-200',
  unaccounted: 'bg-red-100 text-red-800 border-red-200',
  on_leave: 'bg-blue-100 text-blue-800 border-blue-200',
  lop: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  half_day: 'Half Day',
  unaccounted: 'Unaccounted',
  on_leave: 'On Leave',
  lop: 'Loss of Pay',
  pending: 'Pending',
};

export default function AttendancePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [currentMonth]);

  async function fetchAttendance() {
    setIsLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      const response = await fetch(`/api/attendance?start=${start}&end=${end}`);
      if (response.ok) {
        const data = await response.json();
        setAttendance(data.records);
        setTodayAttendance(data.today);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      toast.error('Failed to load attendance data');
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
          ? 'Clocked in (Late)' 
          : 'Clocked in successfully');
        fetchAttendance();
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
        fetchAttendance();
      } else {
        toast.error(result.error || 'Failed to clock out');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsClocking(false);
    }
  }

  const isClockedIn = !!todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const totalHours = todayAttendance?.total_hours || 0;

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get attendance for a specific date
  const getAttendanceForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendance.find(a => a.date === dateStr);
  };

  // Calculate stats
  const stats = {
    present: attendance.filter(a => a.status === 'present').length,
    late: attendance.filter(a => a.status === 'late').length,
    halfDay: attendance.filter(a => a.status === 'half_day').length,
    unaccounted: attendance.filter(a => a.status === 'unaccounted').length,
    onLeave: attendance.filter(a => a.status === 'on_leave').length,
    lop: attendance.filter(a => a.status === 'lop').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Attendance</h1>
        <Link href="/attendance/exceptions/new">
          <Button variant="outline">
            <AlertCircle className="mr-2 h-4 w-4" />
            Request Exception
          </Button>
        </Link>
      </div>

      {/* Today's Status Card */}
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
                  {isClockedIn ? 'Currently Working' : todayAttendance?.clock_out ? 'Shift Complete' : 'Not Started'}
                </p>
                {todayAttendance?.clock_in && (
                  <p className="text-sm text-muted-foreground">
                    In: {format(new Date(todayAttendance.clock_in), 'h:mm a')}
                    {todayAttendance.clock_out && ` • Out: ${format(new Date(todayAttendance.clock_out), 'h:mm a')}`}
                    {todayAttendance.is_auto_clockout && ' (Auto)'}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Hours Today</p>
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
                  disabled={isClocking || !!todayAttendance?.clock_out}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isClocking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {todayAttendance?.clock_out ? 'Completed' : 'Clock In'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3 sm:grid-cols-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <p className="text-xs text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            <p className="text-xs text-muted-foreground">Late</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.halfDay}</div>
            <p className="text-xs text-muted-foreground">Half Day</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.unaccounted}</div>
            <p className="text-xs text-muted-foreground">Unaccounted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.onLeave}</div>
            <p className="text-xs text-muted-foreground">On Leave</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.lop}</div>
            <p className="text-xs text-muted-foreground">LOP</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[140px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                  const record = getAttendanceForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isTodayDate = isToday(day);
                  
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "min-h-[80px] p-2 border rounded-lg",
                        !isCurrentMonth && "opacity-50 bg-slate-50",
                        isTodayDate && "ring-2 ring-blue-500",
                        record && statusColors[record.status]
                      )}
                    >
                      <div className="text-sm font-medium">{format(day, 'd')}</div>
                      {record && (
                        <div className="mt-1 text-xs">
                          {record.total_hours !== null && (
                            <div>{record.total_hours}h</div>
                          )}
                          {record.status !== 'present' && (
                            <div className="font-medium">{statusLabels[record.status]}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Attendance List */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>Detailed view of your attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : attendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records for this month</p>
          ) : (
            <div className="space-y-2">
              {attendance.map((record) => (
                <div 
                  key={record.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{format(parseISO(record.date), 'EEEE, MMMM d')}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.clock_in ? format(new Date(record.clock_in), 'h:mm a') : '-'}
                        {' - '}
                        {record.clock_out ? format(new Date(record.clock_out), 'h:mm a') : '-'}
                        {record.is_auto_clockout && ' (Auto)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {record.total_hours !== null && (
                      <span className="text-sm font-medium">{record.total_hours.toFixed(1)} hrs</span>
                    )}
                    <Badge className={statusColors[record.status]}>
                      {statusLabels[record.status]}
                    </Badge>
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
