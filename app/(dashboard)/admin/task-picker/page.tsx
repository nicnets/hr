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
  Hand,
  CheckCircle,
  User
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Project {
  id: number;
  name: string;
}

interface TaskPickerItem {
  id: number;
  title: string;
  description: string;
  project_name: string | null;
  estimated_hours: number | null;
  difficulty_level: 'Very Easy' | 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult' | null;
  required_skills: string | null;
  is_active: boolean;
  picked_by: number | null;
  picked_at: string | null;
  completed_at: string | null;
  picker_name: string | null;
  created_at: string;
}

const difficultyOptions = ['Very Easy', 'Easy', 'Moderate', 'Difficult', 'Very Difficult'];

export default function AdminTaskPickerPage() {
  const [tasks, setTasks] = useState<TaskPickerItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPickerItem | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: undefined as string | undefined,
    estimated_hours: '',
    difficulty_level: 'Moderate' as 'Very Easy' | 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult',
    required_skills: '',
  });

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, [activeTab]);

  async function fetchTasks() {
    setIsLoading(true);
    try {
      const url = `/api/admin/task-picker?status=${activeTab === 'all' ? '' : activeTab}`;
      const response = await fetch(url);
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
      project_id: undefined,
      estimated_hours: '',
      difficulty_level: 'Moderate',
      required_skills: '',
    });
  }

  function openEditDialog(task: TaskPickerItem) {
    setSelectedTask(task);
    setForm({
      title: task.title,
      description: task.description,
      project_id: task.project_name ? String(projects.find(p => p.name === task.project_name)?.id || '') : '',
      estimated_hours: task.estimated_hours ? String(task.estimated_hours) : '',
      difficulty_level: task.difficulty_level || 'Moderate',
      required_skills: task.required_skills ? JSON.parse(task.required_skills).join(', ') : '',
    });
    setShowEditDialog(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title || !form.description) {
      toast.error('Title and description are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = form.required_skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const response = await fetch('/api/admin/task-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          project_id: form.project_id ? parseInt(form.project_id) : null,
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
          difficulty_level: form.difficulty_level,
          required_skills: skillsArray.length > 0 ? skillsArray : null,
        }),
      });

      if (response.ok) {
        toast.success('Task created successfully');
        setShowCreateDialog(false);
        resetForm();
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

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;

    setIsSubmitting(true);
    try {
      const skillsArray = form.required_skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const response = await fetch('/api/admin/task-picker', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          title: form.title,
          description: form.description,
          project_id: form.project_id ? parseInt(form.project_id) : null,
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
          difficulty_level: form.difficulty_level,
          required_skills: skillsArray.length > 0 ? skillsArray : null,
        }),
      });

      if (response.ok) {
        toast.success('Task updated successfully');
        setShowEditDialog(false);
        setSelectedTask(null);
        resetForm();
        fetchTasks();
      } else {
        toast.error('Failed to update task');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/admin/task-picker?id=${id}`, {
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

  const getStatusBadge = (task: TaskPickerItem) => {
    if (task.completed_at) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (task.picked_by) {
      return <Badge variant="secondary"><User className="h-3 w-3 mr-1" />Picked</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800"><Hand className="h-3 w-3 mr-1" />Available</Badge>;
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'available') return !task.picked_by && !task.completed_at;
    if (activeTab === 'picked') return task.picked_by && !task.completed_at;
    if (activeTab === 'completed') return task.completed_at;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Picker Pool</h1>
          <p className="text-muted-foreground mt-1">
            Manage tasks that employees can pick during free time
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
          <TabsTrigger value="available">Available ({tasks.filter(t => !t.picked_by && !t.completed_at).length})</TabsTrigger>
          <TabsTrigger value="picked">Picked ({tasks.filter(t => t.picked_by && !t.completed_at).length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({tasks.filter(t => t.completed_at).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Hand className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Task</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Project</th>
                        <th className="text-left py-3 px-4 font-medium">Est. Hours</th>
                        <th className="text-left py-3 px-4 font-medium">Difficulty</th>
                        <th className="text-left py-3 px-4 font-medium">Picked By</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(task => (
                        <tr key={task.id} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(task)}</td>
                          <td className="py-3 px-4">{task.project_name || '-'}</td>
                          <td className="py-3 px-4">{task.estimated_hours || '-'}</td>
                          <td className="py-3 px-4">{task.difficulty_level || '-'}</td>
                          <td className="py-3 px-4">{task.picker_name || '-'}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(task)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>
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
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task to Picker Pool</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} required />
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v || undefined})}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Est. Hours</Label>
                  <Input type="number" step="0.5" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={form.difficulty_level} onValueChange={v => setForm({...form, difficulty_level: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {difficultyOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Required Skills (comma-separated)</Label>
                <Input value={form.required_skills} onChange={e => setForm({...form, required_skills: e.target.value})} placeholder="e.g., React, Node.js, Design" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Task'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} required />
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v || undefined})}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Est. Hours</Label>
                  <Input type="number" step="0.5" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={form.difficulty_level} onValueChange={v => setForm({...form, difficulty_level: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {difficultyOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
