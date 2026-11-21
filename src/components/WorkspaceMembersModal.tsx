import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  Mail,
  Trash2,
  Check,
  Building2,
  Plus,
  Edit3,
  Shield,
  Send,
  AlertCircle,
  Link2,
  Copy,
  RefreshCw,
  Globe,
  Link2Off,
} from 'lucide-react';
import { Workspace, WorkspaceMember, Task } from '../types';

interface WorkspaceMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserUid: string | null;
  currentUserEmail: string | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  members: WorkspaceMember[];
  tasks: Task[];
  hasGmailToken: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onRenameWorkspace: (workspaceId: string, newName: string) => Promise<void>;
  onAddMember: (
    email: string,
    name?: string,
    role?: string,
    sendInviteEmail?: boolean
  ) => Promise<void>;
  onRemoveMember: (member: WorkspaceMember) => Promise<void>;
  onEnableShareLink: (workspaceId: string) => Promise<string | null>;
  onRegenerateShareLink: (workspaceId: string) => Promise<string | null>;
  onDisableShareLink: (workspaceId: string) => Promise<void>;
  onSignIn: () => void;
  focusShareSection?: boolean;
}

export const WorkspaceMembersModal: React.FC<WorkspaceMembersModalProps> = ({
  isOpen,
  onClose,
  currentUserUid,
  currentUserEmail,
  workspaces,
  activeWorkspace,
  members,
  tasks,
  hasGmailToken,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onAddMember,
  onRemoveMember,
  onEnableShareLink,
  onRegenerateShareLink,
  onDisableShareLink,
  onSignIn,
  focusShareSection = false,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [sendEmailInvite, setSendEmailInvite] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const [isRenamingWs, setIsRenamingWs] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const shareSectionRef = React.useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && focusShareSection && shareSectionRef.current) {
      shareSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isOpen, focusShareSection]);

  if (!isOpen) return null;

  const isOwner = Boolean(
    currentUserUid && activeWorkspace && activeWorkspace.ownerId === currentUserUid
  );

  const shareUrl =
    activeWorkspace?.shareEnabled && activeWorkspace?.shareToken
      ? `${window.location.origin}${window.location.pathname}?share=${activeWorkspace.shareToken}`
      : '';

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setError('Could not copy automatically. Please select the link and copy it manually.');
    }
  };

  const handleEnableShare = async () => {
    if (!activeWorkspace) return;
    setError(null);
    setSuccessMsg(null);
    setIsUpdatingShare(true);
    try {
      const token = await onEnableShareLink(activeWorkspace.id);
      if (token) {
        const generatedUrl = `${window.location.origin}${window.location.pathname}?share=${token}`;
        await copyToClipboard(generatedUrl);
        setSuccessMsg('Share link generated and copied to clipboard.');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate share link.');
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const handleRegenerateShare = async () => {
    if (!activeWorkspace) return;
    setError(null);
    setSuccessMsg(null);
    setIsUpdatingShare(true);
    try {
      const token = await onRegenerateShareLink(activeWorkspace.id);
      if (token) {
        const generatedUrl = `${window.location.origin}${window.location.pathname}?share=${token}`;
        await copyToClipboard(generatedUrl);
        setSuccessMsg('Generated a new share link and invalidated the previous one.');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to regenerate share link.');
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const handleDisableShare = async () => {
    if (!activeWorkspace) return;
    setError(null);
    setSuccessMsg(null);
    setIsUpdatingShare(true);
    try {
      await onDisableShareLink(activeWorkspace.id);
      setSuccessMsg('Link sharing disabled. Only invited email members can access this workspace.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to disable share link.');
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (members.some((m) => m.email.toLowerCase() === trimmedEmail)) {
      setError(`${trimmedEmail} is already a member of this workspace.`);
      return;
    }

    setIsAddingMember(true);
    try {
      await onAddMember(
        trimmedEmail,
        inviteName.trim() || undefined,
        inviteRole.trim() || 'Member',
        hasGmailToken && sendEmailInvite
      );
      setInviteEmail('');
      setInviteName('');
      setInviteRole('Member');
      setSuccessMsg(`Added ${trimmedEmail} to ${activeWorkspace?.name || 'workspace'}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to add member to workspace.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleCreateWsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setError(null);
    try {
      await onCreateWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsCreatingWs(false);
      setSuccessMsg('Created new shared workspace.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace.');
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !renameValue.trim()) return;
    setError(null);
    try {
      await onRenameWorkspace(activeWorkspace.id, renameValue.trim());
      setIsRenamingWs(false);
      setSuccessMsg('Workspace renamed.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to rename workspace.');
    }
  };

  const getAssignedTaskCount = (member: WorkspaceMember) => {
    const emailLower = member.email.toLowerCase();
    const nameLower = member.name.toLowerCase();
    return tasks.filter((t) => {
      if (t.assignee.email && t.assignee.email.toLowerCase() === emailLower) return true;
      return t.assignee.name.toLowerCase() === nameLower;
    }).length;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border-strong)] card-sheen shadow-2xl relative p-6 space-y-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-md"
          aria-label="Close workspace dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="pr-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">
                Workspace &amp; Team Members
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Add collaborators by email so they can access this workspace and be assigned tasks.
              </p>
            </div>
          </div>
        </div>

        {!currentUserUid ? (
          <div className="space-y-4">
            {shareUrl && activeWorkspace && (
              <div
                ref={shareSectionRef}
                className="p-4 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--accent-primary)]/40 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Shared Workspace Link</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">Active · Open Access</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Anyone with this link can open and collaborate on <strong>{activeWorkspace.name}</strong> without restrictions.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(shareUrl)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 flex items-center gap-1.5 shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-center space-y-3">
              <p className="text-sm text-[var(--text-primary)] font-medium">
                Sign in with Google to create your own workspaces, manage share settings, or invite teammates by email.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 transition-all"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Workspace Switcher & Create */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Building2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Your Workspaces ({workspaces.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingWs((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Workspace
                </button>
              </div>

              {isCreatingWs && (
                <form onSubmit={handleCreateWsSubmit} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g. Product Launch Team"
                    maxLength={120}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90"
                  >
                    Create
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {workspaces.map((ws) => {
                  const isActive = activeWorkspace?.id === ws.id;
                  const owned = ws.ownerId === currentUserUid;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => onSelectWorkspace(ws.id)}
                      className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-high)] ring-1 ring-[var(--accent-primary)]/30'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {ws.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                          {owned ? 'Owner' : `Shared by ${ws.ownerEmail.split('@')[0]}`} ·{' '}
                          {ws.memberEmails.length} {ws.memberEmails.length === 1 ? 'member' : 'members'}
                        </div>
                      </div>
                      {isActive && (
                        <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {activeWorkspace && isOwner && (
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  {isRenamingWs ? (
                    <form onSubmit={handleRenameSubmit} className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="Workspace name"
                        maxLength={120}
                        className="flex-1 px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRenamingWs(false)}
                        className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                        Active: {activeWorkspace.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameValue(activeWorkspace.name);
                          setIsRenamingWs(true);
                        }}
                        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                      >
                        <Edit3 className="w-3 h-3" />
                        Rename
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Share Workspace via Unrestricted Link */}
            {activeWorkspace && (
              <div
                ref={shareSectionRef}
                className={`p-4 rounded-xl bg-[var(--bg-surface-lowest)] border space-y-3 transition-colors ${
                  focusShareSection
                    ? 'border-[var(--accent-primary)]/60 ring-1 ring-[var(--accent-primary)]/20'
                    : 'border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    <Link2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Share Workspace via Link</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-semibold flex items-center gap-1 ${
                      shareUrl ? 'text-emerald-400' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    {shareUrl ? 'Anyone with link · No restrictions' : 'Private (Link off)'}
                  </span>
                </div>

                {shareUrl ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Share this link with anyone. Recipients can open <strong>{activeWorkspace.name}</strong> and view, create, edit, or update tasks immediately without sign-in or email restrictions.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label="Generated workspace share link"
                        className="flex-1 px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(shareUrl)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>

                    {isOwner && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Regenerating creates a fresh URL and invalidates the previous link.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUpdatingShare}
                            onClick={handleRegenerateShare}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={`w-3 h-3 ${isUpdatingShare ? 'animate-spin' : ''}`} />
                            Regenerate Link
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingShare}
                            onClick={handleDisableShare}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            <Link2Off className="w-3 h-3" />
                            Disable Link
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {isOwner
                        ? 'Generate an unrestricted share link so anyone you send it to can access and collaborate in this workspace.'
                        : `Link sharing is currently turned off. Ask the owner (${activeWorkspace.ownerEmail}) to generate a share link.`}
                    </p>
                    {isOwner && (
                      <button
                        type="button"
                        disabled={isUpdatingShare}
                        onClick={handleEnableShare}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        {isUpdatingShare ? 'Generating...' : 'Generate Share Link'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Add Person by Email Form */}
            {isOwner ? (
              <form
                onSubmit={handleInviteSubmit}
                className="p-4 rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <UserPlus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Add Person to Workspace by Email</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@gmail.com"
                        maxLength={254}
                        className="w-full pl-8 pr-2.5 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Auto from email if blank"
                      maxLength={120}
                      className="w-full px-2.5 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      placeholder="Member"
                      maxLength={80}
                      className="w-full px-2.5 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasGmailToken && sendEmailInvite}
                      disabled={!hasGmailToken}
                      onChange={(e) => setSendEmailInvite(e.target.checked)}
                      className="rounded border-[var(--border-strong)] text-[var(--accent-primary)]"
                    />
                    <Send className="w-3 h-3 text-[var(--accent-secondary)]" />
                    <span>
                      {hasGmailToken
                        ? 'Send workspace invite email via Gmail'
                        : 'Grant Gmail access on sign-in to also send invite emails'}
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isAddingMember ? 'Adding...' : 'Add to Workspace'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span>
                  Only the workspace owner ({activeWorkspace?.ownerEmail}) can add or remove members. You can view and assign tasks to any member below.
                </span>
              </div>
            )}

            {/* Members Directory */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Workspace Members ({members.length})
                </h3>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Signed-in Google accounts with these emails share this workspace
                </span>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] overflow-hidden">
                {members.map((member) => {
                  const isSelf =
                    currentUserEmail &&
                    member.email.toLowerCase() === currentUserEmail.toLowerCase();
                  const assignedCount = getAssignedTaskCount(member);

                  return (
                    <div
                      key={member.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[var(--bg-surface-high)]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-8 h-8 rounded-full object-cover border border-[var(--border-subtle)] shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--accent-container)] text-white text-xs font-bold font-mono flex items-center justify-center shrink-0">
                            {member.initials}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] truncate">
                            <span className="truncate">{member.name}</span>
                            {isSelf && (
                              <span className="text-[10px] font-mono text-[var(--accent-primary)]">
                                (You)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono truncate">
                            <span className="truncate">{member.email}</span>
                            <span aria-hidden="true">·</span>
                            <span>{member.workspaceRole === 'owner' ? 'Workspace Owner' : member.role}</span>
                            <span aria-hidden="true">·</span>
                            <span>{assignedCount} {assignedCount === 1 ? 'task' : 'tasks'}</span>
                          </div>
                        </div>
                      </div>

                      {isOwner && member.workspaceRole !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member)}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                          title={`Remove ${member.email} from workspace`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
