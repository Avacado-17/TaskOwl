export type LaneType = 'backlog' | 'in_progress' | 'review' | 'done';
export type PriorityType = 'low' | 'medium' | 'high' | 'urgent';
export type ThemeMode = 'dark' | 'light';
export type AccentColor = string;


export interface DashboardCustomization {
  themeMode: ThemeMode;
  accentColor: string; // Hex shade, e.g. '#38bdf8'
  accentLabel?: string; // Display label, e.g. 'Sky 400 (Vibrant)'
  density: 'comfortable' | 'compact';

  visibleWidgets: {
    kpiVelocity: boolean;
    kpiUrgent: boolean;
    kpiCalendar: boolean;
    kpiAutomations: boolean;
    taskVelocityChart: boolean;
    resourceAllocation: boolean;
    upcomingTimeline: boolean;
    morningDigest: boolean;
    workflowBreakdown: boolean;
    automationsHeartbeat: boolean;
  };
  widgetOrder?: string[];
  kpiOrder?: string[];
  kanbanLaneOrder?: LaneType[];
  tableColumnOrder?: string[];
}



export interface Assignee {
  name: string;
  role: string;
  avatar?: string;
  initials: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  lane: LaneType;
  priority: PriorityType;
  originalPriority?: PriorityType;
  deadline: string; // ISO date-time string
  estimatedHours: number;
  assignee: Assignee;
  tags: string[];
  syncedToCalendar: boolean;
  calendarEventId?: string;
  calendarEventUrl?: string;
  escalated: boolean;
  email48hSent?: boolean;
  email24hSent?: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface AutomationPreferences {
  notify24Hours: boolean;
  notify1Hour: boolean;
  autoEscalateOverdue: boolean;
  autoEscalateHoursThreshold: number; // e.g. 4 hours
  morningDigest: boolean;
  morningDigestTime: string; // "08:30"
  calendarReminderMinutes: number; // 10, 30, 60
  emailUpdatesEnabled: boolean;
  recipientEmail: string;
  audioChimesEnabled: boolean;
}

export interface AutomationLog {
  id: string;
  ruleName: string;
  taskId?: string;
  taskTitle?: string;
  triggeredAt: string;
  status: 'success' | 'warning' | 'info';
  details: string;
}

export interface InAppNotification {
  id: string;
  type: 'warning_24h' | 'emergency_1h' | 'escalation' | 'calendar_sync' | 'morning_digest' | 'email_sent';
  title: string;
  message: string;
  taskId?: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  isTaskSynced?: boolean;
}
