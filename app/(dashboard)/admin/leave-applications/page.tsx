'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Calendar, 
  CheckCircle,
  XCircle,
  Loader2,
  User,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface LeaveApplication {
  id: number;
  user_id: number;
  user_name: string;
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
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AdminLeaveApplicationsPage() {
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    try {
      const response = await fetch('/api/admin/leave-applications');
      if (response.ok) {
        setApplications(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(applicationId: number) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/leave-applications/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      });

      if (response.ok) {
        toast.success('Leave application approved');
        fetchApplications();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!selectedApp || !rejectReason.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/leave-applications/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: selectedApp.id, reason: rejectReason }),
      });

      if (response.ok) {
        toast.success('Leave application rejected');
        setSelectedApp(null);
        setRejectReason('');
        fetchApplications();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredApplications = activeTab === 'pending' 
    ? applications.filter(a => a.status === 'pending')
    : applications;

  const pendingCount = applications.filter(a => a.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Applications</h1>
          <p className="text-muted-foreground">
            {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'pending' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          onClick={() => setActiveTab('all')}
        >
          All Applications
        </Button>
      </div>

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>
            Review and approve or reject leave applications from employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No {activeTab} applications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((app) => (
                <div 
                  key={app.id} 
                  className="p-4 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{app.user_name}</span>
                        </div>
                        <Badge className={statusColors[app.status]}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </Badge>
                        {app.is_lop && (
                          <Badge variant="destructive">LOP</Badge>
                        )}
                      </div>
                      
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(parseISO(app.start_date), 'MMM d')} - {format(parseISO(app.end_date), 'MMM d, yyyy')}
                        </span>
                        <span className="text-muted-foreground">
                          ({app.days_requested} day{app.days_requested !== 1 ? 's' : ''})
                        </span>
                      </div>
                      
                      <div className="mt-1">
                        <span className="text-sm font-medium">{leaveTypeLabels[app.leave_type]}</span>
                      </div>
                      
                      <p className="mt-2 text-sm text-muted-foreground">{app.reason}</p>
                      
                      {app.status === 'rejected' && (
                        <p className="mt-2 text-sm text-red-600">
                          Rejection reason: {app.rejection_reason}
                        </p>
                      )}
                    </div>

                    {app.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedApp(app)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(app.id)}
                          disabled={isSubmitting}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this leave request from {selectedApp?.user_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                This action cannot be undone. The employee will be notified of the rejection.
              </p>
            </div>
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApp(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectReason.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Reject Application'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
