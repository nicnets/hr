'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  CheckSquare
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

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

  async function generateReport(format: 'pdf' | 'csv') {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/admin/reports?type=${selectedReport}&format=${format}&start=${startDate}&end=${endDate}`);
      
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
              <div className="grid gap-4 md:grid-cols-2">
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
              </div>

              {/* Report Preview Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Report Summary</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Report Type: {selectedReportInfo?.label}</li>
                  <li>• Period: {startDate} to {endDate}</li>
                  <li>• Generated: {format(new Date(), 'MMM d, yyyy h:mm a')}</li>
                </ul>
              </div>

              {/* Download Buttons */}
              <div className="flex gap-4">
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
                <Button
                  onClick={() => generateReport('pdf')}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileType className="mr-2 h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
