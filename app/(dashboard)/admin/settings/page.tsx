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
  Trash2
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
                When the work day officially starts
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
                Time to automatically clock out users
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
      </div>
    </div>
  );
}
