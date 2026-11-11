import { Task, GoogleCalendarEvent } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  const minDate = timeMin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const maxDate = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${CALENDAR_API_BASE}/events?timeMin=${encodeURIComponent(
    minDate
  )}&timeMax=${encodeURIComponent(
    maxDate
  )}&singleEvents=true&orderBy=startTime&maxResults=50`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch calendar events: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || '(Untitled Event)',
    description: item.description,
    start: item.start,
    end: item.end,
    htmlLink: item.htmlLink,
  }));
}

export async function createCalendarEvent(
  accessToken: string,
  task: Task,
  reminderMinutes = 30
): Promise<{ id: string; htmlLink?: string }> {
  const taskDeadline = new Date(task.deadline);
  // Default event length: estimatedHours or 1 hour
  const durationMs = Math.max(1, task.estimatedHours || 1) * 60 * 60 * 1000;
  const startTime = new Date(taskDeadline.getTime() - durationMs);

  const eventPayload = {
    summary: `[Task] ${task.title}`,
    description: `Priority: ${task.priority.toUpperCase()}\nLane: ${task.lane}\nEstimated: ${task.estimatedHours}h\nAssignee: ${task.assignee.name}\n\n${task.description || ''}\n\nManaged by TaskOwl.`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: taskDeadline.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: reminderMinutes },
        { method: 'email', minutes: Math.max(reminderMinutes, 60) },
      ],
    },
    colorId: task.priority === 'urgent' ? '11' : task.priority === 'high' ? '6' : '7', // Red, Orange, Peacock
  };

  const response = await fetch(`${CALENDAR_API_BASE}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create calendar event: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return { id: result.id, htmlLink: result.htmlLink };
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  const response = await fetch(`${CALENDAR_API_BASE}/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Failed to delete calendar event: ${response.status} ${errorText}`);
  }

  return true;
}
