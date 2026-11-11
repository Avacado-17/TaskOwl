import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User as UserIcon, Tag, AlertCircle } from 'lucide-react';
import { Task, LaneType, PriorityType } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>, syncToCalendar: boolean) => Promise<void>;
  initialTask?: Task | null;
  isGoogleConnected: boolean;
  defaultAssigneeName?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  isGoogleConnected,
  defaultAssigneeName = 'Lead Architect',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lane, setLane] = useState<LaneType>('backlog');
  const [priority, setPriority] = useState<PriorityType>('medium');
  const [deadline, setDeadline] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(3);
  const [assigneeName, setAssigneeName] = useState(defaultAssigneeName);
  const [assigneeRole, setAssigneeRole] = useState('Contributor');
  const [tagsInput, setTagsInput] = useState('Architecture, Cloud');
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setLane(initialTask.lane);
      setPriority(initialTask.priority);
      // Format deadline for datetime-local: YYYY-MM-DDTHH:mm
      const d = new Date(initialTask.deadline);
      const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDeadline(localISO);
      setEstimatedHours(initialTask.estimatedHours);
      setAssigneeName(initialTask.assignee.name);
      setAssigneeRole(initialTask.assignee.role);
      setTagsInput(initialTask.tags.join(', '));
      setSyncToCalendar(initialTask.syncedToCalendar);
    } else {
      // Default deadline: tomorrow at 17:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      const localISO = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setTitle('');
      setDescription('');
      setLane('backlog');
      setPriority('medium');
      setDeadline(localISO);
      setEstimatedHours(3);
      setAssigneeName(defaultAssigneeName);
      setAssigneeRole('Contributor');
      setTagsInput('Agile, Delivery');
      setSyncToCalendar(isGoogleConnected);
    }
    setError(null);
  }, [initialTask, isOpen, isGoogleConnected, defaultAssigneeName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    if (!deadline) {
      setError('A valid deadline date and time is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const initials = assigneeName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          lane,
          priority,
          deadline: new Date(deadline).toISOString(),
          estimatedHours: Number(estimatedHours) || 1,
          tags: parsedTags.length > 0 ? parsedTags : ['General'],
          assignee: {
            name: assigneeName.trim() || 'Assignee',
            role: assigneeRole.trim() || 'Contributor',
            initials: initials || 'AS',
          },
        },
        syncToCalendar && isGoogleConnected
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border-strong)] card-sheen shadow-2xl relative p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-md"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-[var(--text-primary)] font-heading">
          {initialTask ? 'Edit Agile Task' : 'Create New Agile Task'}
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Set sprint lane, deadlines, and real-time Google Calendar integration.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architect Zero-Trust Event Bus Gateway"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
              Deliverable Scope &amp; Details
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key specifications, verification criteria, and architecture links..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors resize-none"
            />
          </div>

          {/* Lane & Priority Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Kanban Lane
              </label>
              <select
                value={lane}
                onChange={(e) => setLane(e.target.value as LaneType)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Initial Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityType)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent / Critical</option>
              </select>
            </div>
          </div>

          {/* Deadline & Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Target Deadline *
              </label>
              <input
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                Estimated Effort (Hours)
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                max="100"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono text-xs"
              />
            </div>
          </div>

          {/* Assignee & Role */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Assignee Name
              </label>
              <input
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Assignee Role
              </label>
              <input
                type="text"
                value={assigneeRole}
                onChange={(e) => setAssigneeRole(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. OAuth, API, Production, Database"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {/* Google Calendar Real-Time Sync Option */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface-high)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-[var(--bg-surface-lowest)] flex items-center justify-center border border-[var(--border-subtle)]">
                <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Sync to Google Calendar
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {isGoogleConnected
                    ? 'Adds scheduled deadline slot with reminders to your primary calendar'
                    : 'Requires Google Sign-in to sync in real time'}
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isGoogleConnected}
                checked={syncToCalendar && isGoogleConnected}
                onChange={(e) => setSyncToCalendar(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--bg-surface-lowest)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
            </label>
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-high)] hover:bg-[var(--bg-surface-highest)] border border-[var(--border-subtle)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shadow-md transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-[var(--accent-primary-text)] border-t-transparent rounded-full animate-spin" />
              ) : null}
              {initialTask ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
