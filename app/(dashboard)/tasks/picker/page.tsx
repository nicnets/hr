'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Hand,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  Briefcase,
  Zap,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TaskPickerItem {
  id: number;
  title: string;
  description: string;
  project_name: string | null;
  estimated_hours: number | null;
  difficulty_level: string | null;
  required_skills: string | null;
  is_active: boolean;
}

interface MyPickedTask extends TaskPickerItem {
  picked_at: string;
  completed_at: string | null;
}

const difficultyColors: Record<string, string> = {
  'Very Easy': 'bg-green-100 text-green-800',
  'Easy': 'bg-blue-100 text-blue-800',
  'Moderate': 'bg-yellow-100 text-yellow-800',
  'Difficult': 'bg-orange-100 text-orange-800',
  'Very Difficult': 'bg-red-100 text-red-800',
};

export default function TaskPickerPage() {
  const [availableTasks, setAvailableTasks] = useState<TaskPickerItem[]>([]);
  const [myTasks, setMyTasks] = useState<MyPickedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPicking, setIsPicking] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPickerItem | null>(null);
  const [showPickDialog, setShowPickDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/task-picker');
      if (response.ok) {
        const data = await response.json();
        setAvailableTasks(data.available);
        setMyTasks(data.myTasks);
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

  function openPickDialog(task: TaskPickerItem) {
    setSelectedTask(task);
    setShowPickDialog(true);
  }

  async function handlePickTask() {
    if (!selectedTask) return;

    setIsPicking(true);
    try {
      const response = await fetch('/api/task-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: selectedTask.id }),
      });

      if (response.ok) {
        toast.success('Task picked successfully!');
        setShowPickDialog(false);
        setSelectedTask(null);
        fetchTasks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to pick task');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsPicking(false);
    }
  }

  function openCompleteDialog(taskId: number) {
    setCompletingTaskId(taskId);
    setCompletionNotes('');
    setShowCompleteDialog(true);
  }

  async function handleCompleteTask() {
    if (!completingTaskId) return;

    try {
      const response = await fetch('/api/task-picker', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task_id: completingTaskId,
          notes: completionNotes 
        }),
      });

      if (response.ok) {
        toast.success('Task marked as completed!');
        setShowCompleteDialog(false);
        setCompletingTaskId(null);
        fetchTasks();
      } else {
        toast.error('Failed to complete task');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Picker</h1>
          <p className="text-muted-foreground mt-1">
            Pick additional tasks when you have free time
          </p>
        </div>
        <Button variant="outline" onClick={fetchTasks} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Warning Note */}
      <Alert className="border-red-500 bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong className="text-red-700">Important:</strong> When submitting task details, 
          please be as detailed and specific as possible. Vague or generic responses may result 
          in AI rejection. Include specific actions taken, tools used, challenges faced, and 
          concrete outcomes achieved.
        </AlertDescription>
      </Alert>

      {/* My Picked Tasks */}
      {myTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              My Picked Tasks
            </CardTitle>
            <CardDescription>
              Tasks you have picked from the pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTasks.map(task => (
                <Card key={task.id} className={task.completed_at ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      {task.completed_at ? (
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                      ) : (
                        <Badge variant="secondary">In Progress</Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {task.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-2 text-sm">
                      {task.project_name && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{task.project_name}</span>
                        </div>
                      )}
                      {task.estimated_hours && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>~{task.estimated_hours} hours</span>
                        </div>
                      )}
                      {task.difficulty_level && (
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <Badge className={difficultyColors[task.difficulty_level] || 'bg-gray-100'}>
                            {task.difficulty_level}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  {!task.completed_at && (
                    <CardFooter>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => openCompleteDialog(task.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hand className="h-5 w-5 text-blue-600" />
            Available Tasks
          </CardTitle>
          <CardDescription>
            {availableTasks.length} task{availableTasks.length !== 1 ? 's' : ''} available to pick
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : availableTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks available at the moment</p>
              <p className="text-sm">Check back later for new opportunities</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableTasks.map(task => (
                <Card key={task.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {task.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3 flex-1">
                    <div className="space-y-2 text-sm">
                      {task.project_name && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{task.project_name}</span>
                        </div>
                      )}
                      {task.estimated_hours && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>~{task.estimated_hours} hours estimated</span>
                        </div>
                      )}
                      {task.difficulty_level && (
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <Badge className={difficultyColors[task.difficulty_level] || 'bg-gray-100'}>
                            {task.difficulty_level}
                          </Badge>
                        </div>
                      )}
                      {task.required_skills && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {JSON.parse(task.required_skills).map((skill: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full"
                      onClick={() => openPickDialog(task)}
                    >
                      <Hand className="h-4 w-4 mr-2" />
                      Pick Task
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pick Task Dialog */}
      <Dialog open={showPickDialog} onOpenChange={setShowPickDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick This Task?</DialogTitle>
            <DialogDescription>
              You are about to pick the following task. Make sure you have time to complete it.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="py-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="font-medium">{selectedTask.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask.description}
                </p>
                {selectedTask.estimated_hours && (
                  <p className="text-sm mt-2">
                    <strong>Estimated time:</strong> {selectedTask.estimated_hours} hours
                  </p>
                )}
              </div>
              <Alert className="mt-4 border-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Once picked, this task will be assigned to you and visible in your tasks list.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPickDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePickTask} disabled={isPicking}>
              {isPicking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Picking...
                </>
              ) : (
                <>
                  <Hand className="h-4 w-4 mr-2" />
                  Confirm Pick
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Task Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              Add any completion notes (optional)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Describe what was accomplished..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteTask}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
