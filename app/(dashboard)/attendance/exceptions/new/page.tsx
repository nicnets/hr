'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const exceptionTypes = [
  { value: 'missing_clock_in', label: 'Missing Clock In' },
  { value: 'missing_clock_out', label: 'Missing Clock Out' },
  { value: 'both', label: 'Missing Both (Clock In & Out)' },
  { value: 'wrong_time', label: 'Wrong Time Entry' },
];

export default function NewExceptionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    exception_type: '',
    reason: '',
    requested_clock_in: '',
    requested_clock_out: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Exception request submitted successfully');
        router.push('/attendance');
      } else {
        toast.error(result.error || 'Failed to submit request');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  const showTimeInputs = formData.exception_type === 'missing_clock_in' || 
                         formData.exception_type === 'both' || 
                         formData.exception_type === 'wrong_time';
  
  const showClockOutInput = formData.exception_type === 'missing_clock_out' || 
                            formData.exception_type === 'both' || 
                            formData.exception_type === 'wrong_time';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/attendance">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Request Attendance Exception</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Exception Request Form
          </CardTitle>
          <CardDescription>
            Submit a request to correct your attendance record. Your manager will review and approve or reject the request.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exception_type">Exception Type *</Label>
                <Select
                  value={formData.exception_type}
                  onValueChange={(value) => setFormData({ ...formData, exception_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {exceptionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showTimeInputs && (
              <div className="space-y-2">
                <Label htmlFor="requested_clock_in">Clock In Time</Label>
                <Input
                  id="requested_clock_in"
                  type="time"
                  value={formData.requested_clock_in}
                  onChange={(e) => setFormData({ ...formData, requested_clock_in: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the actual time you started work
                </p>
              </div>
            )}

            {showClockOutInput && (
              <div className="space-y-2">
                <Label htmlFor="requested_clock_out">Clock Out Time</Label>
                <Input
                  id="requested_clock_out"
                  type="time"
                  value={formData.requested_clock_out}
                  onChange={(e) => setFormData({ ...formData, requested_clock_out: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the actual time you ended work
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                required
                placeholder="Please explain why you missed clocking in/out or why the time entry was wrong..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Attendance exceptions are subject to approval by your manager. 
                False requests may result in disciplinary action. Please ensure all information is accurate.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/attendance">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
