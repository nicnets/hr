'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Plus,
  Loader2,
  RefreshCw,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  Repeat
} from 'lucide-react';
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

interface Employee {
  id: number;
  name: string;
  email: string;
  department: string;
  is_active: number;
}

interface Project {
  id: number;
  name: string;
}

interface TaskTemplate {
  id: number;
  title: string;
  description: string;
  recurrence_type: 'daily' | 'weekly' | 'monthly';
  due_time: string | null;
  due_day: number | null;
  project_id: number | null;
  assigned_to: number | null;
  is_active: boolean;
  project_name: string | null;
  assigned_to_name: string | null;
  last_assigned_date: string | null;
  tasks_generated: number;
}

const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function TaskTemplatesPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    recurrence_type: 'daily' as 'daily' | 'weekly' | 'monthly',
    due_time: '',
    due_day: undefined as string | undefined,
    project_id: undefined as string | undefined,
    assigned_to: undefined as string | undefined,
  });

  useEffect(() => {
    fetchTemplates();
    fetchEmployees();
    fetchProjects();
  }, []);

  async function fetchTemplates() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/task-templates');
      if (response.ok) {
        setTemplates(await response.json());
      } else {
        toast.error('Failed to fetch templates');
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
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
        setProjects(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }

  function resetForm() {
    setForm({
      title: '',
      description: '',
      recurrence_type: 'daily',
      due_time: '',
      due_day: undefined,
      project_id: undefined,
      assigned_to: undefined,
    });
  }

  function openEditDialog(template: TaskTemplate) {
    setSelectedTemplate(template);
    setForm({
      title: template.title,
      description: template.description,
      recurrence_type: template.recurrence_type,
      due_time: template.due_time || '',
      due_day: template.due_day !== null ? String(template.due_day) : undefined,
      project_id: template.project_id ? String(template.project_id) : undefined,
      assigned_to: template.assigned_to ? String(template.assigned_to) : undefined,
    });
    setShowEditDialog(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title || !form.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate recurrence-specific fields
    if (form.recurrence_type === 'daily' && !form.due_time) {
      toast.error('Please set a due time for daily tasks');
      return;
    }

    if ((form.recurrence_type === 'weekly' || form.recurrence_type === 'monthly') && !form.due_day) {
      toast.error(`Please set a due day for ${form.recurrence_type} tasks`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/task-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          recurrence_type: form.recurrence_type,
          due_time: form.due_time || undefined,
          due_day: form.due_day ? parseInt(form.due_day) : undefined,
          project_id: form.project_id ? parseInt(form.project_id) : undefined,
          assigned_to: form.assigned_to ? parseInt(form.assigned_to) : undefined,
        }),
      });

      if (response.ok) {
        toast.success('Template created successfully');
        setShowCreateDialog(false);
        resetForm();
        fetchTemplates();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create template');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedTemplate) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/task-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          title: form.title,
          description: form.description,
          recurrence_type: form.recurrence_type,
          due_time: form.due_time || undefined,
          due_day: form.due_day ? parseInt(form.due_day) : undefined,
          project_id: form.project_id ? parseInt(form.project_id) : undefined,
          assigned_to: form.assigned_to ? parseInt(form.assigned_to) : undefined,
        }),
      });

      if (response.ok) {
        toast.success('Template updated successfully');
        setShowEditDialog(false);
        setSelectedTemplate(null);
        resetForm();
        fetchTemplates();
      } else {
        toast.error('Failed to update template');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/admin/task-templates?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Template deleted');
        fetchTemplates();
      } else {
        toast.error('Failed to delete template');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  }

  function getRecurrenceLabel(template: TaskTemplate): string {
    if (template.recurrence_type === 'daily' && template.due_time) {
      return `Daily at ${template.due_time}`;
    }
    if (template.recurrence_type === 'weekly' && template.due_day !== null) {
      const day = daysOfWeek.find(d => d.value === template.due_day);
      return `Weekly on ${day?.label || 'Unknown'}`;
    }
    if (template.recurrence_type === 'monthly' && template.due_day !== null) {
      return `Monthly on day ${template.due_day}`;
    }
    return template.recurrence_type;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recurring Task Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage daily, weekly, and monthly recurring task templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTemplates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">How Recurring Templates Work</p>
              <p className="text-sm text-blue-800 mt-1">
                Templates automatically create tasks for employees based on their schedule:
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li><strong>Daily tasks:</strong> Assigned every day at 4:00 AM IST</li>
                <li><strong>Weekly tasks:</strong> Assigned on the specified day at 4:00 AM IST</li>
                <li><strong>Monthly tasks:</strong> Assigned on the specified date at 4:00 AM IST</li>
                <li>Generated tasks appear in employees&apos; &quot;My Assigned Tasks&quot; page</li>
                <li>Employees receive email notifications when new tasks are assigned</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
          <CardDescription>
            {templates.length} recurring task template{templates.length !== 1 ? 's' : ''} • Tasks are automatically assigned to employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates found</p>
              <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                Create your first template
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Template</th>
                    <th className="text-left py-3 px-4 font-medium">Recurrence</th>
                    <th className="text-left py-3 px-4 font-medium">Assigned To</th>
                    <th className="text-left py-3 px-4 font-medium">Project</th>
                    <th className="text-center py-3 px-4 font-medium">Tasks Generated</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(template => (
                    <tr key={template.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{template.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {template.description}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize">{getRecurrenceLabel(template)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {template.assigned_to_name || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {template.project_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="font-mono">
                          {template.tasks_generated || 0}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Recurring Task Template</DialogTitle>
            <DialogDescription>
              Create a template for tasks that repeat on a schedule
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Template Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Daily Status Report"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what needs to be done..."
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence_type">Recurrence Type *</Label>
                <Select 
                  value={form.recurrence_type} 
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                    setForm({ ...form, recurrence_type: value, due_time: '', due_day: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.recurrence_type === 'daily' && (
                <div className="space-y-2">
                  <Label htmlFor="due_time">Due Time * (HH:MM)</Label>
                  <Input
                    id="due_time"
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm({ ...form, due_time: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Tasks will be auto-assigned daily at 04:00 IST with this due time
                  </p>
                </div>
              )}

              {form.recurrence_type === 'weekly' && (
                <div className="space-y-2">
                  <Label htmlFor="due_day">Due Day *</Label>
                  <Select 
                    value={form.due_day} 
                    onValueChange={(value) => setForm({ ...form, due_day: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day of week" />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map(day => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.recurrence_type === 'monthly' && (
                <div className="space-y-2">
                  <Label htmlFor="due_day">Due Date (Day of Month) *</Label>
                  <Select 
                    value={form.due_day} 
                    onValueChange={(value) => setForm({ ...form, due_day: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={String(day)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Default Assignee</Label>
                <Select 
                  value={form.assigned_to} 
                  onValueChange={(value) => setForm({ ...form, assigned_to: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_id">Project</Label>
                <Select 
                  value={form.project_id} 
                  onValueChange={(value) => setForm({ ...form, project_id: value || undefined })}
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Template'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              {/* Similar fields as create dialog */}
              <div className="space-y-2">
                <Label>Recurrence Type</Label>
                <Select 
                  value={form.recurrence_type} 
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                    setForm({ ...form, recurrence_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Add other fields based on recurrence type */}
              {form.recurrence_type === 'daily' && (
                <div className="space-y-2">
                  <Label>Due Time</Label>
                  <Input
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm({ ...form, due_time: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
