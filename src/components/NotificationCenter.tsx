import React from 'react';
import { X, Bell, CheckCheck, Trash2, AlertTriangle, Flame, Calendar, Mail, CheckCircle2 } from 'lucide-react';
import { InAppNotification } from '../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: InAppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectTask?: (taskId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectTask,
}) => {
  if (!isOpen) return null;

  const getIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'emergency_1h':
        return <Flame className="w-4 h-4 text-red-400" />;
      case 'warning_24h':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'escalation':
        return <Flame className="w-4 h-4 text-[var(--accent-primary)]" />;
      case 'calendar_sync':
        return <Calendar className="w-4 h-4 text-[var(--accent-secondary)]" />;
      case 'email_sent':
        return <Mail className="w-4 h-4 text-sky-400" />;
      case 'morning_digest':
        return <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)]" />;
      default:
        return <Bell className="w-4 h-4 text-[var(--text-secondary)]" />;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.round(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col card-sheen">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[var(--bg-surface-high)] flex items-center justify-center border border-[var(--border-subtle)]">
                <Bell className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                Proactive Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[var(--accent-primary)] text-[var(--accent-primary-text)]">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-high)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader controls */}
          <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] flex items-center justify-between text-xs">
            <button
              onClick={onMarkAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
            <button
              onClick={onClearAll}
              disabled={notifications.length === 0}
              className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <Bell className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-3" />
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  No notifications yet
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[200px]">
                  Upcoming deadline alarms and automation escalations will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    onMarkAsRead(notif.id);
                    if (notif.taskId && onSelectTask) {
                      onSelectTask(notif.taskId);
                      onClose();
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                    notif.read
                      ? 'bg-[var(--bg-surface-low)] border-[var(--border-subtle)] opacity-75 hover:opacity-100'
                      : 'card-sheen-high border-[var(--border-strong)] shadow-md'
                  }`}
                >
                  {!notif.read && (
                    <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shrink-0 mt-0.5">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {notif.title}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                        <span>{formatTimestamp(notif.timestamp)}</span>
                        {notif.taskId && (
                          <span className="text-[var(--accent-primary)] group-hover:underline">
                            View Task →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
