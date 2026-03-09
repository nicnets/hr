'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Loader2, 
  ArrowLeft, 
  Clock,
  Plus,
  Building2,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { format, differenceInMinutes } from 'date-fns';


interface Project {
  id: number;
  name: string;
  description: string | null;
  is_internal: number;
}

export default function LogTaskPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    project_name: '',
    custom_project: '',
    task_description: '',
    start_time: '',
    end_time: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTodayTasks();
  }, []);

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        setProjects(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }

  async function fetchTodayTasks() {
    try {
      const response = await fetch('/api/tasks?date=' + format(new Date(), 'yyyy-MM-dd'));
      if (response.ok) {
        setTodayTasks(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate hours based on start and end time
  const calculateHours = () => {
    if (!formData.start_time || !formData.end_time) return 0;
    
    const start = new Date(`2000-01-01T${formData.start_time}`);
    const end = new Date(`2000-01-01T${formData.end_time}`);
    const minutes = differenceInMinutes(end, start);
    
    return minutes > 0 ? Math.round(minutes / 60 * 100) / 100 : 0;
  };

  const hours = calculateHours();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (hours <= 0) {
      toast.error('End time must be after start time');
      return;
    }

    const projectName = formData.project_name === 'custom' 
      ? formData.custom_project 
      : formData.project_name;

    if (!projectName.trim()) {
      toast.error('Please select or enter a project name');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          project_name: projectName,
          task_description: formData.task_description,
          start_time: formData.start_time,
          end_time: formData.end_time,
        }),
      });

      if (response.ok) {
        toast.success(`Task logged: ${hours} hours`);
        // Reset form
        setFormData({
          project_name: '',
          custom_project: '',
          task_description: '',
          start_time: '',
          end_time: '',
          date: format(new Date(), 'yyyy-MM-dd'),
        });
        fetchTodayTasks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to log task');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Quick time setters
  const setQuickTime = (type: 'start' | 'end', time: string) => {
    setFormData({ ...formData, [type === 'start' ? 'start_time' : 'end_time']: time });
  };

  const totalHoursToday = todayTasks.reduce((sum, task) => sum + (task.hours_spent || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Log Task</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Task Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Task Details
              </CardTitle>
              <CardDescription>
                Record the task you worked on and the time spent
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>

                {/* Project Selection */}
                <div className="space-y-2">
                  <Label>Project *</Label>
                  {isLoadingProjects ? (
                    <div className="flex items-center justify-center h-16">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {projects.map((project) => (
                          <Button
                            key={project.id}
                            type="button"
                            variant={formData.project_name === project.name ? 'default' : 'outline'}
                            className="justify-start text-left h-auto py-2 px-3"
                            onClick={() => setFormData({ ...formData, project_name: project.name, custom_project: '' })}
                          >
                            {project.is_internal === 1 ? (
                              <Building2 className="h-4 w-4 mr-2 flex-shrink-0 text-blue-500" />
                            ) : (
                              <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0 text-purple-500" />
                            )}
                            <span className="truncate">{project.name}</span>
                          </Button>
                        ))}
                        <Button
                          type="button"
                          variant={formData.project_name === 'custom' ? 'default' : 'outline'}
                          className="justify-start"
                          onClick={() => setFormData({ ...formData, project_name: 'custom' })}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Custom Project
                        </Button>
                      </div>
                      
                      {formData.project_name === 'custom' && (
                        <Input
                          placeholder="Enter project name..."
                          value={formData.custom_project}
                          onChange={(e) => setFormData({ ...formData, custom_project: e.target.value })}
                          className="mt-2"
                        />
                      )}
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Contact an admin to add new projects to the list
                  </p>
                </div>

                {/* Time Selection */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                    <div className="flex gap-1 flex-wrap">
                      {['09:00', '10:00', '11:00', '13:00', '14:00'].map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQuickTime('start', time)}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time *</Label>
                    <Input
                      id="end_time"
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                    <div className="flex gap-1 flex-wrap">
                      {['10:00', '12:00', '13:00', '17:00', '18:00'].map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQuickTime('end', time)}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hours Display */}
                {hours > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">Duration: {hours} hour{hours !== 1 ? 's' : ''}</p>
                      <p className="text-sm text-blue-600">
                        {formData.start_time} - {formData.end_time}
                      </p>
                    </div>
                  </div>
                )}

                {/* Task Description */}
                <div className="space-y-2">
                  <Label htmlFor="task_description">Task Description *</Label>
                  <Textarea
                    id="task_description"
                    required
                    placeholder="Describe what you worked on..."
                    value={formData.task_description}
                    onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                    rows={4}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Link href="/tasks">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || hours <= 0}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Log Task'
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Sidebar - Today's Tasks */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Today's Tasks</CardTitle>
              <CardDescription>
                {todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''} logged • {totalHoursToday.toFixed(1)} hours total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : todayTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No tasks logged today
                </p>
              ) : (
                <div className="space-y-3">
                  {todayTasks.map((task) => (
                    <div key={task.id} className="p-3 bg-slate-50 rounded-lg">
                      <p className="font-medium text-sm">{task.project_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {task.task_description}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-muted-foreground">
                          {task.start_time} - {task.end_time}
                        </span>
                        <span className="font-medium">{task.hours_spent}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
