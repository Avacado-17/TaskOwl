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
  onUpdatePreferences: (newPrefs: Partial<AutomationPreferences>) => void | Promise<void>;
  logs: AutomationLog[];
  onClearLogs: () => void;
  onTriggerHeartbeatNow: () => void;
  onSimulateAlarm: (type: '1h' | '24h' | 'escalation') => void;
  onSendTestEmail: (overrideRecipient?: string, overrideMessage?: string) => Promise<void>;
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
  const [emailNotice, setEmailNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [recipientDraft, setRecipientDraft] = useState(preferences.recipientEmail || userEmail || '');
  const [customMessageDraft, setCustomMessageDraft] = useState(preferences.customReminderMessage || '');
  const [isSavingMessage, setIsSavingMessage] = useState(false);
  const [messageSavedAt, setMessageSavedAt] = useState<string | null>(null);
  const recipientInputRef = React.useRef<HTMLInputElement | null>(null);
  const messageTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Sync external preference updates when fields are not focused
  React.useEffect(() => {
    if (document.activeElement !== recipientInputRef.current) {
      setRecipientDraft(preferences.recipientEmail || userEmail || '');
    }
  }, [preferences.recipientEmail, userEmail]);

  React.useEffect(() => {
    if (document.activeElement !== messageTextareaRef.current) {
      setCustomMessageDraft(preferences.customReminderMessage || '');
    }
  }, [preferences.customReminderMessage]);

  // Automatically sync recipient email from signed-in Google account
  React.useEffect(() => {
    if (userEmail && !preferences.recipientEmail) {
      onUpdatePreferences({ recipientEmail: userEmail });
    }
  }, [userEmail, preferences.recipientEmail, onUpdatePreferences]);

  const savedMessage = preferences.customReminderMessage || '';
  const hasUnsavedMessage = customMessageDraft !== savedMessage;

  const handleSaveCustomMessage = async (nextValue?: string) => {
    const val = (nextValue !== undefined ? nextValue : customMessageDraft).slice(0, 2000);
    if (val === savedMessage) return;
    setIsSavingMessage(true);
    try {
      await onUpdatePreferences({ customReminderMessage: val });
      setMessageSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setIsSavingMessage(false);
    }
  };

  // Auto-save custom reminder message after a short pause in typing
  React.useEffect(() => {
    if (!hasUnsavedMessage) return;
    const timer = setTimeout(() => {
      handleSaveCustomMessage(customMessageDraft);
    }, 700);
    return () => clearTimeout(timer);
  }, [customMessageDraft, hasUnsavedMessage]);

  const insertToken = (token: string) => {
    const el = messageTextareaRef.current;
    if (!el) {
      const appended = `${customMessageDraft}${customMessageDraft && !customMessageDraft.endsWith(' ') ? ' ' : ''}${token}`.slice(0, 2000);
      setCustomMessageDraft(appended);
      return;
    }
    const start = el.selectionStart ?? customMessageDraft.length;
    const end = el.selectionEnd ?? customMessageDraft.length;
    const next = (customMessageDraft.slice(0, start) + token + customMessageDraft.slice(end)).slice(0, 2000);
    setCustomMessageDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(start + token.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const handleTestEmail = async () => {
    setIsSendingEmail(true);
    setEmailNotice(null);
    try {
      const targetEmail = recipientDraft.trim();
      const targetMessage = customMessageDraft.slice(0, 2000);
      if (targetEmail !== (preferences.recipientEmail || '') || targetMessage !== savedMessage) {
        await onUpdatePreferences({
          recipientEmail: targetEmail,
          customReminderMessage: targetMessage,
        });
      }
      await onSendTestEmail(targetEmail, targetMessage);
      setEmailNotice({
        text: `Test reminder email dispatched via Gmail API to ${targetEmail || userEmail}.`,
        isError: false,
      });
      setTimeout(() => setEmailNotice(null), 5000);
    } catch (err: any) {
      setEmailNotice({
        text: err?.message || 'Failed to dispatch test email',
        isError: true,
      });
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
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                        Recipient Inbox Address:
                      </label>
                      {userEmail && recipientDraft !== userEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientDraft(userEmail);
                            onUpdatePreferences({ recipientEmail: userEmail });
                          }}
                          className="text-[10px] text-[var(--accent-primary)] hover:underline font-mono"
                        >
                          Reset to Google Account ({userEmail})
                        </button>
                      )}
                    </div>
                    <input
                      ref={recipientInputRef}
                      type="email"
                      value={recipientDraft}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRecipientDraft(val);
                      }}
                      onBlur={() => {
                        const trimmed = recipientDraft.trim();
                        if (trimmed !== (preferences.recipientEmail || '')) {
                          onUpdatePreferences({ recipientEmail: trimmed });
                        }
                      }}
                      placeholder={userEmail ? userEmail : "Sign in with Google to auto-route alerts"}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                  </div>

                  {/* Custom Reminder Email Message Box */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label
                          htmlFor="custom-reminder-message"
                          className="block text-[11px] font-semibold text-[var(--text-primary)]"
                        >
                          Custom Reminder Email Message
                        </label>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          This custom message is included in automated reminder emails sent to the recipient address above.
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {isSavingMessage
                          ? 'Saving...'
                          : hasUnsavedMessage
                          ? 'Unsaved edits'
                          : messageSavedAt
                          ? `Saved at ${messageSavedAt}`
                          : `${customMessageDraft.length}/2000 chars`}
                      </span>
                    </div>

                    <textarea
                      id="custom-reminder-message"
                      ref={messageTextareaRef}
                      rows={4}
                      maxLength={2000}
                      value={customMessageDraft}
                      onChange={(e) => setCustomMessageDraft(e.target.value)}
                      onBlur={() => handleSaveCustomMessage()}
                      placeholder="Write your custom reminder message here (e.g., Hey! Friendly reminder that {task} is due on {deadline}. Please review before the cutoff!)."
                      className="w-full px-3 py-2 text-xs rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors resize-y leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-muted)] mr-1">
                          Insert placeholder:
                        </span>
                        {[
                          { token: '{task}', label: '{task}' },
                          { token: '{deadline}', label: '{deadline}' },
                          { token: '{priority}', label: '{priority}' },
                          { token: '{owner}', label: '{owner}' },
                        ].map((item) => (
                          <button
                            key={item.token}
                            type="button"
                            onClick={() => insertToken(item.token)}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/50 transition-colors"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {customMessageDraft.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomMessageDraft('');
                              handleSaveCustomMessage('');
                            }}
                            className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/40 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!hasUnsavedMessage || isSavingMessage}
                          onClick={() => handleSaveCustomMessage()}
                          className="px-3 py-1.5 text-[11px] font-semibold rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-high)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 transition-colors"
                        >
                          {isSavingMessage ? 'Saving...' : 'Save Message'}
                        </button>
                        <button
                          type="button"
                          disabled={isSendingEmail}
                          onClick={handleTestEmail}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md bg-[var(--accent-primary)] text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          <Send className="w-3 h-3" />
                          {isSendingEmail ? 'Sending...' : 'Send Test Reminder Email'}
                        </button>
                      </div>
                    </div>
                  </div>

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
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                        emailNotice.isError
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : 'bg-[var(--bg-surface-lowest)] border-[var(--border-subtle)] text-[var(--accent-primary)]'
                      }`}
                    >
                      {emailNotice.text}
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
