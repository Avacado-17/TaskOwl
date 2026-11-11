import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Plus,
  Calendar,
  Clock,
  MoreVertical,
  Flame,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Search,
  Filter,
  Trash2,
  Edit2,
  GripVertical,
  PieChart as PieIcon,
  BarChart2,
  TrendingUp,
  CheckCircle2,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Task, LaneType, PriorityType, DashboardCustomization } from '../types';
import { sounds } from '../services/soundEffects';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './MainTableView';

interface KanbanBoardProps {
  tasks: Task[];
  customization?: DashboardCustomization;
  onUpdateTaskLane: (taskId: string, newLane: LaneType) => void;
  onEditTask: (task: Task) => void;
  onRequestDeleteTask: (task: Task) => void;
  onSyncTaskToCalendar: (task: Task) => Promise<void>;
  onOpenNewTaskModal: (defaultLane?: LaneType) => void;
  onUpdateCustomization?: (updates: Partial<DashboardCustomization>) => void;
  onReorderTasks?: (draggedTaskId: string, targetTaskId: string) => void;
}

const LANES: { id: LaneType; title: string; subtitle: string }[] = [
  { id: 'backlog', title: 'Not Started', subtitle: 'Planned Backlog Deliverables' },
  { id: 'in_progress', title: 'Working on it', subtitle: 'Active Engineering Sprint' },
  { id: 'review', title: 'In Review', subtitle: 'QA & Executive Review' },
  { id: 'done', title: 'Done', subtitle: 'Verified & Completed' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  customization,
  onUpdateTaskLane,
  onEditTask,
  onRequestDeleteTask,
  onSyncTaskToCalendar,
  onOpenNewTaskModal,
  onUpdateCustomization,
  onReorderTasks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityType>('all');
  const [onlyUnsynced, setOnlyUnsynced] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedLaneId, setDraggedLaneId] = useState<LaneType | null>(null);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

  const [pieMode, setPieMode] = useState<'resource' | 'status'>('resource');

  const isDark = customization?.themeMode === 'dark';
  const accentColor = customization?.accentColor || '#38bdf8';

  const laneOrder = customization?.kanbanLaneOrder || ['backlog', 'in_progress', 'review', 'done'];

  const orderedLanes = useMemo(() => {
    return laneOrder
      .map((id) => LANES.find((l) => l.id === id))
      .filter((l): l is { id: LaneType; title: string; subtitle: string } => Boolean(l));
  }, [laneOrder]);

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

  // Pie Chart Data 1: Deliverable Status Breakdown (Work Done)
  const statusPieData = useMemo(() => {
    if (tasks.length === 0) return [];
    const total = tasks.length || 1;

    const notStartedCount = tasks.filter((t) => t.lane === 'backlog').length;
    const workingCount = tasks.filter((t) => t.lane === 'in_progress').length;
    const reviewCount = tasks.filter((t) => t.lane === 'review').length;
    const doneCount = tasks.filter((t) => t.lane === 'done').length;
    const unassignedCount = tasks.filter(
      (t) => !t.assignee || !t.assignee.name || t.assignee.name === 'Unassigned'
    ).length;

    const items = [
      {
        name: 'Done',
        value: doneCount,
        color: '#00c875', // Vibrant Green for done
        percent: Math.round((doneCount / total) * 100),
      },
      {
        name: 'Working on it',
        value: workingCount,
        color: '#f97316', // Orange for working on it
        percent: Math.round((workingCount / total) * 100),
      },
      {
        name: 'In Review',
        value: reviewCount,
        color: '#a855f7', // Electric Purple for review
        percent: Math.round((reviewCount / total) * 100),
      },
      {
        name: 'Not Started',
        value: notStartedCount,
        color: '#9f1239', // Maroon for tasks not done
        percent: Math.round((notStartedCount / total) * 100),
      },
    ];

    if (unassignedCount > 0) {
      items.push({
        name: 'Not Assigned',
        value: unassignedCount,
        color: '#64748b', // Muted Grey for not assigned
        percent: Math.round((unassignedCount / total) * 100),
      });
    }

    return items;
  }, [tasks]);

  // Pie Chart Data 2: Resource Allocation OR Task Urgency Breakdown (if single person)
  const resourceAllocationData = useMemo(() => {
    if (tasks.length === 0) return [];
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
          value: urgentCount,
          taskCount: urgentCount,
          color: '#881337', // Deep Maroon for critical tasks
          percent: Math.round((urgentCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'urgent')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
        {
          name: 'High Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          value: highCount,
          taskCount: highCount,
          color: '#ef4444', // Red for high urgency
          percent: Math.round((highCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'high')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
        {
          name: 'Moderate Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          value: mediumCount,
          taskCount: mediumCount,
          color: '#f97316', // Orange for moderate urgency
          percent: Math.round((mediumCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'medium')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
        {
          name: 'Low Urgency',
          role: `Task urgency for ${singleAssigneeName}`,
          value: lowCount,
          taskCount: lowCount,
          color: '#eab308', // Amber for low urgency
          percent: Math.round((lowCount / total) * 100),
          totalHours: tasks
            .filter((t) => t.priority === 'low')
            .reduce((sum, t) => sum + (t.estimatedHours || 1), 0),
        },
      ];

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
      value: item.taskCount,
      color: palette[idx % palette.length],
      percent: Math.round((item.taskCount / total) * 100),
    }));
  }, [tasks, isSingleAssignee, singleAssigneeName]);

  const activePieData = pieMode === 'resource' ? resourceAllocationData : statusPieData;

  // Bar Graph Data: 14-Day Velocity & Ingestion
  const velocityBarData = useMemo(() => {
    const now = new Date();
    const points = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoKey = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      const liveCreated = tasks.filter((t) => t.createdAt && t.createdAt.startsWith(isoKey)).length;
      const liveDone = tasks.filter((t) => t.completedAt && t.completedAt.startsWith(isoKey)).length;

      points.push({
        date: displayDate,
        Completed: liveDone,
        Added: liveCreated,
      });
    }
    return points;
  }, [tasks]);

  // Compute key stats
  const totalTasksCount = tasks.length;
  const doneTasksCount = tasks.filter((t) => t.lane === 'done').length;
  const completionRatePercent =
    totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;
  const urgentTasksCount = tasks.filter((t) => t.priority === 'urgent' && t.lane !== 'done').length;
  const syncedCount = tasks.filter((t) => t.syncedToCalendar).length;

  const handleLaneDragStart = (e: React.DragEvent, laneId: LaneType) => {
    e.stopPropagation();
    setDraggedLaneId(laneId);
    e.dataTransfer.setData('text/lane-id', laneId);
  };

  const handleLaneDrop = (e: React.DragEvent, targetLaneId: LaneType) => {
    e.preventDefault();
    const sourceLaneId = (e.dataTransfer.getData('text/lane-id') as LaneType) || draggedLaneId;
    if (sourceLaneId && sourceLaneId !== targetLaneId && onUpdateCustomization) {
      const current = [...laneOrder];
      const sourceIdx = current.indexOf(sourceLaneId);
      const targetIdx = current.indexOf(targetLaneId);
      if (sourceIdx !== -1 && targetIdx !== -1) {
        const [removed] = current.splice(sourceIdx, 1);
        current.splice(targetIdx, 0, removed);
        onUpdateCustomization({ kanbanLaneOrder: current as LaneType[] });
      }
    }
    setDraggedLaneId(null);
  };

  const filteredTasks = tasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(q);
      const matchesDesc = task.description.toLowerCase().includes(q);
      const matchesTags = task.tags.some((t) => t.toLowerCase().includes(q));
      const matchesAssignee = task.assignee.name.toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc && !matchesTags && !matchesAssignee) return false;
    }
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false;
    }
    if (onlyUnsynced && task.syncedToCalendar) {
      return false;
    }
    return true;
  });

  const getLaneTasks = (laneId: LaneType) => {
    return filteredTasks.filter((t) => t.lane === laneId);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetLane: LaneType) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.lane !== targetLane) {
        onUpdateTaskLane(taskId, targetLane);
        if (targetLane === 'done') {
          sounds.playSuccessChime();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#00c875', '#38bdf8', '#ff5ac4', '#fdab3d'],
          });
        } else {
          sounds.playCalendarSyncChime();
        }
      }
    }
    setDraggedTaskId(null);
  };

  const moveLane = (task: Task, direction: 'next' | 'prev') => {
    const laneOrderArr: LaneType[] = ['backlog', 'in_progress', 'review', 'done'];
    const currentIndex = laneOrderArr.indexOf(task.lane);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < laneOrderArr.length) {
      const newLane = laneOrderArr[newIndex];
      onUpdateTaskLane(task.id, newLane);
      if (newLane === 'done') {
        sounds.playSuccessChime();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    }
  };

  const formatCountdown = (deadlineIso: string) => {
    const diffHours = (new Date(deadlineIso).getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHours < 0) {
      return { text: `Overdue (${Math.abs(Math.round(diffHours))}h)`, isOverdue: true };
    }
    if (diffHours < 1) {
      return { text: `Due in ${Math.max(1, Math.round(diffHours * 60))}m`, isUrgent: true };
    }
    if (diffHours < 24) {
      return { text: `Due in ${Math.round(diffHours)}h`, isUrgent: diffHours <= 4 };
    }
    return { text: `Due in ${Math.round(diffHours / 24)}d`, isUrgent: false };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sleek Header Command Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-xl card-sheen border border-[var(--border-subtle)] relative overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
            Sleek Kanban &amp; Performance Workspace
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onOpenNewTaskModal('backlog')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shadow-md transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New Deliverable
          </button>
        </div>
      </div>

      {/* KPI Stats Quick Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl card-sheen border border-[var(--border-subtle)]">
          <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase block">Completion Rate</span>
          <span className="text-2xl font-bold font-mono-num text-[var(--text-primary)] mt-1 block">
            {completionRatePercent}%
          </span>
        </div>

        <div className="p-4 rounded-xl card-sheen border border-[var(--border-subtle)]">
          <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase block">Total Open Tasks</span>
          <span className="text-2xl font-bold font-mono-num text-[var(--text-primary)] mt-1 block">
            {totalTasksCount - doneTasksCount}
          </span>
        </div>

        <div className="p-4 rounded-xl card-sheen border border-[var(--border-subtle)]">
          <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase block">Critical Deadlines</span>
          <span className="text-2xl font-bold font-mono-num text-[var(--text-primary)] mt-1 block">
            {urgentTasksCount}
          </span>
        </div>

        <div className="p-4 rounded-xl card-sheen border border-[var(--border-subtle)]">
          <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase block">Calendar Synced</span>
          <span className="text-2xl font-bold font-mono-num text-[var(--text-primary)] mt-1 block">
            {syncedCount} / {totalTasksCount}
          </span>
        </div>
      </div>

      {/* Visual Analytics Section: Pie Chart & Velocity Bar Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Pie Chart: Deliverable Status Breakdown / Resource Allocation (5 Spans) */}
        <div className="lg:col-span-5 p-5 rounded-xl card-sheen border border-[var(--border-subtle)] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-2">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[var(--accent-primary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                {pieMode === 'resource' ? 'Resource Allocation' : 'Status Breakdown'}
              </h2>
            </div>
            {/* Mode Switcher Buttons */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface-lowest)] p-1 rounded-lg border border-[var(--border-subtle)] text-[10px] font-mono">
              <button
                onClick={() => setPieMode('resource')}
                className={`px-2 py-0.5 rounded transition-all ${
                  pieMode === 'resource'
                    ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Resource
              </button>
              <button
                onClick={() => setPieMode('status')}
                className={`px-2 py-0.5 rounded transition-all ${
                  pieMode === 'status'
                    ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Status
              </button>
            </div>
          </div>

          <div className="relative w-full h-[200px] flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {activePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-xl text-xs font-mono backdrop-blur-md">
                          <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: data.color }}
                            />
                            {data.name}
                          </div>
                          {data.role && <div className="text-[10px] text-[var(--text-muted)]">{data.role}</div>}
                          <div className="mt-1 text-[var(--text-secondary)]">
                            {data.value} {pieMode === 'resource' ? 'tasks' : 'deliverables'} ({data.percent}%)
                            {data.totalHours !== undefined && ` · ${data.totalHours}h`}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold font-mono-num text-[var(--text-primary)]">
                {pieMode === 'resource' ? tasks.length : `${completionRatePercent}%`}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                {pieMode === 'resource' ? 'Tasks' : 'Shipped'}
              </span>
            </div>
          </div>

          {/* Pie Chart Legend Badges */}
          {tasks.length === 0 ? (
            <div className="py-3 text-center text-xs text-[var(--text-muted)] font-mono border-t border-[var(--border-subtle)]">
              No tasks created yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs font-mono max-h-[110px] overflow-y-auto">
              {activePieData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[var(--text-secondary)] truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-[var(--text-primary)] font-mono-num ml-1 shrink-0">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bar Graph: 14-Day Sprint Velocity & Ingestion (7 Spans) */}
        <div className="lg:col-span-7 p-5 rounded-xl card-sheen border border-[var(--border-subtle)] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[var(--accent-secondary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                Sprint Velocity &amp; Throughput
              </h2>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#38bdf8]" />
                Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#a855f7]" />
                Added
              </span>
            </div>
          </div>

          <div className="w-full h-[220px] my-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                  tick={{
                    fill: isDark ? '#71717a' : '#64748b',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                  interval={2}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: isDark ? '#71717a' : '#64748b',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl text-xs font-mono backdrop-blur-md">
                          <div className="font-bold text-[var(--text-primary)] pb-1 mb-1 border-b border-[var(--border-subtle)]">
                            {label}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-[#38bdf8]">
                              <span>Completed:</span>
                              <span className="font-bold">{payload[0]?.value}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[#c084fc]">
                              <span>Added to Backlog:</span>
                              <span className="font-bold">{payload[1]?.value}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="Completed" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="Added" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>

      {/* Filter and Search Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl card-sheen border border-[var(--border-subtle)]">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, tags, or assignees..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>

        {/* Priority Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-lowest)] rounded-lg border border-[var(--border-subtle)]">
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider rounded-md transition-all whitespace-nowrap ${
                  priorityFilter === p
                    ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-bold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Unsynced Only Toggle */}
          <button
            onClick={() => setOnlyUnsynced(!onlyUnsynced)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap ${
              onlyUnsynced
                ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--accent-primary)] shadow-sm'
                : 'bg-[var(--bg-surface-lowest)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Unsynced to Calendar
          </button>
        </div>
      </div>

      {/* 4 Agile Kanban Lanes (Draggable Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {orderedLanes.map((lane: { id: LaneType; title: string; subtitle: string }) => {
          const laneTasks = getLaneTasks(lane.id);
          const laneColor = STATUS_CONFIG[lane.id].bg;

          return (
            <div
              key={lane.id}
              onDragOver={handleDragOver}
              onDrop={(e) => {
                const laneIdData = e.dataTransfer.getData('text/lane-id');
                if (laneIdData) {
                  handleLaneDrop(e, lane.id);
                } else {
                  handleDrop(e, lane.id);
                }
              }}
              className="rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] flex flex-col min-h-[520px] transition-colors group/lane"
            >
              {/* Draggable Lane Header */}
              <div
                draggable
                onDragStart={(e) => handleLaneDragStart(e, lane.id)}
                className="p-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]/40 transition-colors"
                title="Drag column header to reorder Kanban columns"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-[var(--text-muted)] group-hover/lane:text-[var(--text-primary)] transition-colors shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: laneColor }}
                      />
                      <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                        {lane.title}
                      </h3>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        {laneTasks.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                      {lane.subtitle}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNewTaskModal(lane.id);
                  }}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors shrink-0"
                  title={`Add deliverable to ${lane.title}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Task Cards Container */}
              <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto max-h-[70vh]">
                {laneTasks.length === 0 ? (
                  <div className="h-32 rounded-lg border border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center text-center p-4">
                    <span className="text-xs text-[var(--text-muted)]">No tasks in this lane</span>
                    <button
                      onClick={() => onOpenNewTaskModal(lane.id)}
                      className="mt-1 text-[11px] text-[var(--accent-primary)] hover:underline"
                    >
                      + Create deliverable
                    </button>
                  </div>
                ) : (
                  laneTasks.map((task) => {
                    const countdown = formatCountdown(task.deadline);
                    const isMenuOpen = activeMenuTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation();
                          if (draggedTaskId && draggedTaskId !== task.id && onReorderTasks) {
                            onReorderTasks(draggedTaskId, task.id);
                          }
                          handleDrop(e, lane.id);
                        }}
                        className={`p-3.5 rounded-xl border card-sheen transition-all cursor-grab active:cursor-grabbing hover:border-[var(--border-strong)] relative group ${
                          task.priority === 'urgent' && lane.id !== 'done'
                            ? 'border-red-500/40 shadow-sm shadow-red-500/10'
                            : 'border-[var(--border-subtle)]'
                        }`}
                      >
                        {/* Card Header: Drag Grip, Priority & Quick Actions */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-grab" />
                            <span
                              className={`text-[10px] font-mono font-bold uppercase ${
                                task.priority === 'urgent'
                                  ? 'text-red-400'
                                  : task.priority === 'high'
                                  ? 'text-[var(--accent-primary)]'
                                  : task.priority === 'medium'
                                  ? 'text-amber-400'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {task.priority}
                            </span>
                            {task.escalated && lane.id !== 'done' && (
                              <span
                                className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-500/15 text-red-400 border border-red-500/25 flex items-center gap-0.5"
                                title="Auto-escalated by deadline engine"
                              >
                                <Flame className="w-2.5 h-2.5" />
                                ESCALATED
                              </span>
                            )}
                          </div>

                          {/* Menu Toggle */}
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuTaskId(isMenuOpen ? null : task.id)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-high)]"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {isMenuOpen && (
                              <div
                                onMouseLeave={() => setActiveMenuTaskId(null)}
                                className="absolute right-0 top-6 z-30 w-44 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-high)] shadow-xl p-1 text-xs"
                              >
                                <button
                                  onClick={() => {
                                    onEditTask(task);
                                    setActiveMenuTaskId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[var(--bg-surface-highest)] text-[var(--text-primary)] flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Edit Task
                                </button>
                                {!task.syncedToCalendar && (
                                  <button
                                    onClick={() => {
                                      onSyncTaskToCalendar(task);
                                      setActiveMenuTaskId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[var(--bg-surface-highest)] text-[var(--accent-primary)] flex items-center gap-2"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                    Sync to Calendar
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    onRequestDeleteTask(task);
                                    setActiveMenuTaskId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-red-500/20 text-red-400 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete Task
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h4
                          onClick={() => onEditTask(task)}
                          className="text-xs font-semibold text-[var(--text-primary)] font-heading hover:text-[var(--accent-primary)] cursor-pointer leading-snug line-clamp-2 transition-colors"
                        >
                          {task.title}
                        </h4>

                        {/* Description */}
                        {task.description && (
                          <p className="mt-1 text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Tags */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                          {task.tags.map((tag, idx) => (
                            <React.Fragment key={tag}>
                              <span className="font-mono">#{tag}</span>
                              {idx < task.tags.length - 1 && <span aria-hidden="true">·</span>}
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Card Footer: Assignee & Deadline */}
                        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                          {/* Assignee */}
                          <div
                            className="flex items-center gap-1.5"
                            title={`${task.assignee.name} (${task.assignee.role})`}
                          >
                            <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-high)] border border-[var(--border-subtle)] text-[10px] font-mono font-bold text-[var(--accent-primary)] flex items-center justify-center">
                              {task.assignee.initials || task.assignee.name.charAt(0)}
                            </div>
                            <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[80px]">
                              {task.assignee.name.split(' ')[0]}
                            </span>
                          </div>

                          {/* Deadline countdown & Calendar indicator */}
                          <div className="flex items-center gap-2">
                            {task.syncedToCalendar ? (
                              <span
                                className="text-[var(--accent-secondary)]"
                                title="Synchronized with Google Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <button
                                onClick={() => onSyncTaskToCalendar(task)}
                                className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                                title="Add to Google Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <span
                              className={`text-[10px] font-mono-num font-semibold ${
                                countdown.isOverdue
                                  ? 'text-red-400'
                                  : countdown.isUrgent
                                  ? 'text-[var(--accent-primary)]'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {countdown.text}
                            </span>
                          </div>
                        </div>

                        {/* Quick Lane Navigation Arrows */}
                        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          {lane.id !== 'backlog' ? (
                            <button
                              onClick={() => moveLane(task, 'prev')}
                              className="hover:text-[var(--text-primary)] flex items-center gap-0.5 transition-colors"
                              title="Move left"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              Prev
                            </button>
                          ) : (
                            <span />
                          )}

                          {lane.id !== 'done' ? (
                            <button
                              onClick={() => moveLane(task, 'next')}
                              className="hover:text-[var(--accent-primary)] flex items-center gap-0.5 transition-colors"
                              title="Advance lane"
                            >
                              Next
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[var(--accent-secondary)] flex items-center gap-1 text-[10px] font-mono">
                              <CheckCircle className="w-3 h-3" /> Shipped
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
