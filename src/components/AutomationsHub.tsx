import React, { useState } from 'react';
import {
  Zap,
  Bell,
  Clock,
  Flame,
  Mail,
  Calendar,
  Volume2,
  VolumeX,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
} from 'lucide-react';
import { AutomationPreferences, AutomationLog, Task } from '../types';
import { sounds } from '../services/soundEffects';

interface AutomationsHubProps {
  preferences: AutomationPreferences;
  onUpdatePreferences: (newPrefs: Partial<AutomationPreferences>) => void;
  logs: AutomationLog[];
  onClearLogs: () => void;
  onTriggerHeartbeatNow: () => void;
  onSimulateAlarm: (type: '1h' | '24h' | 'escalation') => void;
  onSendTestEmail: () => Promise<void>;
  isGoogleConnected: boolean;
  userEmail?: string | null;
  tasks: Task[];
}

export const AutomationsHub: React.FC<AutomationsHubProps> = ({
  preferences,
  onUpdatePreferences,
  logs,
  onClearLogs,
  onTriggerHeartbeatNow,
  onSimulateAlarm,
  onSendTestEmail,
  isGoogleConnected,
  userEmail,
  tasks,
}) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  // Automatically sync recipient email from signed-in Google account
  React.useEffect(() => {
    if (userEmail && !preferences.recipientEmail) {
      onUpdatePreferences({ recipientEmail: userEmail });
    }
  }, [userEmail, preferences.recipientEmail, onUpdatePreferences]);

  const handleTestEmail = async () => {
    setIsSendingEmail(true);
    setEmailNotice(null);
    try {
      await onSendTestEmail();
      setEmailNotice('Test notification successfully dispatched via Gmail API.');
      setTimeout(() => setEmailNotice(null), 5000);
    } catch (err: any) {
      setEmailNotice(err?.message || 'Failed to dispatch test email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-xl card-sheen border border-[var(--border-subtle)] relative overflow-hidden">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
          Automations &amp; Deadline Preferences
        </h1>
      </div>

      {/* Rules Configuration Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Google Workspace Sync & Email Preferences */}
        <div className="p-5 rounded-xl card-sheen border border-[var(--border-subtle)] space-y-4">
          <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--accent-secondary)]" />
            Google Calendar &amp; Gmail Dispatch Rules
          </h2>

          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Google Calendar Popup Reminder Lead Time Control */}
            <div className="py-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block font-heading">
                      Google Calendar Lead Time Alert
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Default popup reminder dispatched before deliverable deadlines.
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent-primary)] font-semibold px-2.5 py-1 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shrink-0">
                  <Bell className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{preferences.calendarReminderMinutes} mins lead time</span>
                </div>
              </div>

              {/* Visually Appealing Preset Chips Segmented Control */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { value: 10, label: '10 mins', tag: 'Quick' },
                  { value: 15, label: '15 mins', tag: 'Short' },
                  { value: 30, label: '30 mins', tag: 'Standard' },
                  { value: 60, label: '1 hour', tag: 'Advance' },
                  { value: 120, label: '2 hours', tag: 'Early' },
                ].map((option) => {
                  const isSelected = preferences.calendarReminderMinutes === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onUpdatePreferences({ calendarReminderMinutes: option.value })}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between relative overflow-hidden group ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-high)] ring-1 ring-[var(--accent-primary)]/40 shadow-md'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-low)]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase">
                          {option.tag}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                        )}
                      </div>
                      <span className={`text-xs font-bold font-mono-num ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Morning Digest */}
            <div className="py-3.5 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Daily Morning Executive Digest
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Generates a scheduled daily briefing of deliverables due within 24 hours.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={preferences.morningDigest}
                    onChange={(e) =>
                      onUpdatePreferences({ morningDigest: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[var(--bg-surface-lowest)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                </label>
              </div>

              {preferences.morningDigest && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[var(--text-secondary)]">Target Scheduled Time:</span>
                  <input
                    type="time"
                    value={preferences.morningDigestTime}
                    onChange={(e) =>
                      onUpdatePreferences({ morningDigestTime: e.target.value })
                    }
                    className="px-2.5 py-1 text-xs font-mono rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
              )}
            </div>

            {/* Email Updates (Gmail API) */}
            <div className="py-3.5 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Gmail Email Dispatch Updates
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Sends real-time email alerts to the user inbox for auto-escalations and digests.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={preferences.emailUpdatesEnabled}
                    onChange={(e) =>
                      onUpdatePreferences({ emailUpdatesEnabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[var(--bg-surface-lowest)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                </label>
              </div>

              {preferences.emailUpdatesEnabled && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] text-[var(--text-secondary)]">
                      Recipient Inbox Address:
                    </label>
                    {userEmail && preferences.recipientEmail !== userEmail && (
                      <button
                        type="button"
                        onClick={() => onUpdatePreferences({ recipientEmail: userEmail })}
                        className="text-[10px] text-[var(--accent-primary)] hover:underline font-mono"
                      >
                        Reset to Google Account ({userEmail})
                      </button>
                    )}
                  </div>
                  <input
                    type="email"
                    value={preferences.recipientEmail || (userEmail || '')}
                    onChange={(e) =>
                      onUpdatePreferences({ recipientEmail: e.target.value })
                    }
                    placeholder={userEmail ? userEmail : "Sign in with Google to auto-route alerts"}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                  />

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono">
                      {isGoogleConnected && userEmail ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Authenticated via Google Workspace ({userEmail})
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">
                          Sign in with Google in the top bar to automatically route alerts to your email
                        </span>
                      )}
                    </span>
                  </div>

                  {emailNotice && (
                    <div className="p-2 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--accent-primary)]">
                      {emailNotice}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Personal Calendar Reminders */}
            <div className="py-3.5 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Personal Calendar Event Reminders
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Send Gmail and in-app alerts for any primary calendar event, even if not in the TaskOwl list.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={preferences.remindCalendarExternalEvents}
                    onChange={(e) =>
                      onUpdatePreferences({ remindCalendarExternalEvents: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[var(--bg-surface-lowest)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Automations Execution History Log */}
      <div className="p-5 rounded-xl card-sheen border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-secondary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
              Automation Execution Log ({logs.length})
            </h2>
          </div>
          <button
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-mono">
                <th className="py-2.5 px-3">TIMESTAMP</th>
                <th className="py-2.5 px-3">RULE EXECUTED</th>
                <th className="py-2.5 px-3">TARGET DELIVERABLE</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-muted)]">
                    No automation events logged yet. Trigger a heartbeat or wait for deadline threshold.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(log.triggeredAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      {log.ruleName}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] truncate max-w-[200px]">
                      {log.taskTitle || '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          log.status === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : log.status === 'success'
                            ? 'bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/20'
                            : 'bg-[var(--bg-surface-high)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] text-[11px]">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
