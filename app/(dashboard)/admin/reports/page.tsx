'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  FileText, 
  Download,
  FileSpreadsheet,
  FileType,
  Loader2,
  Calendar,
  Users,
  Clock,
  CheckSquare,
  Brain,
  AlertTriangle,
  Hand,
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  UserCheck
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

const reportTypes = [
  { 
    id: 'attendance', 
    label: 'Attendance Report', 
    description: 'Employee attendance records with clock times and status',
    icon: Clock,
    color: 'blue'
  },
  { 
    id: 'leave', 
    label: 'Leave Report', 
    description: 'Leave applications and balance summary',
    icon: Calendar,
    color: 'green'
  },
  { 
    id: 'productivity', 
    label: 'Productivity Report', 
    description: 'Task logs and hours by project/employee',
    icon: CheckSquare,
    color: 'purple'
  },
  { 
    id: 'tasks', 
    label: 'Task Management Report', 
    description: 'Assigned tasks with submission details and AI analysis',
    icon: BarChart3,
    color: 'indigo'
  },
  { 
    id: 'ai-analysis', 
    label: 'AI Analysis Report', 
    description: 'AI analysis results and scores by employee',
    icon: Brain,
    color: 'pink'
  },
  { 
    id: 'violations', 
    label: 'Attendance Violations Report', 
    description: 'No task submissions, rejections, and leave deductions',
    icon: AlertTriangle,
    color: 'red'
  },
  { 
    id: 'task-picker', 
    label: 'Task Picker Report', 
    description: 'Task picker usage and completion statistics',
    icon: Hand,
    color: 'orange'
  },
];

const dateRanges = [
  { label: 'Today', start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 7 Days', start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30 Days', start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Month', start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
  { label: 'Last Month', start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('attendance');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [employees, setEmployees] = useState<Array<{id: number, name: string}>>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const response = await fetch('/api/admin/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter((e: any) => e.is_active !== 0).map((e: any) => ({ id: e.id, name: e.name })));
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }

  async function loadReport() {
    setIsLoading(true);
    try {
      const url = `/api/admin/reports?type=${selectedReport}&start_date=${startDate}&end_date=${endDate}${employeeId ? `&employee_id=${employeeId}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to load report');
      }
      
      const data = await response.json();
      setReportData(data);
      toast.success('Report loaded');
    } catch (error) {
      toast.error('Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }

  async function generateReport(format: 'pdf' | 'csv') {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/admin/reports?type=${selectedReport}&format=${format}&start_date=${startDate}&end_date=${endDate}${employeeId ? `&employee_id=${employeeId}` : ''}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report-${startDate}-to-${endDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }

  const selectedReportInfo = reportTypes.find(r => r.id === selectedReport);
  const Icon = selectedReportInfo?.icon || FileText;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download HR reports
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Report Type Selection */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportTypes.map((report) => {
                const ReportIcon = report.icon;
                return (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedReport === report.id
                        ? `border-${report.color}-500 bg-${report.color}-50`
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full bg-${report.color}-100 flex items-center justify-center`}>
                        <ReportIcon className={`h-5 w-5 text-${report.color}-600`} />
                      </div>
                      <div>
                        <p className="font-medium">{report.label}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Report Configuration */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                Configure Report
              </CardTitle>
              <CardDescription>
                {selectedReportInfo?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Date Ranges */}
              <div>
                <Label className="mb-3 block">Quick Select</Label>
                <div className="flex flex-wrap gap-2">
                  {dateRanges.map((range) => (
                    <Button
                      key={range.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(range.start);
                        setEndDate(range.end);
                      }}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Date</Label>
                  <Input
                    id="start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Date</Label>
                  <Input
                    id="end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee (Optional)</Label>
                  <select
                    id="employee"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">All Employees</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={String(emp.id)}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  onClick={loadReport}
                  disabled={isLoading}
                  variant="default"
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="mr-2 h-4 w-4" />
                  )}
                  View Report
                </Button>
                <Button
                  onClick={() => generateReport('csv')}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex-1"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* On-Screen Report Visualization */}
          {reportData && (
            <div className="mt-6 space-y-6">
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                {reportData.summary && Object.entries(reportData.summary).slice(0, 4).map(([key, value]: [string, any]) => (
                  <Card key={key}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Bar Chart */}
                {reportData.chartData && reportData.chartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        {selectedReportInfo?.label} Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportData.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Status Distribution Pie Chart */}
                {reportData.statusDistribution && reportData.statusDistribution.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5" />
                        Status Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={reportData.statusDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                            >
                              {reportData.statusDistribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color || `hsl(${index * 45}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Trend Chart */}
              {reportData.trendData && reportData.trendData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Trend Over Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={reportData.trendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {reportData.trendSeries ? (
                            reportData.trendSeries.map((series: any, idx: number) => (
                              <Line 
                                key={series.key}
                                type="monotone" 
                                dataKey={series.key} 
                                name={series.name}
                                stroke={series.color || `hsl(${idx * 60}, 70%, 50%)`} 
                                strokeWidth={2}
                              />
                            ))
                          ) : (
                            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Data Table */}
              {reportData.records && reportData.records.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Records</CardTitle>
                    <CardDescription>Showing {reportData.records.length} records</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {reportData.columns?.map((col: string) => (
                              <th key={col} className="text-left py-3 px-4 font-medium capitalize">
                                {col.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.records.slice(0, 10).map((record: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-slate-50">
                              {reportData.columns?.map((col: string) => (
                                <td key={col} className="py-3 px-4">
                                  {col === 'status' ? (
                                    <Badge variant={record[col] === 'approved' || record[col] === 'present' || record[col] === 'closed' ? 'default' : 'secondary'}>
                                      {record[col]}
                                    </Badge>
                                  ) : col.includes('date') ? (
                                    record[col] ? format(parseISO(record[col]), 'MMM d, yyyy') : '-'
                                  ) : (
                                    record[col] || '-'
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {reportData.records.length > 10 && (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          ... and {reportData.records.length - 10} more records
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
