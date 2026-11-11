import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  RefreshCw,
  ExternalLink,
  Plus,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  GripVertical,
} from 'lucide-react';
import { Task, GoogleCalendarEvent } from '../types';

interface CalendarScheduleViewProps {
  tasks: Task[];
  calendarEvents: GoogleCalendarEvent[];
  isLoadingEvents: boolean;
  isGoogleConnected: boolean;
  onRefreshEvents: () => Promise<void>;
  onSyncTaskToCalendar: (task: Task) => Promise<void>;
  onDispatchAllToCalendar: () => Promise<void>;
  onSignIn: () => void;
  onEditTask: (task: Task) => void;
  onUpdateTaskDeadline?: (taskId: string, newDeadlineIso: string) => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  tasks,
  calendarEvents,
  isLoadingEvents,
  isGoogleConnected,
  onRefreshEvents,
  onSyncTaskToCalendar,
  onDispatchAllToCalendar,
  onSignIn,
  onEditTask,
  onUpdateTaskDeadline,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);

  // Group tasks by date string (YYYY-MM-DD)
  const tasksByDate = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    try {
      const dateKey = new Date(task.deadline).toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(task);
    } catch {}
    return acc;
  }, {});

  // Group calendar events by date string
  const eventsByDate = calendarEvents.reduce<Record<string, GoogleCalendarEvent[]>>(
    (acc, event) => {
      try {
        const rawDate = event.start.dateTime || event.start.date;
        if (rawDate) {
          const dateKey = new Date(rawDate).toISOString().split('T')[0];
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(event);
        }
      } catch {}
      return acc;
    },
    {}
  );

  // Generate 7 days for the week view centered around selectedDate
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - distanceToMonday + i);
    return d;
  });

  const handleSyncClick = async (task: Task) => {
    setSyncingTaskId(task.id);
    try {
      await onSyncTaskToCalendar(task);
    } finally {
      setSyncingTaskId(null);
    }
  };

  const nextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
  };

  const prevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 7);
    setSelectedDate(prev);
  };

  const today = () => {
    setSelectedDate(new Date());
  };

  const unsyncedTasks = tasks.filter((t) => !t.syncedToCalendar && t.lane !== 'done');

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/task-id', taskId);
  };

  const handleDayDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    setDragOverDateKey(dateKey);
  };

  const handleDayDrop = (e: React.DragEvent, targetDateKey: string) => {
    e.preventDefault();
    setDragOverDateKey(null);
    const taskId = e.dataTransfer.getData('text/task-id') || draggedTaskId;
    if (taskId && onUpdateTaskDeadline) {
      const targetDate = new Date(`${targetDateKey}T17:00:00`);
      onUpdateTaskDeadline(taskId, targetDate.toISOString());
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-xl card-sheen border border-[var(--border-subtle)] relative overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
            Google Calendar Schedule &amp; Event Dispatcher
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isGoogleConnected ? (
            <>
              <button
                onClick={onRefreshEvents}
                disabled={isLoadingEvents}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--bg-surface-high)] hover:bg-[var(--bg-surface-highest)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors shadow-sm"
                title="Refresh calendar events"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[var(--accent-secondary)] ${
                    isLoadingEvents ? 'animate-spin' : ''
                  }`}
                />
                Refresh
              </button>

              {unsyncedTasks.length > 0 && (
                <button
                  onClick={onDispatchAllToCalendar}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shadow-md transition-all whitespace-nowrap"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Sync All ({unsyncedTasks.length}) to Calendar
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 hover:bg-slate-100 shadow-md transition-all"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between p-3 rounded-xl card-sheen border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface-high)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-md hover:bg-[var(--bg-surface-high)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={today}
            className="px-2.5 py-1 text-xs font-mono rounded-md bg-[var(--bg-surface-high)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] ml-1 border border-[var(--border-subtle)] transition-colors"
          >
            Today
          </button>
        </div>

        <div className="text-xs font-mono font-semibold text-[var(--text-primary)] tracking-wide">
          {weekDays[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
          {weekDays[6].toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* 7-Day Calendar Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {weekDays.map((date) => {
          const dateKey = date.toISOString().split('T')[0];
          const isToday = new Date().toDateString() === date.toDateString();
          const isDragOver = dragOverDateKey === dateKey;
          const dayTasks = tasksByDate[dateKey] || [];
          const dayEvents = eventsByDate[dateKey] || [];

          return (
            <div
              key={dateKey}
              onDragOver={(e) => handleDayDragOver(e, dateKey)}
              onDragLeave={() => setDragOverDateKey(null)}
              onDrop={(e) => handleDayDrop(e, dateKey)}
              className={`rounded-xl border p-3 flex flex-col min-h-[380px] transition-all ${
                isDragOver
                  ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40 bg-[var(--bg-surface-high)]'
                  : isToday
                  ? 'card-sheen border-[var(--accent-primary)]/50 shadow-lg'
                  : 'bg-[var(--bg-surface-lowest)] border-[var(--border-subtle)]'
              }`}
            >
              {/* Day Header */}
              <div className="pb-2 mb-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                    {date.toLocaleDateString([], { weekday: 'short' })}
                  </span>
                  <span
                    className={`text-base font-bold font-mono-num ${
                      isToday
                        ? 'text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {(dayTasks.length > 0 || dayEvents.length > 0) && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--bg-surface-high)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {dayTasks.length + dayEvents.length} items
                  </span>
                )}
              </div>

              {/* Items for this day */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {/* Sprint Deliverable Tasks */}
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleTaskDragStart(e, task.id)}
                    className={`p-2.5 rounded-lg border text-xs space-y-1 transition-all cursor-grab active:cursor-grabbing hover:border-[var(--border-strong)] relative group ${
                      task.priority === 'urgent'
                        ? 'bg-red-500/10 border-red-500/30 text-red-200'
                        : task.priority === 'high'
                        ? 'card-sheen-high border-[var(--accent-primary)]/40 text-[var(--text-primary)]'
                        : 'card-sheen border-[var(--border-subtle)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                      <span className="uppercase font-bold text-[var(--accent-primary)] flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 cursor-grab" />
                        [Task]
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {new Date(task.deadline).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>


                    <h4
                      onClick={() => onEditTask(task)}
                      className="font-medium text-xs hover:underline cursor-pointer truncate"
                      title={task.title}
                    >
                      {task.title}
                    </h4>

                    <div className="pt-1 flex items-center justify-between text-[10px]">
                      <span className="text-[var(--text-secondary)] truncate">
                        {task.assignee.name.split(' ')[0]}
                      </span>

                      {task.syncedToCalendar ? (
                        <span
                          className="text-[var(--accent-secondary)] flex items-center gap-1 font-mono"
                          title="Synced to Google Calendar"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Synced
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSyncClick(task)}
                          disabled={syncingTaskId === task.id}
                          className="text-[var(--accent-primary)] hover:underline flex items-center gap-0.5 font-mono"
                          title="Dispatch to Google Calendar"
                        >
                          {syncingTaskId === task.id ? (
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Plus className="w-2.5 h-2.5" />
                          )}
                          +Calendar
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Real Google Calendar Events */}
                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-low)] text-xs space-y-1 hover:border-[var(--accent-secondary)]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[var(--accent-secondary)]">
                      <span className="flex items-center gap-1 font-bold">
                        <CalendarIcon className="w-2.5 h-2.5" />
                        EVENT
                      </span>
                      {evt.start.dateTime && (
                        <span>
                          {new Date(evt.start.dateTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    <p className="font-medium text-xs text-[var(--text-primary)] truncate" title={evt.summary}>
                      {evt.summary}
                    </p>

                    {evt.htmlLink && (
                      <a
                        href={evt.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-primary)] flex items-center gap-1 font-mono pt-0.5"
                      >
                        Google Calendar
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}

                {dayTasks.length === 0 && dayEvents.length === 0 && (
                  <div className="h-20 flex items-center justify-center text-[11px] text-[var(--text-muted)] font-mono">
                    Open Slot
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled / Unsynced Tasks Drawer */}
      {unsyncedTasks.length > 0 && (
        <div className="p-5 rounded-xl card-sheen border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                Unsynced Agile Deliverables ({unsyncedTasks.length})
              </h3>
            </div>
            <button
              onClick={onDispatchAllToCalendar}
              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
            >
              Sync all {unsyncedTasks.length} now →
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unsyncedTasks.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                    <span>Due {new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    <span aria-hidden="true">·</span>
                    <span>{task.priority.toUpperCase()}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSyncClick(task)}
                  disabled={syncingTaskId === task.id}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shrink-0 flex items-center gap-1 transition-all shadow-sm"
                >
                  {syncingTaskId === task.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Sync
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
