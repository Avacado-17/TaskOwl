export async function sendGmailAlert(
  accessToken: string,
  recipientEmail: string,
  subject: string,
  htmlContent: string
): Promise<{ id: string; threadId: string }> {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${recipientEmail}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlContent,
  ];

  const rawMessage = emailLines.join('\r\n');
  const base64Encoded = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Encoded }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email alert via Gmail: ${response.status} ${errorText}`);
  }

  return response.json();
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCustomReminderHtml(
  rawMessage: string | undefined,
  vars?: {
    taskTitle?: string;
    deadline?: string;
    priority?: string;
    owner?: string;
    recipientEmail?: string;
  }
): string {
  const trimmed = (rawMessage || '').trim();
  if (!trimmed) return '';

  let resolved = trimmed;
  if (vars?.taskTitle) resolved = resolved.replace(/\{task\}/gi, vars.taskTitle);
  if (vars?.deadline) resolved = resolved.replace(/\{deadline\}/gi, vars.deadline);
  if (vars?.priority) resolved = resolved.replace(/\{priority\}/gi, vars.priority);
  if (vars?.owner) resolved = resolved.replace(/\{owner\}/gi, vars.owner);
  if (vars?.recipientEmail) resolved = resolved.replace(/\{email\}/gi, vars.recipientEmail);

  return escapeHtml(resolved).replace(/\r?\n/g, '<br />');
}

