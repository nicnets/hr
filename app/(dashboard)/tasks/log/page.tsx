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
  ExternalLink,
  AlertCircle,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { format, differenceInMinutes } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';


interface Project {
  id: number;
  name: string;
  description: string | null;
  is_internal: number;
}

interface TaskLog {
  id: number;
  project_name: string;
  task_description: string;
  hours_spent: number;
  date: string;
  start_time: string;
  end_time: string;
}

export default function LogTaskPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayTasks, setTodayTasks] = useState<TaskLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const MIN_WORD_COUNT = 40;
  
  const [formData, setFormData] = useState({
    project_name: '',
    custom_project: '',
    task_description: '',
    start_time: '',
    end_time: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  // Detailed submission form
  const [detailForm, setDetailForm] = useState({
    work_summary: '',
    task_objective: '',
    final_outcome: '',
    scope_change: 'No change' as 'No change' | 'Minor change' | 'Moderate change' | 'Major change',
    output_type: 'Document / Report',
    output_description: '',
    time_spent: '1–2 hours',
    difficulty_level: 'Moderate' as 'Very Easy' | 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult',
    confidence_level: 'Confident' as 'Very confident' | 'Confident' | 'Somewhat confident' | 'Not confident',
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
        const result = await response.json();
        toast.success(`Task logged: ${hours} hours`);
        setLastTaskId(result.taskId);
        // Show detail dialog for AI analysis
        setShowDetailDialog(true);
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

  async function handleDetailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lastTaskId) return;

    if (wordCount < MIN_WORD_COUNT) {
      toast.error(`Work summary must be at least ${MIN_WORD_COUNT} words`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the task log with AI submission details
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: lastTaskId,
          work_summary: detailForm.work_summary,
          task_objective: detailForm.task_objective,
          final_outcome: detailForm.final_outcome,
          scope_change: detailForm.scope_change,
          output_type: detailForm.output_type,
          output_description: detailForm.output_description,
          difficulty_level: detailForm.difficulty_level,
          confidence_level: detailForm.confidence_level,
        }),
      });

      if (response.ok) {
        toast.success('Task details submitted for AI analysis');
        // Reset forms
        setFormData({
          project_name: '',
          custom_project: '',
          task_description: '',
          start_time: '',
          end_time: '',
          date: format(new Date(), 'yyyy-MM-dd'),
        });
        setDetailForm({
          work_summary: '',
          task_objective: '',
          final_outcome: '',
          scope_change: 'No change',
          output_type: 'Document / Report',
          output_description: '',
          time_spent: '1–2 hours',
          difficulty_level: 'Moderate',
          confidence_level: 'Confident',
        });
        setWordCount(0);
        setShowDetailDialog(false);
        setLastTaskId(null);
        fetchTodayTasks(); // Refresh to show AI status
      } else {
        toast.error('Failed to submit details');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleWorkSummaryChange(value: string) {
    setDetailForm({ ...detailForm, work_summary: value });
    setWordCount(value.trim().split(/\s+/).filter(w => w.length > 0).length);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tasks">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Log Task Hours</h1>
            <p className="text-muted-foreground text-sm">
              Record time spent on projects. For assigned tasks, go to <Link href="/tasks/assigned" className="text-blue-600 hover:underline">My Assigned Tasks</Link>.
            </p>
          </div>
        </div>
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

      {/* Detail Submission Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task Details for AI Analysis</DialogTitle>
            <DialogDescription>
              Provide detailed information about the work completed. This helps with AI-powered analysis and reporting.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDetailSubmit}>
            <div className="space-y-6 py-4">
              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Important: Be Detailed!</p>
                  <p className="text-sm text-red-700">
                    Provide as much detail as possible. Vague responses may result in rejection.
                  </p>
                </div>
              </div>

              {/* Work Summary */}
              <div className="space-y-2">
                <Label>
                  Brief Summary of Work Completed * 
                  <span className={`text-sm ml-2 ${wordCount >= MIN_WORD_COUNT ? 'text-green-600' : 'text-red-600'}`}>
                    ({wordCount} / {MIN_WORD_COUNT} words min)
                  </span>
                </Label>
                <Textarea
                  placeholder="Provide a detailed summary (minimum 40 words). Describe specific actions taken, tools used, and progress made..."
                  value={detailForm.work_summary}
                  onChange={(e) => handleWorkSummaryChange(e.target.value)}
                  rows={5}
                  required
                />
              </div>

              {/* Task Objective */}
              <div className="space-y-2">
                <Label>What was the main objective of this task? *</Label>
                <Textarea
                  placeholder="Describe the main goal or purpose..."
                  value={detailForm.task_objective}
                  onChange={(e) => setDetailForm({ ...detailForm, task_objective: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              {/* Final Outcome */}
              <div className="space-y-2">
                <Label>What was the final result or outcome? *</Label>
                <Textarea
                  placeholder="Describe the concrete results achieved..."
                  value={detailForm.final_outcome}
                  onChange={(e) => setDetailForm({ ...detailForm, final_outcome: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              {/* Scope Change */}
              <div className="space-y-2">
                <Label>Did the scope change during execution? *</Label>
                <select
                  value={detailForm.scope_change}
                  onChange={(e) => setDetailForm({ ...detailForm, scope_change: e.target.value as any })}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="No change">No change</option>
                  <option value="Minor change">Minor change</option>
                  <option value="Moderate change">Moderate change</option>
                  <option value="Major change">Major change</option>
                </select>
              </div>

              {/* Output Type */}
              <div className="space-y-2">
                <Label>What type of output was produced? *</Label>
                <select
                  value={detailForm.output_type}
                  onChange={(e) => setDetailForm({ ...detailForm, output_type: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="Document / Report">Document / Report</option>
                  <option value="Graphic / Design">Graphic / Design</option>
                  <option value="Website Update">Website Update</option>
                  <option value="Code / Script">Code / Script</option>
                  <option value="Data / Spreadsheet">Data / Spreadsheet</option>
                  <option value="Presentation">Presentation</option>
                  <option value="Communication (Email / Message)">Communication (Email / Message)</option>
                  <option value="Process / Policy Update">Process / Policy Update</option>
                  <option value="Research Findings">Research Findings</option>
                  <option value="Article Preparation">Article Preparation</option>
                  <option value="Course Preparation">Course Preparation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Output Description */}
              <div className="space-y-2">
                <Label>Describe the final output produced *</Label>
                <Textarea
                  placeholder="Provide details about the deliverable..."
                  value={detailForm.output_description}
                  onChange={(e) => setDetailForm({ ...detailForm, output_description: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              {/* Time Spent */}
              <div className="space-y-2">
                <Label>Total time spent on the task *</Label>
                <select
                  value={detailForm.time_spent}
                  onChange={(e) => setDetailForm({ ...detailForm, time_spent: e.target.value })}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="Less than 30 minutes">Less than 30 minutes</option>
                  <option value="30 minutes – 1 hour">30 minutes – 1 hour</option>
                  <option value="1–2 hours">1–2 hours</option>
                  <option value="2–4 hours">2–4 hours</option>
                  <option value="4–8 hours">4–8 hours</option>
                  <option value="1 day">1 day</option>
                </select>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-2">
                <Label>Estimated difficulty level *</Label>
                <select
                  value={detailForm.difficulty_level}
                  onChange={(e) => setDetailForm({ ...detailForm, difficulty_level: e.target.value as any })}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="Very Easy">Very Easy</option>
                  <option value="Easy">Easy</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Difficult">Difficult</option>
                  <option value="Very Difficult">Very Difficult</option>
                </select>
              </div>

              {/* Confidence Level */}
              <div className="space-y-2">
                <Label>How confident are you that the task meets required standard? *</Label>
                <select
                  value={detailForm.confidence_level}
                  onChange={(e) => setDetailForm({ ...detailForm, confidence_level: e.target.value as any })}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="Very confident">Very confident</option>
                  <option value="Confident">Confident</option>
                  <option value="Somewhat confident">Somewhat confident</option>
                  <option value="Not confident">Not confident</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowDetailDialog(false);
                // Reset basic form since task was already logged
                setFormData({
                  project_name: '',
                  custom_project: '',
                  task_description: '',
                  start_time: '',
                  end_time: '',
                  date: format(new Date(), 'yyyy-MM-dd'),
                });
              }}>
                Skip Details
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || wordCount < MIN_WORD_COUNT}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit for AI Analysis
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
