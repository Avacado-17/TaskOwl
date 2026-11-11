import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  setAccessTokenInMemory,
} from './services/googleAuth';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
} from './services/calendarService';
import { sendGmailAlert } from './services/emailService';
import { sounds } from './services/soundEffects';
import { 
  db, 
  auth, 
  handleFirestoreError, 
  OperationType, 
  testConnection 
} from './services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import {
  INITIAL_TASKS,
  INITIAL_PREFERENCES,
  INITIAL_LOGS,
  INITIAL_NOTIFICATIONS,
  DEFAULT_CUSTOMIZATION,
} from './services/defaultData';
import { applyThemeAndAccentToDom } from './services/colorUtils';
import {
  Task,
  LaneType,
  PriorityType,
  ThemeMode,

  DashboardCustomization,
  AutomationPreferences,
  AutomationLog,
  InAppNotification,
  GoogleCalendarEvent,
} from './types';

import { TopNav } from './components/TopNav';
import { MainTableView } from './components/MainTableView';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { AutomationsHub } from './components/AutomationsHub';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { TaskModal } from './components/TaskModal';
import { NotificationCenter } from './components/NotificationCenter';
import { ConfirmationModal } from './components/ConfirmationModal';
import { DashboardCustomizerModal } from './components/DashboardCustomizerModal';

export default function App() {
  // Dashboard & Theme Customization state (Dark/White theme, accents, widgets, density)
  const [customization, setCustomization] = useState<DashboardCustomization>(DEFAULT_CUSTOMIZATION);

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Active navigation tab (defaults to Monday.com format 'table' from screenshot)
  const [activeTab, setActiveTab] = useState<'table' | 'dashboard' | 'kanban' | 'automations' | 'calendar'>('table');

  // Booting Splash Screen state (ensures attached image is shown during load)
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);


  // Check and purge legacy cached dummy data on launch
  const [tasks, setTasks] = useState<Task[]>([]);

  // Automation Preferences
  const [preferences, setPreferences] = useState<AutomationPreferences>(INITIAL_PREFERENCES);

  // Automation Execution Logs
  const [logs, setLogs] = useState<AutomationLog[]>([]);

  // In-app Notifications
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  // User and Auth State
  const [user, setUser] = useState<User | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Track event IDs that have already had reminders sent to avoid double-processing
  const [externalEventsReminded, setExternalEventsReminded] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('taskowl_external_reminders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  // Modals & Panels
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultModalLane, setDefaultModalLane] = useState<LaneType>('backlog');
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    task: Task | null;
  }>({ isOpen: false, task: null });

  // Toast banner
  const [bannerNotice, setBannerNotice] = useState<{
    message: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  // Apply theme & accent to document root
  useEffect(() => {
    applyThemeAndAccentToDom(customization.themeMode, customization.accentColor);
  }, [customization]);

  useEffect(() => {
    localStorage.setItem('taskowl_external_reminders', JSON.stringify(externalEventsReminded));
  }, [externalEventsReminded]);

  const showBanner = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setBannerNotice({ message, type });
    setTimeout(() => {
      setBannerNotice(null);
    }, 4500);
  };

  // Google Calendar fetch helper
  const loadCalendarEvents = useCallback(async (token: string) => {
    setIsLoadingEvents(true);
    try {
      const events = await fetchCalendarEvents(token);
      setCalendarEvents(events);
    } catch (err) {
      console.error('Failed to load Google Calendar events:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  // Firestore Subscriptions
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        loadCalendarEvents(token);
      },
      () => {
        setUser(null);
      }
    );

    return () => unsubscribeAuth();
  }, [loadCalendarEvents]);

  // Handle Firestore synchronization when user state changes
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setPreferences(INITIAL_PREFERENCES);
      setLogs([]);
      setNotifications([]);
      setCustomization(DEFAULT_CUSTOMIZATION);
      return;
    }

    const userId = user.uid;

    // 1. Tasks Subscription
    const tasksQuery = query(collection(db, `users/${userId}/tasks`), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskList = snapshot.docs.map(doc => doc.data() as Task);
      setTasks(taskList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/tasks`));

    // 2. Automation Preferences Subscription
    const prefsDoc = doc(db, `users/${userId}/preferences`, 'automation');
    const unsubscribePrefs = onSnapshot(prefsDoc, (snapshot) => {
      if (snapshot.exists()) {
        setPreferences(snapshot.data() as AutomationPreferences);
      } else {
        // Initialize if not present
        setDoc(prefsDoc, INITIAL_PREFERENCES).catch(e => handleFirestoreError(e, OperationType.CREATE, prefsDoc.path));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, prefsDoc.path));

    // 3. Customization Subscription
    const customDoc = doc(db, `users/${userId}/preferences`, 'customization');
    const unsubscribeCustom = onSnapshot(customDoc, (snapshot) => {
      if (snapshot.exists()) {
        setCustomization(snapshot.data() as DashboardCustomization);
      } else {
        // Initialize if not present
        setDoc(customDoc, DEFAULT_CUSTOMIZATION).catch(e => handleFirestoreError(e, OperationType.CREATE, customDoc.path));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, customDoc.path));

    // 4. Logs Subscription
    const logsQuery = query(collection(db, `users/${userId}/logs`), orderBy('triggeredAt', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logList = snapshot.docs.map(doc => doc.data() as AutomationLog);
      setLogs(logList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/logs`));

    // 5. Notifications Subscription
    const notifsQuery = query(collection(db, `users/${userId}/notifications`), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeNotifs = onSnapshot(notifsQuery, (snapshot) => {
      const notifList = snapshot.docs.map(doc => doc.data() as InAppNotification);
      setNotifications(notifList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`));

    return () => {
      unsubscribeTasks();
      unsubscribePrefs();
      unsubscribeCustom();
      unsubscribeLogs();
      unsubscribeNotifs();
    };
  }, [user]);

  // Connection test on boot
  useEffect(() => {
    testConnection();
  }, []);

  const handleUpdatePreferences = useCallback(async (newPrefs: Partial<AutomationPreferences>) => {
    if (!user) return;
    const next = { ...preferences, ...newPrefs };
    const prefsDoc = doc(db, `users/${user.uid}/preferences`, 'automation');
    try {
      await setDoc(prefsDoc, next);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, prefsDoc.path);
    }
  }, [user, preferences]);

  // Synchronize recipient email whenever signed-in Google user email updates
  useEffect(() => {
    if (user?.email && preferences.recipientEmail !== user.email) {
      handleUpdatePreferences({ recipientEmail: user.email });
    }
  }, [user?.email, preferences.recipientEmail, handleUpdatePreferences]);

  // Sign In with Google
  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        showBanner(`Connected to Google Workspace as ${res.user.displayName || res.user.email}`);
        await loadCalendarEvents(res.accessToken);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      showBanner(err?.message || 'Google Sign-in failed', 'warning');
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    await googleLogout();
    setUser(null);
    setCalendarEvents([]);
    showBanner('Disconnected from Google Workspace', 'info');
  };

  // Toggle Theme (Dark vs White / Light)
  const handleToggleTheme = () => {
    const nextMode: ThemeMode = customization.themeMode === 'dark' ? 'light' : 'dark';
    handleUpdateCustomization({ themeMode: nextMode });
    showBanner(`Switched to ${nextMode === 'dark' ? 'Dark' : 'White'} theme`);
  };

  const handleUpdateCustomization = async (updates: Partial<DashboardCustomization>) => {
    if (!user) return;
    const next = {
      ...customization,
      ...updates,
      ...(updates.visibleWidgets
        ? {
            visibleWidgets: {
              ...customization.visibleWidgets,
              ...updates.visibleWidgets,
            },
          }
        : {}),
    };
    const customDoc = doc(db, `users/${user.uid}/preferences`, 'customization');
    try {
      await setDoc(customDoc, next);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, customDoc.path);
    }
  };

  const handleResetCustomization = async () => {
    if (!user) return;
    const customDoc = doc(db, `users/${user.uid}/preferences`, 'customization');
    try {
      await setDoc(customDoc, DEFAULT_CUSTOMIZATION);
      showBanner('Reset dashboard preferences to default', 'info');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, customDoc.path);
    }
  };


  // Add Log Entry
  const addLog = useCallback(
    async (ruleName: string, details: string, status: 'success' | 'warning' | 'info', taskTitle?: string, taskId?: string) => {
      if (!user) return;
      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newLog: AutomationLog = {
        id: logId,
        ruleName,
        details,
        status,
        taskTitle,
        taskId,
        triggeredAt: new Date().toISOString(),
      };
      
      const logDoc = doc(db, `users/${user.uid}/logs`, logId);
      try {
        await setDoc(logDoc, newLog);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, logDoc.path);
      }
    },
    [user]
  );

  // Add Notification Entry
  const addNotification = useCallback(
    async (
      title: string,
      message: string,
      type: InAppNotification['type'],
      taskId?: string
    ) => {
      if (!user) return;
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newNotif: InAppNotification = {
        id: notifId,
        title,
        message,
        type,
        taskId,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      const notifDoc = doc(db, `users/${user.uid}/notifications`, notifId);
      try {
        await setDoc(notifDoc, newNotif);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, notifDoc.path);
      }
    },
    [user]
  );

  // Heartbeat Automation Engine Runner (Auto 48h & 24h Gmail Alerts)
  const runHeartbeat = useCallback(async () => {
    const now = Date.now();
    let updatedTasks = false;
    const taskUpdates = [...tasks];
    const token = await getAccessToken();

    for (let idx = 0; idx < taskUpdates.length; idx++) {
      const task = taskUpdates[idx];
      if (task.lane === 'done') continue;

      const deadlineMs = new Date(task.deadline).getTime();
      const diffHours = (deadlineMs - now) / (1000 * 60 * 60);

      // Check 1: 48-Hour Advance Email Reminder
      if (diffHours > 24 && diffHours <= 48 && !task.email48hSent) {
        taskUpdates[idx] = { ...taskUpdates[idx], email48hSent: true };
        updatedTasks = true;

        const recipient = preferences.recipientEmail || user?.email;
        if (token && recipient) {
          try {
            await sendGmailAlert(
              token,
              recipient,
              `[48-Hour Reminder] Deliverable "${task.title}" is due in 2 days`,
              `<div style="font-family: sans-serif; background: #000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
                <h2 style="color: #38bdf8; margin-top: 0;">48-Hour Deadline Reminder</h2>
                <p>Your deliverable <strong>${task.title}</strong> is scheduled for completion in <strong>2 days</strong>.</p>
                <div style="margin: 16px 0; padding: 16px; background: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
                  <p style="margin: 4px 0;"><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <p style="margin: 4px 0;"><strong>Priority:</strong> ${task.priority.toUpperCase()}</p>
                  <p style="margin: 4px 0;"><strong>Owner:</strong> ${task.assignee?.name}</p>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">Automated reminder dispatched via Google Workspace Gmail API.</p>
              </div>`
            );
            addLog(
              '48-Hour Automated Email Reminder',
              `Sent 48-hour advance deadline email alert for "${task.title}" to ${recipient}.`,
              'success',
              task.title,
              task.id
            );
          } catch (e: any) {
            console.error('Failed to dispatch 48h email alert:', e);
          }
        }
      }

      // Check 2: 24-Hour Urgent Email Reminder
      if (diffHours > 0 && diffHours <= 24 && !task.email24hSent) {
        taskUpdates[idx] = { ...taskUpdates[idx], email24hSent: true };
        updatedTasks = true;

        const recipient = preferences.recipientEmail || user?.email;
        if (token && recipient) {
          try {
            await sendGmailAlert(
              token,
              recipient,
              `[24-Hour Urgent Warning] Deliverable "${task.title}" is due tomorrow`,
              `<div style="font-family: sans-serif; background: #000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #ef4444;">
                <h2 style="color: #ef4444; margin-top: 0;">24-Hour Urgent Deadline Warning</h2>
                <p>Urgent alert: Your deliverable <strong>${task.title}</strong> is due in <strong>less than 24 hours</strong>!</p>
                <div style="margin: 16px 0; padding: 16px; background: #1e1015; border-radius: 8px; border: 1px solid #881337;">
                  <p style="margin: 4px 0; color: #f87171;"><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <p style="margin: 4px 0;"><strong>Priority:</strong> URGENT</p>
                  <p style="margin: 4px 0;"><strong>Owner:</strong> ${task.assignee?.name}</p>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">Automated urgent reminder dispatched via Google Workspace Gmail API.</p>
              </div>`
            );
            addLog(
              '24-Hour Automated Email Warning',
              `Sent 24-hour urgent deadline warning email for "${task.title}" to ${recipient}.`,
              'warning',
              task.title,
              task.id
            );
          } catch (e: any) {
            console.error('Failed to dispatch 24h email alert:', e);
          }
        }
      }

      // Check 3: Auto-escalate threshold (<4h by default)
      if (
        preferences.autoEscalateOverdue &&
        diffHours > 0 &&
        diffHours <= preferences.autoEscalateHoursThreshold &&
        task.priority !== 'urgent'
      ) {
        taskUpdates[idx] = {
          ...taskUpdates[idx],
          priority: 'urgent',
          escalated: true,
        };
        updatedTasks = true;

        if (preferences.audioChimesEnabled) {
          sounds.playUrgentAlert();
        }

        addLog(
          'Auto-Escalation Engine',
          `Task deadline is within ${preferences.autoEscalateHoursThreshold}h (due in ${diffHours.toFixed(1)}h). Priority promoted to URGENT.`,
          'warning',
          task.title,
          task.id
        );

        addNotification(
          'Auto-Escalated to Urgent',
          `"${task.title}" is due in ${diffHours.toFixed(1)} hours and was automatically promoted to Urgent status.`,
          'escalation',
          task.id
        );
      }
    }

    if (updatedTasks && user) {
      for (const t of taskUpdates) {
        // Only write if this specific task was updated (diff check or just write all modified ones)
        // To be safe and simple, we'll write all but ideally only the changed ones.
        // Actually, let's find which ones changed by comparing with the original 'tasks'
        const original = tasks.find(ot => ot.id === t.id);
        if (original && JSON.stringify(original) !== JSON.stringify(t)) {
          const taskDoc = doc(db, `users/${user.uid}/tasks`, t.id);
          await setDoc(taskDoc, t).catch(e => handleFirestoreError(e, OperationType.UPDATE, taskDoc.path));
        }
      }
    }

    // Check for external calendar events that aren't task-synced
    if (preferences.remindCalendarExternalEvents && calendarEvents.length > 0 && token) {
      const recipient = preferences.recipientEmail || user?.email;
      if (recipient) {
        let remindedIds = { ...externalEventsReminded };
        let changedReminders = false;

        for (const evt of calendarEvents) {
          // Skip if already reminded or if it's a task event (starts with [Task])
          if (remindedIds[evt.id] || evt.summary.startsWith('[Task]')) continue;

          // Check if this event ID is linked to any of our tasks
          const isLinkedToTask = tasks.some(t => t.calendarEventId === evt.id);
          if (isLinkedToTask) continue;

          const startRaw = evt.start?.dateTime || evt.start?.date;
          if (!startRaw) continue;

          const startTime = new Date(startRaw).getTime();
          const hrsToStart = (startTime - now) / (1000 * 60 * 60);

          // Remind for external events due in 24 hours
          if (hrsToStart > 0 && hrsToStart <= 24) {
            try {
              await sendGmailAlert(
                token,
                recipient,
                `[Personal Calendar Alert] "${evt.summary}" is starting in less than 24 hours`,
                `<div style="font-family: sans-serif; background: #000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #38bdf8;">
                  <h2 style="color: #38bdf8; margin-top: 0;">Personal Calendar Reminder</h2>
                  <p>Your calendar event <strong>${evt.summary}</strong> is starting <strong>tomorrow</strong>.</p>
                  <div style="margin: 16px 0; padding: 16px; background: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
                    <p style="margin: 4px 0;"><strong>Event:</strong> ${evt.summary}</p>
                    <p style="margin: 4px 0;"><strong>Start Time:</strong> ${new Date(startRaw).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p style="font-size: 11px; color: #64748b;">This reminder is for a personal calendar entry not managed as a specific TaskOwl deliverable.</p>
                </div>`
              );

              remindedIds[evt.id] = true;
              changedReminders = true;

              addLog(
                'Personal Calendar Reminder',
                `Sent 24h advance alert for external event "${evt.summary}" to ${recipient}.`,
                'info',
                evt.summary
              );

              addNotification(
                'Personal Event Reminder',
                `"${evt.summary}" is starting in less than 24 hours.`,
                'email_sent'
              );
            } catch (e) {
              console.error('Failed to dispatch external calendar email:', e);
            }
          }
        }

        if (changedReminders) {
          setExternalEventsReminded(remindedIds);
        }
      }
    }
  }, [tasks, preferences, user, addLog, addNotification, calendarEvents, externalEventsReminded]);

  // Run heartbeat on interval (30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      runHeartbeat();
    }, 30000);
    return () => clearInterval(timer);
  }, [runHeartbeat]);

  // Synchronize single task to Google Calendar
  const handleSyncTaskToCalendar = async (task: Task) => {
    const token = await getAccessToken();
    if (!token || !user) {
      // Prompt user to sign in
      showBanner('Please connect your Google account in the top bar to sync with Google Calendar.', 'warning');
      return;
    }

    try {
      const result = await createCalendarEvent(token, task, preferences.calendarReminderMinutes);
      const updatedTask = {
        ...task,
        syncedToCalendar: true,
        calendarEventId: result.id,
        calendarEventUrl: result.htmlLink,
      };
      
      const taskDoc = doc(db, `users/${user.uid}/tasks`, task.id);
      await setDoc(taskDoc, updatedTask).catch(e => handleFirestoreError(e, OperationType.UPDATE, taskDoc.path));

      if (preferences.audioChimesEnabled) {
        sounds.playCalendarSyncChime();
      }

      addLog(
        'Google Calendar Sync',
        `Successfully synced event with ${preferences.calendarReminderMinutes}m popup alert.`,
        'success',
        task.title,
        task.id
      );

      addNotification(
        'Synced to Google Calendar',
        `"${task.title}" is now on your Google Calendar with reminders.`,
        'calendar_sync',
        task.id
      );

      showBanner(`"${task.title}" synced to Google Calendar.`);
      await loadCalendarEvents(token);
    } catch (err: any) {
      console.error('Calendar sync error:', err);
      showBanner(`Calendar sync failed: ${err?.message || 'Check permissions'}`, 'warning');
    }
  };

  // Dispatch all unsynced upcoming deliverables to Google Calendar
  const handleDispatchAllToCalendar = async () => {
    const token = await getAccessToken();
    if (!token || !user) {
      showBanner('Please sign in with Google in the top bar to sync all deliverables.', 'warning');
      return;
    }

    const unsynced = tasks.filter((t) => !t.syncedToCalendar && t.lane !== 'done');
    if (unsynced.length === 0) {
      showBanner('All upcoming deliverables are already synced to Google Calendar.', 'info');
      return;
    }

    let successCount = 0;
    const updated = [...tasks];

    for (const item of unsynced) {
      try {
        const res = await createCalendarEvent(token, item, preferences.calendarReminderMinutes);
        const updatedTask = {
          ...item,
          syncedToCalendar: true,
          calendarEventId: res.id,
          calendarEventUrl: res.htmlLink,
        };
        const taskDoc = doc(db, `users/${user.uid}/tasks`, item.id);
        await setDoc(taskDoc, updatedTask);
        successCount++;
      } catch (e) {
        console.error('Batch sync error for task:', item.title, e);
      }
    }
    if (preferences.audioChimesEnabled) {
      sounds.playSuccessChime();
    }
    showBanner(`Successfully synced ${successCount} deliverable(s) to Google Calendar.`);
    await loadCalendarEvents(token);
  };

  // Send real Morning Executive Digest via Gmail API
  const handleSendMorningDigestEmail = async () => {
    const token = await getAccessToken();
    if (!token || !user) {
      showBanner('Connect Google Workspace in the top bar to send real Gmail digests.', 'warning');
      return;
    }

    const recipient = preferences.recipientEmail || user?.email;
    if (!recipient) {
      showBanner('Please connect your Google account or provide a recipient email address.', 'warning');
      return;
    }
    const upcoming = tasks.filter((t) => t.lane !== 'done');
    const urgent = upcoming.filter((t) => t.priority === 'urgent');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000000; color: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #334155;">
        <h2 style="color: #eab308; margin-top: 0;">TaskOwl | Daily Executive Digest</h2>
        <p style="font-size: 14px; color: #94a3b8;">Here is your executive deliverable briefing for <strong>${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
        
        <div style="margin: 20px 0; padding: 16px; background: #0f172a; border-radius: 6px; border: 1px solid #1e293b;">
          <h3 style="margin-top: 0; font-size: 14px; color: #38bdf8;">Executive Summary</h3>
          <p style="font-size: 13px; line-height: 1.5; margin: 0; color: #e2e8f0;">You have <strong>${upcoming.length} open deliverables</strong> scheduled across active sprints, with <strong>${urgent.length} marked urgent</strong>.</p>
        </div>

        <h3 style="font-size: 14px; color: #38bdf8; margin-top: 24px;">Active Deliverables</h3>
        <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
              <th style="padding: 8px 4px;">Task</th>
              <th style="padding: 8px 4px;">Priority</th>
              <th style="padding: 8px 4px;">Deadline</th>
            </tr>
          </thead>
          <tbody>
            ${upcoming
              .slice(0, 8)
              .map(
                (t) => `
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 10px 4px; color: #f8fafc;"><strong>${t.title}</strong></td>
                <td style="padding: 10px 4px; color: ${t.priority === 'urgent' ? '#ef4444' : '#38bdf8'}; text-transform: uppercase;">${t.priority}</td>
                <td style="padding: 10px 4px; color: #cbd5e1;">${new Date(t.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <p style="font-size: 11px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">
          Dispatched in real-time by TaskOwl.
        </p>
      </div>
    `;

    await sendGmailAlert(
      token,
      recipient,
      `[TaskOwl Executive Digest] Deliverable Summary for ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
      htmlBody
    );

    addLog(
      'Daily Morning Executive Digest',
      `Dispatched real-time Gmail digest to ${recipient}.`,
      'success'
    );

    addNotification(
      'Morning Digest Dispatched',
      `Delivered sprint digest to ${recipient} via Gmail.`,
      'email_sent'
    );
  };

  // Save Task (Create or Update)
  const handleSaveTask = async (taskData: Partial<Task>, syncDirectly: boolean) => {
    if (!user) return;
    const userId = user.uid;

    if (editingTask) {
      const updated = { ...editingTask, ...taskData } as Task;
      const taskDoc = doc(db, `users/${userId}/tasks`, editingTask.id);
      try {
        await setDoc(taskDoc, updated);
        showBanner(`Updated "${taskData.title}"`);
        if (syncDirectly && !editingTask.syncedToCalendar) {
          await handleSyncTaskToCalendar(updated);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
      }
    } else {
      const taskId = `task-${Date.now()}`;
      const newTask: Task = {
        id: taskId,
        title: taskData.title || 'Untitled Deliverable',
        description: taskData.description || '',
        lane: taskData.lane || defaultModalLane,
        priority: taskData.priority || 'medium',
        originalPriority: taskData.priority || 'medium',
        deadline: taskData.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        estimatedHours: taskData.estimatedHours || 2,
        assignee: taskData.assignee || {
          name: user?.displayName || 'Lead Architect',
          role: 'Staff Architect',
          initials: (user?.displayName || 'Lead Architect')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
        },
        tags: taskData.tags || ['Agile'],
        syncedToCalendar: false,
        escalated: false,
        createdAt: new Date().toISOString(),
      };

      const taskDoc = doc(db, `users/${userId}/tasks`, taskId);
      try {
        await setDoc(taskDoc, { ...newTask, createdAt: new Date().toISOString() }); // Use client side string for now to match rules logic or update rules
        showBanner(`Created deliverable "${newTask.title}"`);
        if (syncDirectly) {
          await handleSyncTaskToCalendar(newTask);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, taskDoc.path);
      }
    }
  };

  // Move task lane in Kanban
  const handleUpdateTaskLane = async (taskId: string, newLane: LaneType) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskDoc = doc(db, `users/${user.uid}/tasks`, taskId);
    try {
      await setDoc(taskDoc, {
        ...task,
        lane: newLane,
        completedAt: newLane === 'done' ? new Date().toISOString() : undefined,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
    }
  };

  // Inline quick task add from MainTableView
  const handleAddNewTaskInline = async (
    title: string,
    lane: LaneType = 'backlog',
    priority: PriorityType = 'medium',
    dueDate?: string
  ) => {
    if (!user) return;
    const taskId = `task-${Date.now()}`;
    const newTask: Task = {
      id: taskId,
      title,
      description: '',
      lane,
      priority,
      originalPriority: priority,
      deadline: dueDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      estimatedHours: 2,
      assignee: {
        name: user?.displayName || 'Workspace Owner',
        role: 'Owner',
        initials: (user?.displayName || 'Workspace Owner')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      },
      tags: ['Daily Life'],
      syncedToCalendar: false,
      escalated: false,
      createdAt: new Date().toISOString(),
    };

    const taskDoc = doc(db, `users/${user.uid}/tasks`, taskId);
    console.log('Attempting to create task:', newTask);
    try {
      await setDoc(taskDoc, newTask);
      console.log('Task successfully created in Firestore:', taskId);
      showBanner(`Created "${title}"`);
    } catch (e) {

      handleFirestoreError(e, OperationType.CREATE, taskDoc.path);
    }
  };

  // Direct priority toggle from MainTableView
  const handleUpdateTaskPriority = async (taskId: string, newPriority: PriorityType) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskDoc = doc(db, `users/${user.uid}/tasks`, taskId);
    try {
      await setDoc(taskDoc, { ...task, priority: newPriority });
      showBanner(`Updated priority to ${newPriority.toUpperCase()}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
    }
  };

  // Reschedule deadline (e.g., drag and drop on calendar view)
  const handleUpdateTaskDeadline = async (taskId: string, newDeadlineIso: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskDoc = doc(db, `users/${user.uid}/tasks`, taskId);
    try {
      await setDoc(taskDoc, { ...task, deadline: newDeadlineIso });
      const dateStr = new Date(newDeadlineIso).toLocaleDateString([], { month: 'short', day: 'numeric' });
      showBanner(`Rescheduled task to ${dateStr}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
    }
  };

  // Reorder tasks in list via drag and drop
  const handleReorderTasks = (draggedTaskId: string, targetTaskId: string) => {
    setTasks((prev) => {
      const draggedIdx = prev.findIndex((t) => t.id === draggedTaskId);
      const targetIdx = prev.findIndex((t) => t.id === targetTaskId);
      if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return prev;

      const next = [...prev];
      const [removed] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, removed);
      return next;
    });
  };

  // Delete task with confirmation


  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.task || !user) return;
    const taskToDelete = deleteConfirmation.task;

    // If synced to Google Calendar, remove event if token is available
    if (taskToDelete.syncedToCalendar && taskToDelete.calendarEventId) {
      const token = await getAccessToken();
      if (token) {
        try {
          await deleteCalendarEvent(token, taskToDelete.calendarEventId);
        } catch (e) {
          console.warn('Failed to delete Google Calendar event:', e);
        }
      }
    }

    const taskDoc = doc(db, `users/${user.uid}/tasks`, taskToDelete.id);
    try {
      await deleteDoc(taskDoc);
      showBanner(`Deleted "${taskToDelete.title}"`, 'info');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, taskDoc.path);
    }
    
    setDeleteConfirmation({ isOpen: false, task: null });
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
        <div className="relative group">
          <div className="absolute -inset-4 bg-amber-500/20 rounded-3xl blur-2xl animate-pulse" />
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl shadow-amber-950/70 ring-1 ring-white/10">
            <img
              src="/assets/taskowl/logo.jpg"
              alt="TaskOwl"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="mt-7 flex flex-col items-center gap-3">
          <div className="w-36 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-amber-500 rounded-full animate-pulse" />
          </div>
          <span className="text-[11px] font-mono text-zinc-400 font-semibold tracking-widest uppercase">
            Booting TaskOwl...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      {/* Toast Notification Banner */}
      {bannerNotice && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
          <span
            className={`w-2 h-2 rounded-full ${
              bannerNotice.type === 'warning'
                ? 'bg-amber-400'
                : bannerNotice.type === 'info'
                ? 'bg-[var(--accent-secondary)]'
                : 'bg-[var(--accent-primary)]'
            }`}
          />
          <span>{bannerNotice.message}</span>
        </div>
      )}

      {/* Strict 3-Zone Top Navigation Bar */}
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={customization.themeMode}
        accentColor={customization.accentColor}
        onToggleTheme={handleToggleTheme}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}

        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        unreadCount={notifications.filter((n) => !n.read).length}
        onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        onOpenNewTaskModal={() => {
          setEditingTask(null);
          setDefaultModalLane('backlog');
          setIsTaskModalOpen(true);
        }}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'table' && (
          <MainTableView
            tasks={tasks}
            customization={customization}
            isGoogleConnected={!!user}
            onUpdateTaskLane={handleUpdateTaskLane}
            onUpdateTaskPriority={handleUpdateTaskPriority}
            onUpdateTaskDeadline={handleUpdateTaskDeadline}
            onSyncTaskToCalendar={handleSyncTaskToCalendar}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onRequestDeleteTask={(task) => {
              setDeleteConfirmation({ isOpen: true, task });
            }}
            onAddNewTaskInline={handleAddNewTaskInline}
            onOpenNewTaskModal={(defaultLane = 'backlog') => {
              setEditingTask(null);
              setDefaultModalLane(defaultLane);
              setIsTaskModalOpen(true);
            }}
            onNavigateToAutomations={() => setActiveTab('automations')}
            onNavigateToCalendar={() => setActiveTab('calendar')}
          />
        )}

        {activeTab === 'dashboard' && (
          <ExecutiveDashboard
            tasks={tasks}
            preferences={preferences}
            logs={logs}
            customization={customization}
            isGoogleConnected={!!user}
            onSyncTaskToCalendar={handleSyncTaskToCalendar}
            onDispatchAllToCalendar={handleDispatchAllToCalendar}
            onSendMorningDigestEmail={handleSendMorningDigestEmail}
            onNavigateToKanban={() => setActiveTab('kanban')}
            onNavigateToAutomations={() => setActiveTab('automations')}
            onNavigateToCalendar={() => setActiveTab('calendar')}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
            onUpdateCustomization={handleUpdateCustomization}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanBoard
            tasks={tasks}
            customization={customization}
            onUpdateTaskLane={handleUpdateTaskLane}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onRequestDeleteTask={(task) => {
              setDeleteConfirmation({ isOpen: true, task });
            }}
            onSyncTaskToCalendar={handleSyncTaskToCalendar}
            onOpenNewTaskModal={(defaultLane = 'backlog') => {
              setEditingTask(null);
              setDefaultModalLane(defaultLane);
              setIsTaskModalOpen(true);
            }}
            onUpdateCustomization={handleUpdateCustomization}
            onReorderTasks={handleReorderTasks}
          />
        )}

        {activeTab === 'automations' && (
          <AutomationsHub
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            logs={logs}
            onClearLogs={async () => {
              if (!user) return;
              for (const log of logs) {
                const logDoc = doc(db, `users/${user.uid}/logs`, log.id);
                await deleteDoc(logDoc).catch(e => handleFirestoreError(e, OperationType.DELETE, logDoc.path));
              }
              showBanner('Automation execution logs cleared.', 'info');
            }}
            onTriggerHeartbeatNow={() => {
              runHeartbeat();
              showBanner('Executed manual heartbeat check across all deliverables.');
            }}
            onSimulateAlarm={(type) => {
              if (type === '1h') {
                if (preferences.audioChimesEnabled) sounds.playUrgentAlert();
                addLog('Simulated 1h Emergency Alarm', 'Manually triggered emergency alarm test.', 'warning');
                addNotification('1-Hour Emergency Deadline Alarm', 'Simulated emergency deadline alert for testing.', 'emergency_1h');
              } else if (type === '24h') {
                addLog('Simulated 24h Impending Alert', 'Manually triggered 24h deliverable alert.', 'info');
                addNotification('24-Hour Deliverable Approaching', 'Simulated 24-hour reminder alert for testing.', 'warning_24h');
              } else {
                addLog('Simulated Escalation', 'Manually triggered priority escalation test.', 'warning');
                addNotification('Task Escalated to Urgent', 'Simulated auto-escalation trigger for testing.', 'escalation');
              }
              showBanner(`Triggered simulated ${type} alert.`);
            }}
            onSendTestEmail={async () => {
              const token = await getAccessToken();
              if (!token || !user) {
                showBanner('Connect Google in the top bar to dispatch real emails.', 'warning');
                return;
              }
              const recipient = preferences.recipientEmail || user?.email;
              if (!recipient) {
                showBanner('Please connect your Google account or enter a recipient email.', 'warning');
                return;
              }
              await sendGmailAlert(
                token,
                recipient,
                '[Test Alert] TaskOwl Automation Engine',
                `<div style="font-family: sans-serif; background: #000000; color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                  <h2 style="color: #eab308;">TaskOwl Automation Engine Verification</h2>
                  <p>This is a real-time test notification sent via Google Workspace Gmail API integration to ${recipient}.</p>
                  <p>All automated deadline reminders will be routed to this inbox.</p>
                </div>`
              );
              showBanner(`Test email sent to ${recipient}`);
            }}
            isGoogleConnected={!!user}
            userEmail={user?.email || null}
            tasks={tasks}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarScheduleView
            tasks={tasks}
            calendarEvents={calendarEvents}
            isLoadingEvents={isLoadingEvents}
            isGoogleConnected={!!user}
            onRefreshEvents={async () => {
              const token = await getAccessToken();
              if (token) await loadCalendarEvents(token);
            }}
            onSyncTaskToCalendar={handleSyncTaskToCalendar}
            onDispatchAllToCalendar={handleDispatchAllToCalendar}
            onSignIn={handleSignIn}
            onEditTask={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Task Creation / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        isGoogleConnected={!!user}
        defaultAssigneeName={user?.displayName || 'Lead Architect'}
      />

      {/* Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        onMarkAsRead={async (id) => {
          if (!user) return;
          const n = notifications.find(notif => notif.id === id);
          if (!n) return;
          const notifDoc = doc(db, `users/${user.uid}/notifications`, id);
          try {
            await setDoc(notifDoc, { ...n, read: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, notifDoc.path);
          }
        }}
        onMarkAllAsRead={async () => {
          if (!user) return;
          for (const n of notifications) {
            if (!n.read) {
              const notifDoc = doc(db, `users/${user.uid}/notifications`, n.id);
              await setDoc(notifDoc, { ...n, read: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, notifDoc.path));
            }
          }
          showBanner('All notifications marked as read.', 'info');
        }}
        onClearAll={async () => {
          if (!user) return;
          for (const n of notifications) {
            const notifDoc = doc(db, `users/${user.uid}/notifications`, n.id);
            await deleteDoc(notifDoc).catch(e => handleFirestoreError(e, OperationType.DELETE, notifDoc.path));
          }
          showBanner('Notification history cleared.', 'info');
        }}
        onSelectTask={(taskId) => {
          const t = tasks.find((item) => item.id === taskId);
          if (t) {
            setEditingTask(t);
            setIsTaskModalOpen(true);
          }
        }}
      />

      {/* Destructive Operation Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Delete Deliverable Task?"
        message={
          deleteConfirmation.task?.syncedToCalendar
            ? `Are you sure you want to delete "${deleteConfirmation.task?.title}"? This will also remove the scheduled event from your Google Calendar.`
            : `Are you sure you want to delete "${deleteConfirmation.task?.title}"? This action cannot be undone.`
        }
        confirmLabel="Delete Task"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, task: null })}
      />

      {/* Dashboard & Theme Personalization Customizer Modal */}
      <DashboardCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        customization={customization}
        onUpdateCustomization={handleUpdateCustomization}
        onResetDefaults={handleResetCustomization}
      />
    </div>
  );
}

