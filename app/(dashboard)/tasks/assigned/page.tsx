'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Loader2,
  Play,
  Send,
  Link as LinkIcon,
  FileText,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  Repeat
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TaskSubmission {
  id: number;
  work_summary: string;
  task_objective: string;
  final_outcome: string;
  scope_change: 'No change' | 'Minor change' | 'Moderate change' | 'Major change';
  output_type: string;
  output_description: string;
  time_spent: string;
  difficulty_level: 'Very Easy' | 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult';
  confidence_level: 'Very confident' | 'Confident' | 'Somewhat confident' | 'Not confident';
  submitted_at: string;
}

interface TaskAIAnalysis {
  score: number;
  task_understanding: number;
  work_authenticity: number;
  output_validity: number;
  effort_reasonableness: number;
  difficulty_consistency: number;
  decision: 'approved' | 'needs_review' | 'rejected';
  analysis_summary: string;
  risk_flags: string | null;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'assigned' | 'in_progress' | 'pending_review' | 'closed' | 'rejected';
  due_date: string | null;
  assigned_by_name: string;
  project_name: string | null;
  evidence_type: 'link' | 'attachment' | 'none';
  evidence_url: string | null;
  evidence_description: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  auto_approve: number;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'adhoc' | null;
  created_at: string;
  updated_at: string;
  submission?: TaskSubmission;
  ai_analysis?: TaskAIAnalysis;
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
  closed: 'Completed',
  rejected: 'Rejected',
};

export default function AssignedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
  
  const [submitForm, setSubmitForm] = useState({
    work_summary: '',
    task_objective: '',
    final_outcome: '',
    scope_change: 'No change' as 'No change' | 'Minor change' | 'Moderate change' | 'Major change',
    output_type: 'Document / Report' as string,
    output_description: '',
    time_spent: '1–2 hours' as string,
    difficulty_level: 'Moderate' as 'Very Easy' | 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult',
    confidence_level: 'Confident' as 'Very confident' | 'Confident' | 'Somewhat confident' | 'Not confident',
  });
  const [wordCount, setWordCount] = useState(0);
  const MIN_WORD_COUNT = 40;

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks/assigned');
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

  async function handleStartTask(taskId: number) {
    try {
      const response = await fetch('/api/tasks/assigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, action: 'start' }),
      });
      
      if (response.ok) {
        toast.success('Task started');
        fetchTasks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to start task');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  }

  async function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;
    
    if (wordCount < MIN_WORD_COUNT) {
      toast.error(`Work summary must be at least ${MIN_WORD_COUNT} words (currently ${wordCount})`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/task-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: selectedTask.id,
          work_summary: submitForm.work_summary,
          task_objective: submitForm.task_objective,
          final_outcome: submitForm.final_outcome,
          scope_change: submitForm.scope_change,
          output_type: submitForm.output_type,
          output_description: submitForm.output_description,
          time_spent: submitForm.time_spent,
          difficulty_level: submitForm.difficulty_level,
          confidence_level: submitForm.confidence_level,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Task submitted successfully for AI analysis');
        setShowSubmitDialog(false);
        setSelectedTask(null);
        resetSubmitForm();
        fetchTasks();
      } else {
        toast.error(data.error || 'Failed to submit task');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetSubmitForm() {
    setSubmitForm({
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
  }

  function handleWorkSummaryChange(value: string) {
    setSubmitForm({ ...submitForm, work_summary: value });
    setWordCount(value.trim().split(/\s+/).filter(w => w.length > 0).length);
  }

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'closed' || task.status === 'rejected') return false;
    return isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className={`hover:shadow-md transition-shadow ${isOverdue(task) ? 'border-red-300' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{task.title}</CardTitle>
              {task.recurrence_type && task.recurrence_type !== 'adhoc' && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  <Repeat className="h-3 w-3 mr-1" />
                  {task.recurrence_type}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Assigned by {task.assigned_by_name}
            </CardDescription>
          </div>
          <Badge className={statusColors[task.status]}>
            {statusLabels[task.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-slate-600 line-clamp-2">{task.description}</p>
        
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          {task.due_date && (
            <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-600' : 'text-muted-foreground'}`}>
              <Calendar className="h-4 w-4" />
              Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
              {isOverdue(task) && <span className="font-medium ml-1">(Overdue)</span>}
            </div>
          )}
          {task.auto_approve === 1 && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Auto-approve
            </div>
          )}
        </div>

        {task.status === 'pending_review' && (
          <div className="mt-3 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-800 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Submitted for review on {task.submitted_at && format(parseISO(task.submitted_at), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        {task.status === 'closed' && task.review_notes && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-medium">Review:</span> {task.review_notes}
            </p>
          </div>
        )}

        {task.status === 'rejected' && task.review_notes && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">
              <span className="font-medium">Rejection reason:</span> {task.review_notes}
            </p>
          </div>
        )}

        {/* AI Analysis Results */}
        {task.ai_analysis && (
          <div className={`mt-3 p-3 rounded-lg ${
            task.ai_analysis.decision === 'approved' ? 'bg-green-50 border border-green-200' :
            task.ai_analysis.decision === 'rejected' ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">AI Analysis Score</p>
              <Badge className={
                task.ai_analysis.score >= 80 ? 'bg-green-100 text-green-800' :
                task.ai_analysis.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }>
                {task.ai_analysis.score}/100
              </Badge>
            </div>
            <p className={`text-sm font-medium capitalize ${
              task.ai_analysis.decision === 'approved' ? 'text-green-700' :
              task.ai_analysis.decision === 'rejected' ? 'text-red-700' :
              'text-yellow-700'
            }`}>
              Decision: {task.ai_analysis.decision.replace('_', ' ')}
            </p>
            {task.ai_analysis.analysis_summary && (
              <p className="text-sm mt-1 text-muted-foreground">
                {task.ai_analysis.analysis_summary}
              </p>
            )}
            {task.ai_analysis.risk_flags && JSON.parse(task.ai_analysis.risk_flags).length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Risk flags:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {JSON.parse(task.ai_analysis.risk_flags).map((flag: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between pt-0">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => { setSelectedTask(task); setShowTaskDetailDialog(true); }}
        >
          View Details
        </Button>
        <div className="flex gap-2">
          {(task.status === 'assigned') && (
            <Button 
              size="sm"
              onClick={() => handleStartTask(task.id)}
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          )}
          {(task.status === 'in_progress' || task.status === 'assigned') && (
            <Button 
              size="sm"
              variant="outline"
              onClick={() => { setSelectedTask(task); setShowSubmitDialog(true); }}
            >
              <Send className="h-4 w-4 mr-1" />
              Submit
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );

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
            <h1 className="text-3xl font-bold">My Assigned Tasks</h1>
            <p className="text-muted-foreground mt-1">
              View and manage tasks assigned to you
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchTasks}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No tasks assigned to you yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tasks assigned by your admin will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active">
              Active ({getTasksByStatus('assigned').length + getTasksByStatus('in_progress').length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Review ({getTasksByStatus('pending_review').length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({getTasksByStatus('closed').length})
            </TabsTrigger>
            <TabsTrigger value="all">
              All Tasks ({tasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[...getTasksByStatus('assigned'), ...getTasksByStatus('in_progress')].map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
            {getTasksByStatus('assigned').length === 0 && getTasksByStatus('in_progress').length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active tasks
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {getTasksByStatus('pending_review').map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
            {getTasksByStatus('pending_review').length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tasks pending review
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {getTasksByStatus('closed').map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
            {getTasksByStatus('closed').length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No completed tasks yet
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Submit Task Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Task Completion</DialogTitle>
            <DialogDescription>
              Provide detailed information about the work completed. This will be analyzed by AI.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <form onSubmit={handleSubmitTask}>
              <div className="space-y-6 py-4">
                {/* Task Info */}
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="font-medium text-lg">{selectedTask.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
                  {selectedTask.project_name && (
                    <p className="text-sm text-blue-600 mt-2">Project: {selectedTask.project_name}</p>
                  )}
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Important: Be Detailed!</p>
                    <p className="text-sm text-red-700">
                      Provide as much detail as possible to avoid AI rejection. Include specific actions, tools used, challenges faced, and concrete outcomes.
                    </p>
                  </div>
                </div>

                {/* Work Summary - Min 40 words */}
                <div className="space-y-2">
                  <Label htmlFor="work_summary">
                    Brief Summary of Work Completed * 
                    <span className={`text-sm ml-2 ${wordCount >= MIN_WORD_COUNT ? 'text-green-600' : 'text-red-600'}`}>
                      ({wordCount} / {MIN_WORD_COUNT} words minimum)
                    </span>
                  </Label>
                  <Textarea
                    id="work_summary"
                    placeholder="Provide a detailed summary of the work you completed (minimum 40 words). Describe specific actions taken, tools used, and progress made..."
                    value={submitForm.work_summary}
                    onChange={(e) => handleWorkSummaryChange(e.target.value)}
                    rows={5}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about what you did. Avoid generic statements like &quot;completed the task successfully.&quot;
                  </p>
                </div>

                {/* Task Objective */}
                <div className="space-y-2">
                  <Label htmlFor="task_objective">What was the main objective of this task? *</Label>
                  <Textarea
                    id="task_objective"
                    placeholder="Describe the main goal or purpose of this task..."
                    value={submitForm.task_objective}
                    onChange={(e) => setSubmitForm({ ...submitForm, task_objective: e.target.value })}
                    rows={3}
                    required
                  />
                </div>

                {/* Final Outcome */}
                <div className="space-y-2">
                  <Label htmlFor="final_outcome">What was the final result or outcome of the task? *</Label>
                  <Textarea
                    id="final_outcome"
                    placeholder="Describe the concrete results achieved..."
                    value={submitForm.final_outcome}
                    onChange={(e) => setSubmitForm({ ...submitForm, final_outcome: e.target.value })}
                    rows={3}
                    required
                  />
                </div>

                {/* Scope Change */}
                <div className="space-y-2">
                  <Label>Did the scope of the task change during execution? *</Label>
                  <select
                    value={submitForm.scope_change}
                    onChange={(e) => setSubmitForm({ ...submitForm, scope_change: e.target.value as any })}
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
                    value={submitForm.output_type}
                    onChange={(e) => setSubmitForm({ ...submitForm, output_type: e.target.value })}
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
                  <Label htmlFor="output_description">Describe the final output produced *</Label>
                  <Textarea
                    id="output_description"
                    placeholder="Provide details about the deliverable, where it can be found, etc..."
                    value={submitForm.output_description}
                    onChange={(e) => setSubmitForm({ ...submitForm, output_description: e.target.value })}
                    rows={3}
                    required
                  />
                </div>

                {/* Time Spent */}
                <div className="space-y-2">
                  <Label>Total time spent on the task *</Label>
                  <select
                    value={submitForm.time_spent}
                    onChange={(e) => setSubmitForm({ ...submitForm, time_spent: e.target.value })}
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
                    value={submitForm.difficulty_level}
                    onChange={(e) => setSubmitForm({ ...submitForm, difficulty_level: e.target.value as any })}
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
                  <Label>How confident are you that the task meets the required standard? *</Label>
                  <select
                    value={submitForm.confidence_level}
                    onChange={(e) => setSubmitForm({ ...submitForm, confidence_level: e.target.value as any })}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="Very confident">Very confident</option>
                    <option value="Confident">Confident</option>
                    <option value="Somewhat confident">Somewhat confident</option>
                    <option value="Not confident">Not confident</option>
                  </select>
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Your submission will be analyzed by AI. You will receive an email notification with the results (approved, needs review, or rejected).
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowSubmitDialog(false)}>
                  Cancel
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
                    'Submit Task'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
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
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedTask.status]}>
                    {statusLabels[selectedTask.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned By</p>
                  <p className="font-medium">{selectedTask.assigned_by_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p>{selectedTask.due_date ? format(parseISO(selectedTask.due_date), 'MMM d, yyyy') : 'No due date'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned On</p>
                  <p>{format(parseISO(selectedTask.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
              {selectedTask.evidence_url && (
                <div>
                  <p className="text-sm text-muted-foreground">Evidence Submitted</p>
                  <a 
                    href={selectedTask.evidence_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {selectedTask.evidence_url}
                  </a>
                </div>
              )}
              {selectedTask.evidence_description && (
                <div>
                  <p className="text-sm text-muted-foreground">Work Description</p>
                  <p>{selectedTask.evidence_description}</p>
                </div>
              )}
              {selectedTask.submitted_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Submitted At</p>
                  <p>{format(parseISO(selectedTask.submitted_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
              {selectedTask.review_notes && (
                <div className={`p-3 rounded-lg ${selectedTask.status === 'rejected' ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className={`text-sm font-medium ${selectedTask.status === 'rejected' ? 'text-red-800' : 'text-green-800'}`}>
                    {selectedTask.status === 'rejected' ? 'Rejection Reason' : 'Review Notes'}
                  </p>
                  <p className={`text-sm mt-1 ${selectedTask.status === 'rejected' ? 'text-red-700' : 'text-green-700'}`}>
                    {selectedTask.review_notes}
                  </p>
                </div>
              )}

              {/* Submission Details */}
              {selectedTask.submission && (
                <div className="border-t pt-4 mt-4">
                  <p className="font-medium mb-3">Submission Details</p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Work Summary</p>
                      <p>{selectedTask.submission.work_summary}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground">Output Type</p>
                        <p>{selectedTask.submission.output_type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Time Spent</p>
                        <p>{selectedTask.submission.time_spent}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground">Difficulty</p>
                        <p>{selectedTask.submission.difficulty_level}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Confidence</p>
                        <p>{selectedTask.submission.confidence_level}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Analysis in Detail Dialog */}
              {selectedTask.ai_analysis && (
                <div className={`border-t pt-4 mt-4 p-4 rounded-lg ${
                  selectedTask.ai_analysis.decision === 'approved' ? 'bg-green-50' :
                  selectedTask.ai_analysis.decision === 'rejected' ? 'bg-red-50' :
                  'bg-yellow-50'
                }`}>
                  <p className="font-medium mb-3">AI Analysis</p>
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div className="bg-white p-2 rounded">
                      <p className="text-muted-foreground text-xs">Understanding</p>
                      <p className="font-medium">{selectedTask.ai_analysis.task_understanding}/25</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-muted-foreground text-xs">Authenticity</p>
                      <p className="font-medium">{selectedTask.ai_analysis.work_authenticity}/20</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-muted-foreground text-xs">Validity</p>
                      <p className="font-medium">{selectedTask.ai_analysis.output_validity}/25</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-muted-foreground text-xs">Effort</p>
                      <p className="font-medium">{selectedTask.ai_analysis.effort_reasonableness}/20</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-muted-foreground text-xs">Consistency</p>
                      <p className="font-medium">{selectedTask.ai_analysis.difficulty_consistency}/10</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
