'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ClockWidgetProps {
  isClockedIn: boolean;
}

export function ClockWidget({ isClockedIn }: ClockWidgetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clockedIn, setClockedIn] = useState(isClockedIn);

  async function handleClockIn() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/clock-in', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setClockedIn(true);
        toast.success(data.status === 'late' 
          ? 'Clocked in (Late - after grace period)' 
          : 'Clocked in successfully');
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to clock in');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClockOut() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/clock-out', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setClockedIn(false);
        toast.success(`Clocked out. Worked ${data.hoursWorked} hours`);
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to clock out');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  if (clockedIn) {
    return (
      <Button 
        onClick={handleClockOut} 
        disabled={isLoading}
        variant="outline"
        className="w-full h-16 text-lg border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          'Clock Out'
        )}
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleClockIn} 
      disabled={isLoading}
      className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        'Clock In'
      )}
    </Button>
  );
}
