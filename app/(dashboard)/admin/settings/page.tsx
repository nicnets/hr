'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Settings, 
  Loader2, 
  Clock,
  Calendar,
  Save,
  Upload,
  Image as ImageIcon,
  Trash2,
  Mail,
  Bell,
  Shield,
  Key,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';


interface SystemConfig {
  shift_start_time: string;
  grace_period_minutes: number;
  auto_clockout_time: string;
  min_work_hours: number;
  half_day_threshold: number;
  working_days: string;
  company_name: string;
  logo_url?: string;
  // Email settings
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_secure?: boolean;
  smtp_auth_method?: 'app_password' | 'oauth_google' | 'oauth_microsoft';
  smtp_oauth_client_id?: string;
  smtp_oauth_client_secret?: string;
  smtp_oauth_refresh_token?: string;
  email_notifications_enabled?: boolean;
}

// Email Settings Card Component
function EmailSettingsCard({ 
  config, 
  setConfig 
}: { 
  config: SystemConfig; 
  setConfig: (config: SystemConfig) => void;
}) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  const authMethods = [
    { value: 'app_password', label: 'SMTP Password', icon: Key, description: 'Use your SMTP2GO username and password' },
  ];

  const presetProviders = [
    { name: 'SMTP2GO', host: 'mail.smtp2go.com', port: 2525, secure: false, authMethod: 'app_password' },
  ];

  async function testConnection() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/admin/settings?action=test-email');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  }

  const applyPreset = (preset: typeof presetProviders[0]) => {
    setConfig({
      ...config,
      smtp_host: preset.host,
      smtp_port: preset.port,
      smtp_secure: preset.secure,
      smtp_auth_method: preset.authMethod as any,
    });
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notification Settings
        </CardTitle>
        <CardDescription>
          Configure email delivery for notifications using App Password or OAuth
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Send notifications for task assignments, AI analysis results, and attendance alerts
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.email_notifications_enabled}
            onChange={(e) => setConfig({ ...config, email_notifications_enabled: e.target.checked })}
            className="h-5 w-5 rounded border-gray-300"
          />
        </div>

        {config.email_notifications_enabled && (
          <>
            {/* Quick Presets */}
            <div className="space-y-2">
              <Label>Quick Setup Presets</Label>
              <div className="flex flex-wrap gap-2">
                {presetProviders.map((preset) => (
                  <Button
                    key={preset.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Auth Method Selection */}
            <div className="space-y-3">
              <Label>Authentication Method</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {authMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setConfig({ ...config, smtp_auth_method: method.value as any })}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        config.smtp_auth_method === method.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{method.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SMTP Settings */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  placeholder="smtp.gmail.com"
                  value={config.smtp_host || ''}
                  onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  placeholder="587"
                  value={config.smtp_port || ''}
                  onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">Email Address / Username</Label>
                <Input
                  id="smtp_user"
                  placeholder="email@example.com"
                  value={config.smtp_user || ''}
                  onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_from">From Display Name</Label>
                <Input
                  id="smtp_from"
                  placeholder="HR Portal"
                  value={config.smtp_from || ''}
                  onChange={(e) => setConfig({ ...config, smtp_from: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Sender name displayed in emails
                </p>
              </div>
            </div>

            {/* App Password Section */}
            {config.smtp_auth_method === 'app_password' && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <Label className="font-medium">App Password</Label>
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Enter app password"
                    value={config.smtp_pass || ''}
                    onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                  />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Use your SMTP2GO username and password from <a href="https://app.smtp2go.com/settings/smtp-users/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">SMTP Users <ExternalLink className="h-3 w-3" /></a></p>
                  </div>
                </div>
              </div>
            )}

            {/* OAuth Section */}
            {(config.smtp_auth_method === 'oauth_google' || config.smtp_auth_method === 'oauth_microsoft') && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <Label className="font-medium">OAuth 2.0 Credentials</Label>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input
                      placeholder="OAuth Client ID"
                      value={config.smtp_oauth_client_id || ''}
                      onChange={(e) => setConfig({ ...config, smtp_oauth_client_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input
                      type="password"
                      placeholder="OAuth Client Secret"
                      value={config.smtp_oauth_client_secret || ''}
                      onChange={(e) => setConfig({ ...config, smtp_oauth_client_secret: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Refresh Token</Label>
                    <Input
                      type="password"
                      placeholder="OAuth Refresh Token"
                      value={config.smtp_oauth_refresh_token || ''}
                      onChange={(e) => setConfig({ ...config, smtp_oauth_refresh_token: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      {config.smtp_auth_method === 'oauth_google' ? (
                        <>Get credentials from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></>
                      ) : (
                        <>Get credentials from <a href="https://portal.azure.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Azure Portal <ExternalLink className="h-3 w-3" /></a></>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Test Connection */}
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              {testResult && (
                <div className={`flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium">Notification Types</p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1">
            <li>• Task assignment notifications</li>
            <li>• AI analysis results (approved/rejected/needs review)</li>
            <li>• Attendance violation warnings</li>
            <li>• Leave request status updates</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        setConfig(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <div>Failed to load settings</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Settings</h1>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Logo Upload Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Company Logo
          </CardTitle>
          <CardDescription>
            Upload your company logo to display on the login page and sidebar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            {/* Current Logo Preview */}
            <div className="flex-shrink-0">
              <Label className="mb-2 block">Current Logo</Label>
              <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50">
                {config?.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={config.logo_url} 
                    alt="Company Logo"
                    className="object-contain max-w-full max-h-full p-2"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                    <span className="text-xs">No logo</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Upload Controls */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo">Upload New Logo</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Supported formats: PNG, JPEG, SVG, WebP. Max size: 2MB
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    if (!selectedFile) {
                      toast.error('Please select a file first');
                      return;
                    }
                    
                    setIsUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append('logo', selectedFile);
                      
                      const response = await fetch('/api/admin/logo', {
                        method: 'POST',
                        body: formData,
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok) {
                        toast.success('Logo uploaded successfully');
                        setConfig(prev => prev ? { ...prev, logo_url: result.logoUrl } : null);
                        setSelectedFile(null);
                      } else {
                        toast.error(result.error || 'Failed to upload logo');
                      }
                    } catch {
                      toast.error('An error occurred while uploading');
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload Logo
                </Button>
                
                {config?.logo_url && (
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      if (!confirm('Are you sure you want to remove the logo?')) return;
                      
                      try {
                        const response = await fetch('/api/admin/logo', {
                          method: 'DELETE',
                        });
                        
                        if (response.ok) {
                          toast.success('Logo removed successfully');
                          setConfig(prev => prev ? { ...prev, logo_url: undefined } : null);
                        } else {
                          toast.error('Failed to remove logo');
                        }
                      } catch {
                        toast.error('An error occurred');
                      }
                    }}
                    disabled={isUploading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Attendance Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attendance Rules
            </CardTitle>
            <CardDescription>
              Configure shift timing and grace periods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shift_start">Shift Start Time</Label>
              <Input
                id="shift_start"
                type="time"
                value={config.shift_start_time}
                onChange={(e) => setConfig({ ...config, shift_start_time: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Shift hours are 9:00 AM - 10:00 PM. Employees can clock in anytime during this window.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grace_period">Grace Period (minutes)</Label>
              <Input
                id="grace_period"
                type="number"
                min={0}
                max={60}
                value={config.grace_period_minutes}
                onChange={(e) => setConfig({ ...config, grace_period_minutes: parseInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Minutes after shift start before marking as late
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto_clockout">Auto Clock-Out Time</Label>
              <Input
                id="auto_clockout"
                type="time"
                value={config.auto_clockout_time}
                onChange={(e) => setConfig({ ...config, auto_clockout_time: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Time to automatically clock out users who haven't clocked out (default: 22:00)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Work Hour Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Work Hour Requirements
            </CardTitle>
            <CardDescription>
              Configure minimum hours and deductions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="min_work_hours">Minimum Work Hours</Label>
              <Input
                id="min_work_hours"
                type="number"
                step={0.5}
                min={1}
                max={12}
                value={config.min_work_hours}
                onChange={(e) => setConfig({ ...config, min_work_hours: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Hours required for a full day (default: 8)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="half_day_threshold">Half Day Threshold</Label>
              <Input
                id="half_day_threshold"
                type="number"
                step={0.5}
                min={1}
                max={8}
                value={config.half_day_threshold}
                onChange={(e) => setConfig({ ...config, half_day_threshold: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Hours below this = 1 leave deducted (default: 4)
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">Deduction Rules</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Less than {config.half_day_threshold} hours = 1 day deducted</li>
                <li>• {config.half_day_threshold} - {config.min_work_hours} hours = 0.5 day deducted</li>
                <li>• {config.min_work_hours}+ hours = No deduction</li>
              </ul>
              <p className="text-sm text-blue-600 mt-3">
                <strong>Note:</strong> Employees can clock in/out multiple times per day for breaks. Total hours across all sessions count toward minimum requirement.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Company Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Company Settings
            </CardTitle>
            <CardDescription>
              General company information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={config.company_name}
                onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <EmailSettingsCard config={config} setConfig={setConfig} />
      </div>
    </div>
  );
}
