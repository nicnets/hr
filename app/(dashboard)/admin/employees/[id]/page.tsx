'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Users, 
  Loader2, 
  ArrowLeft,
  Mail,
  Briefcase,
  Calendar,
  Lock,
  Palmtree
} from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParams } from 'next/navigation';

const departments = [
  'Engineering',
  'Design',
  'Marketing',
  'Sales',
  'HR',
  'Operations',
  'Finance',
  'Other',
];

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
  joining_date: string;
  is_active: boolean;
  total_leaves?: number;
  used_leaves?: number;
  remaining_leaves?: number;
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [formData, setFormData] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchEmployee();
  }, [employeeId]);

  async function fetchEmployee() {
    try {
      const response = await fetch(`/api/admin/employees/detail?id=${employeeId}`);
      if (response.ok) {
        setFormData(await response.json());
      } else {
        toast.error('Employee not found');
        router.push('/admin/employees');
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error);
      toast.error('Failed to load employee');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/employees/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(employeeId),
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
          total_leaves: formData.total_leaves,
        }),
      });

      if (response.ok) {
        toast.success('Employee updated successfully');
        router.push('/admin/employees');
      } else {
        const result = await response.json();
        toast.error(result.error || 'Failed to update employee');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsResettingPassword(true);

    try {
      const response = await fetch('/api/admin/employees/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(employeeId),
          password: newPassword,
        }),
      });

      if (response.ok) {
        toast.success('Password reset successfully');
        setNewPassword('');
      } else {
        toast.error('Failed to reset password');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsResettingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!formData) {
    return <div>Employee not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/employees">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Edit Employee</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Details
            </CardTitle>
            <CardDescription>
              Update employee information
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.department || ''}
                    onValueChange={(value) => setFormData({ ...formData, department: value })}
                  >
                    <SelectTrigger>
                      <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joining_date">Joining Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="joining_date"
                    type="date"
                    value={formData.joining_date}
                    disabled
                    className="pl-10 bg-slate-50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Joining date cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_leaves">Annual Leave Days</Label>
                <div className="relative">
                  <Palmtree className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="total_leaves"
                    type="number"
                    min="0"
                    max="365"
                    step="0.5"
                    value={formData.total_leaves ?? 7}
                    onChange={(e) => setFormData({ ...formData, total_leaves: parseFloat(e.target.value) })}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Standard: 7 days, Interns: 3 days
                </p>
                {(formData.used_leaves !== undefined && formData.remaining_leaves !== undefined) && (
                  <p className="text-xs text-slate-600">
                    Used: {formData.used_leaves} days | Remaining: {formData.remaining_leaves} days
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Link href="/admin/employees">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Password Reset */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Reset Password
            </CardTitle>
            <CardDescription>
              Set a new password for this employee
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleResetPassword} 
              disabled={isResettingPassword || !newPassword}
              className="w-full"
            >
              {isResettingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
