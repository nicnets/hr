'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Plus,
  Clock,
  Briefcase,
  Calendar,
  Trash2,
  Edit,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, addWeeks } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Task {
  id: number;
  date: string;
  project_name: string;
  task_description: string;
  start_time: string;
  end_time: string;
  hours_spent: number;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [currentWeek]);

  async function fetchTasks() {
    setIsLoading(true);
    try {
      const start = format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const response = await fetch(`/api/tasks?start=${start}&end=${end}`);
      if (response.ok) {
        setTasks(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(taskId: number) {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/tasks/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      if (response.ok) {
        toast.success('Task deleted');
        setSelectedTask(null);
        fetchTasks();
      } else {
        toast.error('Failed to delete task');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsDeleting(false);
    }
  }

  // Calculate project summary
  const projectSummary = tasks.reduce((acc, task) => {
    if (!acc[task.project_name]) {
      acc[task.project_name] = { hours: 0, tasks: 0 };
    }
    acc[task.project_name].hours += task.hours_spent;
    acc[task.project_name].tasks += 1;
    return acc;
  }, {} as Record<string, { hours: number; tasks: number }>);

  // Sort by hours descending
  const sortedProjects = Object.entries(projectSummary).sort((a, b) => b[1].hours - a[1].hours);

  const totalHours = tasks.reduce((sum, task) => sum + task.hours_spent, 0);
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Logging</h1>
          <p className="text-muted-foreground">
            Track your work hours by project. For assigned tasks with AI review, use <Link href="/tasks/assigned" className="text-blue-600 hover:underline">My Assigned Tasks</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/tasks/assigned">
            <Button variant="outline">
              <CheckSquare className="mr-2 h-4 w-4" />
              My Assigned Tasks
            </Button>
          </Link>
          <Link href="/tasks/picker">
            <Button variant="outline">
              <Briefcase className="mr-2 h-4 w-4" />
              Task Picker
            </Button>
          </Link>
          <Link href="/tasks/log">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Log Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="font-semibold">
                Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                {tasks.length} tasks • {totalHours.toFixed(1)} hours
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasks Logged</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{Object.keys(projectSummary).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Hours by Project */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Hours by Project
            </CardTitle>
            <CardDescription>
              Breakdown of hours spent on each project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedProjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No tasks logged this week
              </p>
            ) : (
              <div className="space-y-3">
                {sortedProjects.map(([project, data]) => (
                  <div key={project} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{project}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.tasks} task{data.tasks !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{data.hours.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">
                        {totalHours > 0 ? Math.round((data.hours / totalHours) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Breakdown
            </CardTitle>
            <CardDescription>
              Hours logged per day this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {eachDayOfInterval({ start: weekStart, end: weekEnd }).map((day) => {
                  const dayTasks = tasks.filter(t => t.date === format(day, 'yyyy-MM-dd'));
                  const dayHours = dayTasks.reduce((sum, t) => sum + t.hours_spent, 0);
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{format(day, 'EEEE')}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(day, 'MMM d')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{dayHours.toFixed(1)}h</p>
                        <p className="text-xs text-muted-foreground">
                          {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task History */}
      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
          <CardDescription>
            All tasks logged this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks logged this week</p>
              <Link href="/tasks/log">
                <Button variant="link" className="mt-2">
                  Log your first task
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary">{task.project_name}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(task.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="mt-2">{task.task_description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {task.start_time} - {task.end_time}
                      </span>
                      <span className="font-medium text-foreground">
                        {task.hours_spent} hour{task.hours_spent !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedTask(task)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="py-4">
              <p className="font-medium">{selectedTask.project_name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTask.task_description}
              </p>
              <p className="text-sm mt-2">
                {selectedTask.hours_spent} hours on {format(parseISO(selectedTask.date), 'MMM d, yyyy')}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedTask && handleDelete(selectedTask.id)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
