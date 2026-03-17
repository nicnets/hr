'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Brain,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Key,
  Cpu
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIConfig {
  id: number;
  api_key: string | null;
  model_name: string;
  is_enabled: boolean;
  test_status: string | null;
  test_message: string | null;
  updated_at: string;
}

const availableModels = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended - Cost Effective)' },
  { value: 'gpt-4o', label: 'GPT-4o (More Capable)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fastest)' },
];

export default function AISettingsPage() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState({
    api_key: '',
    model_name: 'gpt-4o-mini',
    is_enabled: false,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/ai-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setFormData({
          api_key: data.api_key || '',
          model_name: data.model_name || 'gpt-4o-mini',
          is_enabled: data.is_enabled || false,
        });
      } else {
        toast.error('Failed to fetch AI configuration');
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      toast.error('Failed to load AI configuration');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('AI configuration saved successfully');
        fetchConfig();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    if (!formData.api_key || formData.api_key.startsWith('••••••••')) {
      toast.error('Please enter a valid API key');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: formData.api_key,
          model_name: formData.model_name,
          test_connection: true,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      
      fetchConfig();
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  }

  function getStatusBadge() {
    if (!config) return null;
    
    if (config.test_status === 'success') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    } else if (config.test_status === 'failed') {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Connection Failed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        Not Tested
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Analysis Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure OpenAI integration for automatic task analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchConfig} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Configuration Status
              </CardTitle>
              <CardDescription>
                Current status of the AI analysis system
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className={`font-medium ${config?.is_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                {config?.is_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Model</p>
              <p className="font-medium">{config?.model_name || 'Not set'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">API Key</p>
              <p className="font-medium">
                {config?.api_key ? '••••••••' + config.api_key.slice(-4) : 'Not set'}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">
                {config?.updated_at 
                  ? new Date(config.updated_at).toLocaleDateString() 
                  : 'Never'}
              </p>
            </div>
          </div>
          
          {config?.test_message && (
            <Alert className={`mt-4 ${config.test_status === 'failed' ? 'border-red-500' : 'border-green-500'}`}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Last test result: {config.test_message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure your OpenAI API credentials and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api_key">OpenAI API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Your API key is stored securely and never exposed to clients.
              Leave unchanged to keep the existing key.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model_name">AI Model</Label>
            <Select
              value={formData.model_name}
              onValueChange={(value) => setFormData({ ...formData, model_name: value })}
            >
              <SelectTrigger id="model_name">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map(model => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              GPT-4o Mini is recommended for cost-effectiveness while maintaining good quality.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Enable AI Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Automatically analyze task submissions using AI
                </p>
              </div>
            </div>
            <Switch
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
            />
          </div>

          {/* Warning Note */}
          <Alert className="border-yellow-500">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm">
              <strong>Important:</strong> AI analysis runs daily at 11:00 PM IST. 
              To reduce token usage, only one task per employee is analyzed per day. 
              Ensure your API key has sufficient quota for your team size.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How AI Analysis Works</CardTitle>
          <CardDescription>
            Understanding the automated task evaluation process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <p className="font-medium">Employee Submits Task</p>
                <p className="text-sm text-muted-foreground">
                  Employee fills out the detailed task completion form with work summary, objectives, outputs, etc.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <p className="font-medium">Daily Analysis (11:00 PM IST)</p>
                <p className="text-sm text-muted-foreground">
                  The system processes one pending submission per employee to optimize API usage.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <p className="font-medium">AI Evaluation</p>
                <p className="text-sm text-muted-foreground">
                  The AI evaluates task understanding, work authenticity, output validity, effort reasonableness, and difficulty consistency.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">4</div>
              <div>
                <p className="font-medium">Decision & Notification</p>
                <p className="text-sm text-muted-foreground">
                  Score ≥ 80: Approved | Score 60-79: Needs Review | Score &lt; 60: Rejected. Email notification sent to employee.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
