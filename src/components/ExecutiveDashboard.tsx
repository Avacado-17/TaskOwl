import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Send,
  Sparkles,
  RefreshCw,
  Sliders,
  GripVertical,
  Users,
} from 'lucide-react';
import { Task, AutomationPreferences, AutomationLog, DashboardCustomization } from '../types';
import { TaskVelocityChart } from './TaskVelocityChart';

interface ExecutiveDashboardProps {
  tasks: Task[];
  preferences: AutomationPreferences;
  logs: AutomationLog[];
  customization: DashboardCustomization;
  isGoogleConnected: boolean;
  onSyncTaskToCalendar: (task: Task) => Promise<void>;
  onDispatchAllToCalendar: () => Promise<void>;
  onSendMorningDigestEmail: () => Promise<void>;
  onNavigateToKanban: () => void;
  onNavigateToAutomations: () => void;
  onNavigateToCalendar: () => void;
  onEditTask: (task: Task) => void;
  onOpenCustomizer: () => void;
  onUpdateCustomization?: (updates: Partial<DashboardCustomization>) => void;
}


export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  tasks,
  preferences,
  logs,
  customization,
  isGoogleConnected,
  onSyncTaskToCalendar,
  onDispatchAllToCalendar,
  onSendMorningDigestEmail,
  onNavigateToKanban,
  onNavigateToAutomations,
  onNavigateToCalendar,
  onEditTask,
  onOpenCustomizer,
  onUpdateCustomization,
}) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [draggedKpiKey, setDraggedKpiKey] = useState<string | null>(null);
  const [draggedWidgetKey, setDraggedWidgetKey] = useState<string | null>(null);

  const { visibleWidgets, density } = customization;

  const kpiOrder = customization.kpiOrder || ['kpiVelocity', 'kpiUrgent', 'kpiCalendar', 'kpiAutomations'];
  const widgetOrder = customization.widgetOrder || [
    'taskVelocityChart',
    'resourceAllocation',
    'upcomingTimeline',
    'workflowBreakdown',
    'morningDigest',
    'automationsHeartbeat',
  ];

  const handleKpiDragStart = (e: React.DragEvent, key: string) => {
    setDraggedKpiKey(key);
    e.dataTransfer.setData('text/kpi-key', key);
  };

  const handleKpiDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/kpi-key') || draggedKpiKey;
    if (sourceKey && sourceKey !== targetKey && onUpdateCustomization) {
      const current = [...kpiOrder];
      const sourceIdx = current.indexOf(sourceKey);
      const targetIdx = current.indexOf(targetKey);
      if (sourceIdx !== -1 && targetIdx !== -1) {
        const [removed] = current.splice(sourceIdx, 1);
        current.splice(targetIdx, 0, removed);
        onUpdateCustomization({ kpiOrder: current });
      }
    }
    setDraggedKpiKey(null);
  };

  const handleWidgetDragStart = (e: React.DragEvent, key: string) => {
    setDraggedWidgetKey(key);
    e.dataTransfer.setData('text/widget-key', key);
  };

  const handleWidgetDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/widget-key') || draggedWidgetKey;
    if (sourceKey && sourceKey !== targetKey && onUpdateCustomization) {
      const current = [...widgetOrder];
      const sourceIdx = current.indexOf(sourceKey);
      const targetIdx = current.indexOf(targetKey);
      if (sourceIdx !== -1 && targetIdx !== -1) {
        const [removed] = current.splice(sourceIdx, 1);
        current.splice(targetIdx, 0, removed);
        onUpdateCustomization({ widgetOrder: current });
      }
    }
    setDraggedWidgetKey(null);
  };

  // Computed metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.lane === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.lane === 'in_progress').length;
  const inReviewTasks = tasks.filter((t) => t.lane === 'review').length;
  const backlogTasks = tasks.filter((t) => t.lane === 'backlog').length;

  const urgentTasks = tasks.filter(
    (t) => t.priority === 'urgent' && t.lane !== 'done'
  );
  const syncedTasks = tasks.filter((t) => t.syncedToCalendar).length;
  const unsyncedUpcoming = tasks.filter(
    (t) => !t.syncedToCalendar && t.lane !== 'done'
  );

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.assignee && t.assignee.name) {
        set.add(t.assignee.name);
      }
    });
    return Array.from(set);
  }, [tasks]);

  const isSingleAssignee = uniqueAssignees.length <= 1;
  const singleAssigneeName = uniqueAssignees[0] || 'Assigned Owner';

  // Resource Allocation Data for Recharts Pie Chart (or Urgency Breakdown if single person)
  const resourceAllocationData = useMemo(() => {
    if (tasks.length === 0) {
      return [];
    }
    const total = tasks.length || 1;

    if (isSingleAssignee) {
      // Single person assigned all tasks -> Slice pie chart by urgency & priority
      const urgentCount = tasks.filter((t) => t.priority === 'urgent').length;
      const highCount = tasks.filter((t) => t.priority === 'high').length;
      const mediumCount = tasks.filter((t) => t.priority === 'medium').length;
      const lowCount = tasks.filter((t) => t.priority === 'low').length;

      const items = [
        {
          name: 'Critical Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          taskCount: urgentCount,
          color: '#881337', // Deep Maroon for critical
          percentage: Math.round((urgentCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'urgent')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
        {
          name: 'High Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          taskCount: highCount,
          color: '#ef4444', // Vivid Red for high urgency
          percentage: Math.round((highCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'high')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
        {
          name: 'Moderate Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          taskCount: mediumCount,
          color: '#f97316', // Orange for moderate urgency
          percentage: Math.round((mediumCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'medium')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
        {
          name: 'Low Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          taskCount: lowCount,
          color: '#eab308', // Amber for low urgency
          percentage: Math.round((lowCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'low')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
      ].filter((item) => item.taskCount > 0);

      return items;
    }

    // Multiple people assigned -> Slice pie by team member workload
    const map = new Map<
      string,
      { name: string; role: string; taskCount: number; totalHours: number }
    >();

    tasks.forEach((t) => {
      const name = t.assignee?.name || 'Unassigned';
      const role = t.assignee?.role || 'Team Member';
      const hours = t.estimatedHours || 1;

      if (!map.has(name)) {
        map.set(name, { name, role, taskCount: 0, totalHours: 0 });
      }
      const curr = map.get(name)!;
      curr.taskCount += 1;
      curr.totalHours += hours;
    });

    const palette = [
      '#38bdf8',
      '#10b981',
      '#a855f7',
      '#fdab3d',
      '#f43f5e',
      '#6366f1',
      '#14b8a6',
    ];

    return Array.from(map.values()).map((item, idx) => ({
      ...item,
      color: palette[idx % palette.length],
      percentage: Math.round((item.taskCount / total) * 100),
    }));
  }, [tasks, isSingleAssignee, singleAssigneeName]);

  // Sorted upcoming tasks by deadline
  const upcomingTasks = [...tasks]
    .filter((t) => t.lane !== 'done')
    .sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );

  const formatHoursRemaining = (deadlineIso: string) => {
    const diffHours =
      (new Date(deadlineIso).getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHours < 0) {
      const pastHours = Math.abs(Math.round(diffHours));
      return {
        label: `Overdue by ${pastHours}h`,
        isOverdue: true,
        isImminent: true,
      };
    }
    if (diffHours < 1) {
      const mins = Math.max(1, Math.round(diffHours * 60));
      return { label: `Due in ${mins}m`, isOverdue: false, isImminent: true };
    }
    if (diffHours < 24) {
      return {
        label: `Due in ${Math.round(diffHours)}h`,
        isOverdue: false,
        isImminent: diffHours <= 4,
      };
    }
    const days = Math.round(diffHours / 24);
    return { label: `Due in ${days}d`, isOverdue: false, isImminent: false };
  };

  const handleSendDigest = async () => {
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      await onSendMorningDigestEmail();
      setEmailStatus('Morning digest dispatched to your Gmail inbox.');
      setTimeout(() => setEmailStatus(null), 5000);
    } catch (err: any) {
      setEmailStatus(err?.message || 'Failed to send email digest');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const hasAnyKpi =
    visibleWidgets.kpiVelocity ||
    visibleWidgets.kpiUrgent ||
    visibleWidgets.kpiCalendar ||
    visibleWidgets.kpiAutomations;

  const renderKpiCard = (key: string) => {
    if (key === 'kpiVelocity' && visibleWidgets.kpiVelocity) {
      return (
        <div
          key="kpiVelocity"
          draggable
          onDragStart={(e) => handleKpiDragStart(e, 'kpiVelocity')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleKpiDrop(e, 'kpiVelocity')}
          className="p-4 sm:p-5 rounded-xl card-sheen border border-[var(--border-subtle)] relative cursor-grab active:cursor-grabbing hover:border-[var(--border-strong)] transition-all group"
          title="Drag card to reorder KPI layout"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
            <span className="flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 cursor-grab" />
              COMPLETION RATE
            </span>
            <TrendingUp className="w-4 h-4 text-[var(--accent-secondary)]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text-primary)] font-mono-num tracking-tight">
              {completionRate}%
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              ({completedTasks}/{totalTasks} tasks)
            </span>
          </div>
          <div className="mt-3.5 w-full bg-[var(--bg-surface-lowest)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)]">
            <div
              className="h-full bg-[var(--accent-primary)] transition-all duration-500 rounded-full"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      );
    }

    if (key === 'kpiUrgent' && visibleWidgets.kpiUrgent) {
      return (
        <div
          key="kpiUrgent"
          draggable
          onDragStart={(e) => handleKpiDragStart(e, 'kpiUrgent')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleKpiDrop(e, 'kpiUrgent')}
          className="p-4 sm:p-5 rounded-xl card-sheen border border-[var(--border-subtle)] relative cursor-grab active:cursor-grabbing hover:border-[var(--border-strong)] transition-all group"
          title="Drag card to reorder KPI layout"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
            <span className="flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 cursor-grab" />
              CRITICAL DEADLINES
            </span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text-primary)] font-mono-num tracking-tight">
              {urgentTasks.length}
            </span>
            <span className="text-xs text-red-500 font-mono">
              {urgentTasks.length > 0 ? 'Action required' : 'Nominal'}
            </span>
          </div>
          <div className="mt-3.5 text-[11px] text-[var(--text-secondary)] font-mono flex items-center justify-between">
            <span>Threshold: &lt;{preferences.autoEscalateHoursThreshold}h</span>
            <span className="text-[var(--accent-primary)] font-medium">Auto-escalate ON</span>
          </div>
        </div>
      );
    }

    if (key === 'kpiCalendar' && visibleWidgets.kpiCalendar) {
      return (
        <div
          key="kpiCalendar"
          draggable
          onDragStart={(e) => handleKpiDragStart(e, 'kpiCalendar')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleKpiDrop(e, 'kpiCalendar')}
          className="p-4 sm:p-5 rounded-xl card-sheen border border-[var(--border-subtle)] relative cursor-grab active:cursor-grabbing hover:border-[var(--border-strong)] transition-all group"
          title="Drag card to reorder KPI layout"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
            <span className="flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 cursor-grab" />
              CALENDAR SYNC
            </span>
            <Calendar className="w-4 h-4 text-[var(--accent-secondary)]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text-primary)] font-mono-num tracking-tight">
              {syncedTasks}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              / {totalTasks} scheduled
            </span>
          </div>
          <div className="mt-3.5 text-[11px] text-[var(--text-secondary)] font-mono flex items-center justify-between">
            <span>{isGoogleConnected ? 'Workspace Connected' : 'Demo Mode'}</span>
            <button
              onClick={onNavigateToCalendar}
              className="text-[var(--accent-primary)] hover:underline"
            >
              View Schedule →
            </button>
          </div>
        </div>
      );
    }

    if (key === 'kpiAutomations' && visibleWidgets.kpiAutomations) {
      return (
        <div
          key="kpiAutomations"
          draggable
          onDragStart={(e) => handleKpiDragStart(e, 'kpiAutomations')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleKpiDrop(e, 'kpiAutomations')}
          className="p-4 sm:p-5 rounded-xl card-sheen border border-[var(--border-subtle)] relative cursor-grab active:cursor-grabbing hover:border-[var(--border-strong)] transition-all group"
          title="Drag card to reorder KPI layout"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
            <span className="flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 cursor-grab" />
              AUTOMATION PULSE
            </span>
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-secondary)]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text-primary)] font-mono-num tracking-tight">
              {logs.length}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              events evaluated
            </span>
          </div>
          <div className="mt-3.5 text-[11px] text-[var(--text-secondary)] font-mono flex items-center justify-between">
            <span>Heartbeat: Active (30s)</span>
            <button
              onClick={onNavigateToAutomations}
              className="text-[var(--accent-primary)] hover:underline"
            >
              Configure →
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={density === 'compact' ? 'space-y-4' : 'space-y-5'}>
      {/* Clean KPI Stat Strip (Completion Rate & Calendar Sync) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl card-sheen border border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-[var(--text-muted)] uppercase">Completion Rate</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--text-primary)] font-mono-num">
                {completionRate}%
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                ({completedTasks}/{totalTasks} tasks)
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface-high)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-secondary)]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl card-sheen border border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-[var(--text-muted)] uppercase">Calendar Sync</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--text-primary)] font-mono-num">
                {syncedTasks}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                / {totalTasks} scheduled
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface-high)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)]">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Visual Dashboard Containers */}
      <div className="space-y-5">
        {/* Sprint Velocity Chart */}
        {visibleWidgets.taskVelocityChart && (
          <TaskVelocityChart tasks={tasks} customization={customization} />
        )}

        {/* Resource Allocation & Urgency Pie Chart */}
        {visibleWidgets.resourceAllocation && (
          <div className="p-5 rounded-xl card-sheen border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                  {isSingleAssignee ? `Urgency Breakdown (${singleAssigneeName})` : 'Resource Allocation'}
                </h2>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)] font-mono">
                No tasks to allocate yet. Create deliverables in the Table or Kanban to view resource breakdown.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center mt-3">
                {/* Pie Chart (5 Spans) */}
                <div className="md:col-span-5 relative h-[210px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={resourceAllocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        dataKey="taskCount"
                      >
                        {resourceAllocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl text-xs font-mono backdrop-blur-md">
                                <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                  {data.name}
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)]">{data.role}</div>
                                <div className="mt-1 text-[var(--text-secondary)]">
                                  {data.taskCount} tasks ({data.percentage}%) · {data.totalHours}h effort
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold font-mono-num text-[var(--text-primary)]">
                      {tasks.length}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      Total Tasks
                    </span>
                  </div>
                </div>

                {/* Legend List (7 Spans) */}
                <div className="md:col-span-7 space-y-2">
                  {resourceAllocationData.map((item) => (
                    <div
                      key={item.name}
                      className="p-2.5 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-[var(--text-primary)] truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <span className="font-bold text-[var(--text-primary)] font-mono-num">
                          {item.taskCount} tasks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Impending Deliverables Table */}
        {visibleWidgets.upcomingTimeline && (
          <div className="p-5 rounded-xl card-sheen border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                Impending Deliverables
              </h2>
              <button
                onClick={onNavigateToKanban}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1"
              >
                View in Kanban →
              </button>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] mt-2">
              {upcomingTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)] font-mono">
                  No impending deliverables scheduled. All tasks are up to date.
                </div>
              ) : (
                upcomingTasks.slice(0, 5).map((task) => {
                  const countdown = formatHoursRemaining(task.deadline);
                  return (
                    <div
                      key={task.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/item hover:bg-[var(--bg-surface-high)]/60 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3
                          onClick={() => onEditTask(task)}
                          className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] cursor-pointer truncate"
                        >
                          {task.title}
                        </h3>
                        <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] font-mono">
                          {task.assignee.name} · Due {new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            countdown.isOverdue
                              ? 'text-red-400'
                              : countdown.isImminent
                              ? 'text-[var(--accent-primary)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {countdown.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
