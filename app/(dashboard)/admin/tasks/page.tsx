'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Plus,
  Loader2,
  Users,
  Calendar,
  Clock,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Employee {
  id: number;
  name: string;
  email: string;
  department: string;
  is_active: number;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'assigned' | 'in_progress' | 'pending_review' | 'closed' | 'rejected';
  due_date: string | null;
  assigned_to_id: number;
  assigned_to_name: string;
  assigned_to_email: string;
  assigned_by_name: string;
  evidence_type: 'link' | 'attachment' | 'none';
  evidence_url: string | null;
  evidence_description: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_notes: string | null;
  auto_approve: number;
  recurrence_type: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-orange-100 text-orange-800',
  closed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_review: 'Pending Review',
  closed: 'Closed',
  rejected: 'Rejected',
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    auto_approve: false,
    recurrence_type: 'adhoc' as 'daily' | 'weekly' | 'monthly' | 'adhoc',
    project_id: undefined as string | undefined,
  });
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    fetchProjects();
  }, []);

  async function fetchTasks() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/tasks');
      if (response.ok) {
        setTasks(await response.json());
      } else {
        toast.error('Failed to fetch tasks');
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchEmployees() {
    try {
      const response = await fetch('/api/admin/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.filter((e: Employee) => e.is_active !== 0));
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    
    if (!createForm.title || !createForm.description || !createForm.assigned_to) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      
      if (response.ok) {
        toast.success('Task assigned successfully');
        setShowCreateDialog(false);
        setCreateForm({
          title: '',
          description: '',
          assigned_to: '',
          due_date: '',
          auto_approve: false,
          recurrence_type: 'adhoc',
          project_id: undefined,
        });
        fetchTasks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create task');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReviewTask() {
    if (!selectedTask) return;
    
    setIsReviewing(true);
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: selectedTask.id,
          action: 'review',
          status: reviewAction,
          review_notes: reviewNotes,
        }),
      });
      
      if (response.ok) {
        toast.success(`Task ${reviewAction === 'approved' ? 'approved' : 'rejected'}`);
        setShowReviewDialog(false);
        setSelectedTask(null);
        setReviewNotes('');
        fetchTasks();
      } else {
        toast.error('Failed to review task');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleDeleteTask(taskId: number) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`/api/admin/tasks?id=${taskId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Task deleted');
        fetchTasks();
      } else {
        toast.error('Failed to delete task');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterEmployee !== 'all' && task.assigned_to_id !== parseInt(filterEmployee)) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    assigned: tasks.filter(t => t.status === 'assigned').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pendingReview: tasks.filter(t => t.status === 'pending_review').length,
    closed: tasks.filter(t => t.status === 'closed').length,
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'closed' || task.status === 'rejected') return false;
    return isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Management</h1>
          <p className="text-muted-foreground mt-1">
            Assign and manage tasks for your team
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Assign Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Tasks</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Closed</p>
            <p className="text-2xl font-bold text-green-600">{stats.closed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterEmployee('all'); }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            Showing {filteredTasks.length} of {tasks.length} tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks found</p>
              <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                Assign your first task
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Task</th>
                    <th className="text-left py-3 px-4 font-medium">Assigned To</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Due Date</th>
                    <th className="text-left py-3 px-4 font-medium">Submitted</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <div className="flex gap-1 mt-1">
                            {task.auto_approve === 1 && (
                              <Badge variant="outline" className="text-xs">Auto-approve</Badge>
                            )}
                            {task.recurrence_type && task.recurrence_type !== 'adhoc' && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {task.recurrence_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {task.assigned_to_name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[task.status]}>
                          {statusLabels[task.status]}
                        </Badge>
                        {isOverdue(task) && (
                          <Badge variant="destructive" className="ml-2">Overdue</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {task.due_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(task.due_date), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {task.submitted_at ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(task.submitted_at), 'MMM d, HH:mm')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedTask(task); setShowTaskDetailDialog(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {task.status === 'pending_review' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedTask(task); setShowReviewDialog(true); }}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign New Task</DialogTitle>
            <DialogDescription>
              Create and assign a task to an employee
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g., Design new landing page"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Describe the task requirements..."
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To *</Label>
                <Select 
                  value={createForm.assigned_to} 
                  onValueChange={(value) => setCreateForm({ ...createForm, assigned_to: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence_type">Task Type</Label>
                <Select 
                  value={createForm.recurrence_type} 
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'adhoc') => 
                    setCreateForm({ ...createForm, recurrence_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adhoc">Ad-hoc (One time)</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project_id">Project</Label>
                <Select 
                  value={createForm.project_id} 
                  onValueChange={(value) => setCreateForm({ ...createForm, project_id: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map(proj => (
                      <SelectItem key={proj.id} value={String(proj.id)}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_approve"
                  checked={createForm.auto_approve}
                  onChange={(e) => setCreateForm({ ...createForm, auto_approve: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="auto_approve" className="font-normal cursor-pointer">
                  Auto-approve this task (skip review)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Task'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Task Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Task</DialogTitle>
            <DialogDescription>
              Review the submitted task and provide feedback
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
              </div>
              {selectedTask.evidence_url && (
                <div className="space-y-2">
                  <Label>Evidence</Label>
                  <a 
                    href={selectedTask.evidence_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block"
                  >
                    {selectedTask.evidence_url}
                  </a>
                </div>
              )}
              {selectedTask.evidence_description && (
                <div className="space-y-2">
                  <Label>Evidence Description</Label>
                  <p className="text-sm">{selectedTask.evidence_description}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Decision</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reviewAction"
                      checked={reviewAction === 'approved'}
                      onChange={() => setReviewAction('approved')}
                    />
                    <span>Approve</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reviewAction"
                      checked={reviewAction === 'rejected'}
                      onChange={() => setReviewAction('rejected')}
                    />
                    <span>Reject</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewNotes">Review Notes</Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add your feedback..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReviewTask} 
              disabled={isReviewing}
              variant={reviewAction === 'approved' ? 'default' : 'destructive'}
            >
              {isReviewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                reviewAction === 'approved' ? 'Approve Task' : 'Reject Task'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={showTaskDetailDialog} onOpenChange={setShowTaskDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium">{selectedTask.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{selectedTask.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{selectedTask.assigned_to_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned By</p>
                  <p className="font-medium">{selectedTask.assigned_by_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedTask.status]}>
                    {statusLabels[selectedTask.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p>{selectedTask.due_date ? format(parseISO(selectedTask.due_date), 'MMM d, yyyy') : '-'}</p>
                </div>
              </div>
              {selectedTask.submitted_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Submitted At</p>
                  <p>{format(parseISO(selectedTask.submitted_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
              {selectedTask.evidence_url && (
                <div>
                  <p className="text-sm text-muted-foreground">Evidence</p>
                  <a 
                    href={selectedTask.evidence_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {selectedTask.evidence_url}
                  </a>
                </div>
              )}
              {selectedTask.reviewed_by_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Reviewed By</p>
                  <p>{selectedTask.reviewed_by_name}</p>
                  {selectedTask.review_notes && (
                    <p className="text-sm mt-1"><span className="font-medium">Notes:</span> {selectedTask.review_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
