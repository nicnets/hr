'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { format, differenceInBusinessDays, parseISO } from 'date-fns';

const leaveTypes = [
  { value: 'annual', label: 'Annual Leave', allowPast: false },
  { value: 'sick', label: 'Sick Leave', allowPast: true },
  { value: 'emergency', label: 'Emergency Leave', allowPast: true },
  { value: 'unpaid', label: 'Unpaid Leave', allowPast: false },
];

export default function ApplyLeavePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState<{ 
    total_leaves: number;
    used_leaves: number;
    remaining_leaves: number;
    lop_days: number;
  } | null>(null);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    leave_type: '',
    reason: '',
  });

  useEffect(() => {
    fetchBalance();
  }, []);

  async function fetchBalance() {
    try {
      const response = await fetch('/api/leave/balance');
      if (response.ok) {
        setBalance(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }

  // Calculate business days
  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = parseISO(formData.start_date);
    const end = parseISO(formData.end_date);
    const days = differenceInBusinessDays(end, start) + 1;
    return days > 0 ? days : 0;
  };

  const requestedDays = calculateDays();
  const willBeLop = balance && requestedDays > balance.remaining_leaves;
  
  // Check if selected leave type allows past dates
  const selectedLeaveType = leaveTypes.find(t => t.value === formData.leave_type);
  const allowsPastDates = selectedLeaveType?.allowPast || false;
  
  // Calculate min/max dates based on leave type
  const getDateConstraints = () => {
    if (allowsPastDates) {
      // Sick/Emergency: Can apply for past 30 days up to today
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      return {
        min: pastDate.toISOString().split('T')[0],
        max: new Date().toISOString().split('T')[0], // Can't be future
      };
    }
    // Annual/Unpaid: Can apply for today onwards (future)
    return {
      min: new Date().toISOString().split('T')[0],
      max: undefined, // No max limit for future dates
    };
  };
  
  const dateConstraints = getDateConstraints();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (requestedDays <= 0) {
      toast.error('End date must be after start date');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.isLop 
          ? 'Leave applied. Warning: This will be marked as Loss of Pay.' 
          : 'Leave application submitted successfully');
        router.push('/leave');
      } else {
        toast.error(result.error || 'Failed to submit application');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/leave">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Apply for Leave</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Application Form
              </CardTitle>
              <CardDescription>
                Fill in the details below to apply for leave. Your manager will review and approve or reject your request.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      required
                      min={dateConstraints.min}
                      max={dateConstraints.max}
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                    {allowsPastDates && formData.leave_type && (
                      <p className="text-xs text-blue-600">
                        Sick/Emergency leave can be applied up to 30 days retrospectively
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      required
                      min={formData.start_date || dateConstraints.min}
                      max={dateConstraints.max}
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                {requestedDays > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Requesting <strong>{requestedDays}</strong> business day{requestedDays !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="leave_type">Leave Type *</Label>
                  <Select
                    value={formData.leave_type}
                    onValueChange={(value) => setFormData({ ...formData, leave_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    required
                    placeholder="Please provide a reason for your leave request..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={4}
                  />
                </div>

                {willBeLop && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Insufficient Leave Balance</p>
                      <p className="text-sm text-red-700 mt-1">
                        You only have {balance?.remaining_leaves} day{balance?.remaining_leaves !== 1 ? 's' : ''} remaining, 
                        but you're requesting {requestedDays} days. 
                        This application will be marked as <strong>Loss of Pay (LOP)</strong> if approved.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Link href="/leave">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || requestedDays <= 0}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{balance?.total_leaves || 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">{balance?.used_leaves || 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-bold text-green-600">{balance?.remaining_leaves || 0} days</span>
                </div>
                {(balance?.lop_days || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LOP</span>
                    <span className="font-medium text-red-600">{balance?.lop_days} days</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Apply at least 3 days in advance for planned leave</li>
                <li>• Sick leave can be applied retroactively with documentation</li>
                <li>• Emergency leave should be followed up with details</li>
                <li>• Unpaid leave requires manager approval</li>
                <li>• Insufficient balance results in Loss of Pay (LOP)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
