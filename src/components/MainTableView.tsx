import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  EyeOff,
  Layers,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  ExternalLink,
  Sparkles,
  Zap,
  Share2,
  Users,
  Sliders,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task, LaneType, PriorityType, DashboardCustomization } from '../types';

interface MainTableViewProps {
  tasks: Task[];
  customization: DashboardCustomization;
  isGoogleConnected: boolean;
  onUpdateTaskLane: (taskId: string, newLane: LaneType) => void;
  onUpdateTaskPriority?: (taskId: string, newPriority: PriorityType) => void;
  onSyncTaskToCalendar: (task: Task) => Promise<void>;
  onEditTask: (task: Task) => void;
  onRequestDeleteTask: (task: Task) => void;
  onAddNewTaskInline: (title: string, lane: LaneType, priority: PriorityType, dueDate?: string) => void;
  onOpenNewTaskModal: (defaultLane?: LaneType) => void;
  onNavigateToAutomations: () => void;
  onNavigateToCalendar: () => void;
  onUpdateCustomization?: (updates: Partial<DashboardCustomization>) => void;
  onReorderTasks?: (draggedTaskId: string, targetTaskId: string) => void;
}


// Status definitions matching Monday.com color scheme from user screenshot
export const STATUS_CONFIG: Record<
  LaneType,
  { label: string; bg: string; text: string; hover: string }
> = {
  backlog: {
    label: 'Not Started',
    bg: '#579bfc',
    text: '#ffffff',
    hover: '#4285f4',
  },
  in_progress: {
    label: 'Working on it',
    bg: '#fdab3d',
    text: '#ffffff',
    hover: '#f59e0b',
  },
  review: {
    label: 'In Review',
    bg: '#a855f7',
    text: '#ffffff',
    hover: '#9333ea',
  },
  done: {
    label: 'Done',
    bg: '#00c875',
    text: '#ffffff',
    hover: '#059669',
  },
};

// Priority definitions matching Monday.com color scheme from user screenshot
export const PRIORITY_CONFIG: Record<
  PriorityType,
  { label: string; bg: string; text: string }
> = {
  urgent: {
    label: 'Critical',
    bg: '#e2445c',
    text: '#ffffff',
  },
  high: {
    label: 'High',
    bg: '#ff5ac4', // Vibrant hot pink matching screenshot
    text: '#ffffff',
  },
  medium: {
    label: 'Medium',
    bg: '#ff7538', // Warm coral orange matching screenshot
    text: '#ffffff',
  },
  low: {
    label: 'Low',
    bg: '#eab308', // Gold yellow matching screenshot
    text: '#000000',
  },
};

export const MainTableView: React.FC<MainTableViewProps> = ({
  tasks,
  customization,
  isGoogleConnected,
  onUpdateTaskLane,
  onUpdateTaskPriority,
  onSyncTaskToCalendar,
  onEditTask,
  onRequestDeleteTask,
  onAddNewTaskInline,
  onOpenNewTaskModal,
  onNavigateToAutomations,
  onNavigateToCalendar,
  onUpdateCustomization,
  onReorderTasks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'title'>('deadline');
  const [isGroupOpen, setIsGroupOpen] = useState(true);
  const [isDoneGroupOpen, setIsDoneGroupOpen] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Drag and drop state for columns and rows
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [draggedRowTaskId, setDraggedRowTaskId] = useState<string | null>(null);

  const tableColumnOrder = customization.tableColumnOrder || [
    'task',
    'owner',
    'status',
    'deadline',
    'priority',
    'calendar',
    'actions',
  ];

  const handleColDragStart = (e: React.DragEvent, colKey: string) => {
    setDraggedColKey(colKey);
    e.dataTransfer.setData('text/col-key', colKey);
  };

  const handleColDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/col-key') || draggedColKey;
    if (sourceKey && sourceKey !== targetColKey && onUpdateCustomization) {
      const current = [...tableColumnOrder];
      const sourceIdx = current.indexOf(sourceKey);
      const targetIdx = current.indexOf(targetColKey);
      if (sourceIdx !== -1 && targetIdx !== -1) {
        const [removed] = current.splice(sourceIdx, 1);
        current.splice(targetIdx, 0, removed);
        onUpdateCustomization({ tableColumnOrder: current });
      }
    }
    setDraggedColKey(null);
  };

  const handleRowDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedRowTaskId(taskId);
    e.dataTransfer.setData('text/task-id', taskId);
  };

  const handleRowDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const sourceTaskId = e.dataTransfer.getData('text/task-id') || draggedRowTaskId;
    if (sourceTaskId && sourceTaskId !== targetTaskId && onReorderTasks) {
      onReorderTasks(sourceTaskId, targetTaskId);
    }
    setDraggedRowTaskId(null);
  };

  // Inline task creation state
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [activeStatusMenuTaskId, setActiveStatusMenuTaskId] = useState<string | null>(null);
  const [activePriorityMenuTaskId, setActivePriorityMenuTaskId] = useState<string | null>(null);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchDesc = task.description.toLowerCase().includes(query);
        const matchAssignee = task.assignee.name.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchAssignee) return false;
      }
      if (selectedPerson !== 'all' && task.assignee.name !== selectedPerson) {
        return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      if (statusFilter !== 'all' && task.lane !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, selectedPerson, priorityFilter, statusFilter]);

  // Split into active (To-Do / In Progress / Review) and Done
  const activeTasks = useMemo(() => {
    const list = filteredTasks.filter((t) => t.lane !== 'done');
    return sortTaskList(list, sortBy);
  }, [filteredTasks, sortBy]);

  const doneTasks = useMemo(() => {
    const list = filteredTasks.filter((t) => t.lane === 'done');
    return sortTaskList(list, sortBy);
  }, [filteredTasks, sortBy]);

  function sortTaskList(list: Task[], sortKey: 'deadline' | 'priority' | 'title') {
    return [...list].sort((a, b) => {
      if (sortKey === 'deadline') {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortKey === 'priority') {
        const order: Record<PriorityType, number> = {
          urgent: 4,
          high: 3,
          medium: 2,
          low: 1,
        };
        return order[b.priority] - order[a.priority];
      }
      return a.title.localeCompare(b.title);
    });
  }

  const allAssignees = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((t) => names.add(t.assignee.name));
    return Array.from(names);
  }, [tasks]);

  const handleToggleSelectAll = (isDoneGroup: boolean) => {
    const targetGroup = isDoneGroup ? doneTasks : activeTasks;
    const allSelected = targetGroup.every((t) => selectedTaskIds.has(t.id));

    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        targetGroup.forEach((t) => next.delete(t.id));
      } else {
        targetGroup.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleStatusChange = (task: Task, nextLane: LaneType) => {
    onUpdateTaskLane(task.id, nextLane);
    setActiveStatusMenuTaskId(null);

    // If marked Done, celebrate with confetti
    if (nextLane === 'done') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00c875', '#38bdf8', '#ff5ac4', '#fdab3d'],
      });
    }
  };

  const handlePriorityChange = (taskId: string, nextPriority: PriorityType) => {
    if (onUpdateTaskPriority) {
      onUpdateTaskPriority(taskId, nextPriority);
    }
    setActivePriorityMenuTaskId(null);
  };

  const handleInlineAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTaskTitle.trim()) return;

    onAddNewTaskInline(inlineTaskTitle.trim(), 'backlog', 'medium');
    setInlineTaskTitle('');
  };

  const formatDueDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const isThisYear = date.getFullYear() === now.getFullYear();
    const month = date.toLocaleDateString([], { month: 'short' });
    const day = date.getDate();

    if (!isThisYear) {
      return `${month} ${day}, ${date.getFullYear()}`;
    }
    return `${month} ${day}`;
  };

  const renderTableHeaderCell = (colKey: string) => {
    if (colKey === 'task') {
      return (
        <th
          key="task"
          draggable
          onDragStart={(e) => handleColDragStart(e, 'task')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColDrop(e, 'task')}
          className="px-4 py-2 font-medium min-w-[280px] cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]"
          title="Drag column header to reorder"
        >
          <div className="flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>Task</span>
          </div>
        </th>
      );
    }
    if (colKey === 'owner') {
      return (
        <th
          key="owner"
          draggable
          onDragStart={(e) => handleColDragStart(e, 'owner')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColDrop(e, 'owner')}
          className="px-3 py-2 font-medium text-center w-20 cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]"
          title="Drag column header to reorder"
        >
          <div className="flex items-center justify-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>Owner</span>
          </div>
        </th>
      );
    }
    if (colKey === 'status') {
      return (
        <th
          key="status"
          draggable
          onDragStart={(e) => handleColDragStart(e, 'status')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColDrop(e, 'status')}
          className="px-3 py-2 font-medium text-center w-36 cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]"
          title="Drag column header to reorder"
        >
          <div className="flex items-center justify-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>Status</span>
          </div>
        </th>
      );
    }
    if (colKey === 'deadline') {
      return (
        <th
          key="deadline"
          draggable
          onDragStart={(e) => handleColDragStart(e, 'deadline')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColDrop(e, 'deadline')}
          className="px-3 py-2 font-medium text-center w-36 cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]"
          title="Drag column header to reorder"
        >
          <div className="flex items-center justify-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>Due date</span>
          </div>
        </th>
      );
    }
    if (colKey === 'priority') {
      return (
        <th
          key="priority"
          draggable
          onDragStart={(e) => handleColDragStart(e, 'priority')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColDrop(e, 'priority')}
          className="px-3 py-2 font-medium text-center w-32 cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]"
          title="Drag column header to reorder"
        >
          <div className="flex items-center justify-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>Priority</span>
          </div>
        </th>
      );
    }
    if (colKey === 'calendar') {
      return (
        <th
          key="calendar"
          draggable
          onDragStart={(e) => handleColDragStart(e, 'calendar')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleColDrop(e, 'calendar')}
          className="px-3 py-2 font-medium text-center w-36 cursor-grab active:cursor-grabbing hover:bg-[var(--bg-surface-high)]"
          title="Drag column header to reorder"
        >
          <div className="flex items-center justify-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span>Google Calendar</span>
          </div>
        </th>
      );
    }
    if (colKey === 'actions') {
      return (
        <th key="actions" className="px-3 py-2 font-medium text-center w-16"></th>
      );
    }
    return null;
  };

  const renderTableCell = (colKey: string, task: Task, isDoneGroup: boolean) => {
    const statusInfo = STATUS_CONFIG[task.lane];
    const priorityInfo = PRIORITY_CONFIG[task.priority];

    if (colKey === 'task') {
      return (
        <td key="task" className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span title="Drag row to reorder tasks" className="inline-flex items-center cursor-grab active:cursor-grabbing">
                <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0" />
              </span>
              <span
                onClick={() => onEditTask(task)}
                className={`cursor-pointer hover:text-[var(--accent-primary)] truncate transition-colors text-xs font-semibold ${
                  isDoneGroup ? 'line-through text-[var(--text-secondary)]' : ''
                }`}
                title={task.title}
              >
                {task.title}
              </span>
            </div>

            <button
              onClick={() => onEditTask(task)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded transition-colors shrink-0"
              title="Task details & notes"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      );
    }

    if (colKey === 'owner') {
      return (
        <td key="owner" className="px-3 py-2.5 text-center">
          <div className="flex justify-center">
            <div
              className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center font-mono shadow-xs border ${
                isDoneGroup
                  ? 'bg-emerald-900/60 border-emerald-500/30 text-emerald-400'
                  : 'bg-[var(--accent-container)] text-white border-white/20'
              }`}
              title={task.assignee.name}
            >
              {task.assignee.initials || task.assignee.name.charAt(0)}
            </div>
          </div>
        </td>
      );
    }

    if (colKey === 'status') {
      return (
        <td key="status" className="px-2 py-1.5 text-center relative">
          <button
            type="button"
            onClick={() =>
              setActiveStatusMenuTaskId(
                activeStatusMenuTaskId === task.id ? null : task.id
              )
            }
            className="w-full py-1.5 px-2 rounded font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1 active:scale-98"
            style={{
              backgroundColor: statusInfo.bg,
              color: statusInfo.text,
            }}
          >
            <span className="truncate">{statusInfo.label}</span>
          </button>

          {activeStatusMenuTaskId === task.id && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-1 w-40 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl p-1.5 space-y-1 backdrop-blur-md">
              {(['backlog', 'in_progress', 'review', 'done'] as LaneType[]).map(
                (lane) => (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => handleStatusChange(task, lane)}
                    className="w-full text-center py-1.5 px-2 rounded-md font-semibold text-xs transition-all"
                    style={{
                      backgroundColor: STATUS_CONFIG[lane].bg,
                      color: STATUS_CONFIG[lane].text,
                    }}
                  >
                    {STATUS_CONFIG[lane].label}
                  </button>
                )
              )}
            </div>
          )}
        </td>
      );
    }

    if (colKey === 'deadline') {
      return (
        <td key="deadline" className="px-3 py-2.5 text-center">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
            {isDoneGroup ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            )}
            <span>{formatDueDate(task.deadline)}</span>
          </div>
        </td>
      );
    }

    if (colKey === 'priority') {
      return (
        <td key="priority" className="px-2 py-1.5 text-center relative">
          <button
            type="button"
            onClick={() =>
              setActivePriorityMenuTaskId(
                activePriorityMenuTaskId === task.id ? null : task.id
              )
            }
            className="w-full py-1.5 px-2 rounded font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1 active:scale-98"
            style={{
              backgroundColor: priorityInfo.bg,
              color: priorityInfo.text,
            }}
          >
            <span className="truncate">{priorityInfo.label}</span>
          </button>

          {activePriorityMenuTaskId === task.id && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-1 w-36 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl p-1.5 space-y-1 backdrop-blur-md">
              {(['urgent', 'high', 'medium', 'low'] as PriorityType[]).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePriorityChange(task.id, p)}
                    className="w-full text-center py-1.5 px-2 rounded-md font-semibold text-xs transition-all"
                    style={{
                      backgroundColor: PRIORITY_CONFIG[p].bg,
                      color: PRIORITY_CONFIG[p].text,
                    }}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                )
              )}
            </div>
          )}
        </td>
      );
    }

    if (colKey === 'calendar') {
      return (
        <td key="calendar" className="px-3 py-2.5 text-center">
          {task.syncedToCalendar ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Synced
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onSyncTaskToCalendar(task)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-[var(--bg-surface-high)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-text)] border border-[var(--border-subtle)] text-[var(--text-secondary)] transition-all"
            >
              <Calendar className="w-3 h-3" />
              Sync
            </button>
          )}
        </td>
      );
    }

    if (colKey === 'actions') {
      return (
        <td key="actions" className="px-3 py-2.5 text-center">
          <button
            type="button"
            onClick={() => onRequestDeleteTask(task)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-red-500 transition-all"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      );
    }

    return null;
  };

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-200">
      {/* Sleek Minimal Toolbar: Search, Filters, and New Task */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        {/* Left: View Title & Quick Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] font-heading">
            Main Table
          </h1>

          <div className="h-4 w-px bg-[var(--border-subtle)]" />

          {/* Person filter */}
          <div className="relative">
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              aria-label="Filter tasks by owner"
              className="appearance-none pl-7 pr-6 py-1 text-xs rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">Owner: All</option>
              {allAssignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Users className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          {/* Priority filter */}
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter tasks by priority"
              className="appearance-none pl-7 pr-6 py-1 text-xs rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Filter className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort tasks by"
              className="appearance-none pl-7 pr-6 py-1 text-xs rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer font-medium"
            >
              <option value="deadline">Sort: Due date</option>
              <option value="priority">Sort: Priority</option>
              <option value="title">Sort: Name (A-Z)</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>

        {/* Right: Search & Action */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <button
            onClick={() => onOpenNewTaskModal('backlog')}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New task
          </button>
        </div>
      </div>

      {/* GROUP 1: 'To-Do' & Active Deliverables Table Group */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] card-sheen overflow-hidden shadow-xl">
        {/* Clean Group Header */}
        <div className="px-4 py-2.5 bg-[var(--bg-surface-lowest)] border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGroupOpen(!isGroupOpen)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
            >
              {isGroupOpen ? (
                <ChevronDown className="w-4 h-4 text-[var(--accent-primary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--accent-primary)]" />
              )}
            </button>

            <span className="text-xs font-bold text-[var(--accent-primary)] font-heading uppercase tracking-wider">
              To-Do
            </span>

            <span className="text-xs text-[var(--text-muted)] font-mono">
              ({activeTasks.length})
            </span>
          </div>
        </div>

        {/* Table Rows & Columns */}
        {isGroupOpen && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Header row */}
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-low)] text-[var(--text-secondary)] font-semibold text-[11px]">
                  <th className="w-10 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={
                        activeTasks.length > 0 &&
                        activeTasks.every((t) => selectedTaskIds.has(t.id))
                      }
                      onChange={() => handleToggleSelectAll(false)}
                      className="rounded border-[var(--border-strong)] bg-transparent text-[var(--accent-primary)] cursor-pointer"
                    />
                  </th>
                  {tableColumnOrder.map((colKey) => renderTableHeaderCell(colKey))}
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-[var(--border-subtle)]/70">
                {activeTasks.map((task) => {
                  const isSelected = selectedTaskIds.has(task.id);

                  return (
                    <tr
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, task.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleRowDrop(e, task.id)}
                      className={`group hover:bg-[var(--bg-surface-high)]/60 transition-colors ${
                        isSelected ? 'bg-[var(--bg-surface-high)]/80' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectTask(task.id)}
                          className="rounded border-[var(--border-strong)] bg-transparent text-[var(--accent-primary)] cursor-pointer"
                        />
                      </td>

                      {tableColumnOrder.map((colKey) =>
                        renderTableCell(colKey, task, false)
                      )}
                    </tr>
                  );
                })}

                {activeTasks.length === 0 && (
                  <tr>
                    <td colSpan={tableColumnOrder.length + 1} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No deliverables in this workspace yet. Type a task title below or click <span onClick={() => onOpenNewTaskModal('backlog')} className="text-[var(--accent-primary)] font-semibold cursor-pointer hover:underline">+ New task</span> to get started.
                    </td>
                  </tr>
                )}

                {/* Inline Task Add Row at Bottom of Group */}
                <tr className="bg-[var(--bg-surface-lowest)]/50 border-t border-[var(--border-subtle)]">
                  <td className="w-10 px-3 py-2 text-center text-[var(--text-muted)]">
                    <Plus className="w-3.5 h-3.5 mx-auto" />
                  </td>
                  <td colSpan={tableColumnOrder.length} className="px-3 py-1.5">
                    <form onSubmit={handleInlineAddSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="+ Add task..."
                        value={inlineTaskTitle}
                        onChange={(e) => setInlineTaskTitle(e.target.value)}
                        className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none py-1"
                      />
                      {inlineTaskTitle.trim() && (
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent-primary)] text-[var(--accent-primary-text)] shrink-0"
                        >
                          Add
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GROUP 2: 'Done' / Completed Deliverables Table Group */}
      {doneTasks.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] card-sheen overflow-hidden shadow-xl mt-4">
          <div className="px-4 py-2.5 bg-[var(--bg-surface-lowest)] border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDoneGroupOpen(!isDoneGroupOpen)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
              >
                {isDoneGroupOpen ? (
                  <ChevronDown className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-emerald-500" />
                )}
              </button>

              <span className="text-xs font-bold text-emerald-500 font-heading uppercase tracking-wider">
                Done
              </span>

              <span className="text-xs text-[var(--text-muted)] font-mono">
                ({doneTasks.length})
              </span>
            </div>
          </div>

          {isDoneGroupOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-low)] text-[var(--text-secondary)] font-semibold text-[11px]">
                    <th className="w-10 px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={
                          doneTasks.length > 0 &&
                          doneTasks.every((t) => selectedTaskIds.has(t.id))
                        }
                        onChange={() => handleToggleSelectAll(true)}
                        className="rounded border-[var(--border-strong)] bg-transparent text-[var(--accent-primary)] cursor-pointer"
                      />
                    </th>
                    {tableColumnOrder.map((colKey) => renderTableHeaderCell(colKey))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border-subtle)]/70">
                  {doneTasks.map((task) => {
                    const isSelected = selectedTaskIds.has(task.id);

                    return (
                      <tr
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleRowDragStart(e, task.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleRowDrop(e, task.id)}
                        className={`group hover:bg-[var(--bg-surface-high)]/60 transition-colors opacity-85 hover:opacity-100 ${
                          isSelected ? 'bg-[var(--bg-surface-high)]/80' : ''
                        }`}
                      >
                        <td className="w-10 px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectTask(task.id)}
                            className="rounded border-[var(--border-strong)] bg-transparent text-[var(--accent-primary)] cursor-pointer"
                          />
                        </td>

                        {tableColumnOrder.map((colKey) =>
                          renderTableCell(colKey, task, true)
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
