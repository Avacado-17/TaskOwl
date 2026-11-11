import { Task, AutomationPreferences, AutomationLog, InAppNotification, DashboardCustomization } from '../types';

const now = new Date();

export const INITIAL_PREFERENCES: AutomationPreferences = {
  notify24Hours: true,
  notify1Hour: true,
  autoEscalateOverdue: true,
  autoEscalateHoursThreshold: 4,
  morningDigest: true,
  morningDigestTime: '08:30',
  calendarReminderMinutes: 30,
  emailUpdatesEnabled: true,
  recipientEmail: '',
  audioChimesEnabled: true,
};

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_LOGS: AutomationLog[] = [];

export const INITIAL_NOTIFICATIONS: InAppNotification[] = [];

export const DEFAULT_CUSTOMIZATION: DashboardCustomization = {
  themeMode: 'dark',
  accentColor: '#38bdf8',
  accentLabel: 'Sky 400 (Vibrant Cyan)',
  density: 'comfortable',

  visibleWidgets: {
    kpiVelocity: true,
    kpiUrgent: true,
    kpiCalendar: true,
    kpiAutomations: true,
    taskVelocityChart: true,
    resourceAllocation: true,
    upcomingTimeline: true,
    morningDigest: true,
    workflowBreakdown: true,
    automationsHeartbeat: true,
  },
  widgetOrder: ['taskVelocityChart', 'resourceAllocation', 'upcomingTimeline', 'workflowBreakdown', 'morningDigest', 'automationsHeartbeat'],
  kpiOrder: ['kpiVelocity', 'kpiUrgent', 'kpiCalendar', 'kpiAutomations'],
  kanbanLaneOrder: ['backlog', 'in_progress', 'review', 'done'],
  tableColumnOrder: ['select', 'task', 'owner', 'status', 'deadline', 'priority', 'calendar', 'actions'],
};



