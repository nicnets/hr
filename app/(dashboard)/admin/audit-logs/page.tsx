'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  History, 
  Search,
  User,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  created_at: string;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-purple-100 text-purple-800',
  reject: 'bg-orange-100 text-orange-800',
  activate: 'bg-green-100 text-green-800',
  deactivate: 'bg-red-100 text-red-800',
  reset_password: 'bg-yellow-100 text-yellow-800',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  async function fetchLogs() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/audit-logs?page=${page}&limit=${pageSize}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setHasMore(data.logs.length === pageSize);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => 
    log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function formatValues(values: string | null) {
    if (!values) return null;
    try {
      const parsed = JSON.parse(values);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch {
      return values;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all system activities and changes
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Recent system activities and changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 border rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={actionColors[log.action] || 'bg-slate-100'}>
                            {log.action.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {log.entity_type}
                          </span>
                          {log.entity_id && (
                            <span className="text-sm text-muted-foreground">
                              #{log.entity_id}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{log.user_name || 'System'}</span>
                          <span className="text-muted-foreground">•</span>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{format(parseISO(log.created_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>

                        {(log.old_values || log.new_values) && (
                          <div className="mt-3 space-y-2 text-sm">
                            {log.old_values && (
                              <div className="bg-red-50 border border-red-100 rounded p-2">
                                <span className="text-red-700 font-medium">Old: </span>
                                <span className="text-red-600">{formatValues(log.old_values)}</span>
                              </div>
                            )}
                            {log.new_values && (
                              <div className="bg-green-50 border border-green-100 rounded p-2">
                                <span className="text-green-700 font-medium">New: </span>
                                <span className="text-green-600">{formatValues(log.new_values)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {log.ip_address && (
                          <p className="text-xs text-muted-foreground mt-2">
                            IP: {log.ip_address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
