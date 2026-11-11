import React from 'react';
import { User } from 'firebase/auth';
import {
  Layers,
  Calendar,
  Zap,
  Bell,
  Plus,
  Sun,
  Moon,
  Sliders,
  LogOut,
} from 'lucide-react';
import { ThemeMode } from '../types';

interface TopNavProps {
  activeTab: 'table' | 'dashboard' | 'kanban' | 'automations' | 'calendar';
  onSelectTab: (tab: 'table' | 'dashboard' | 'kanban' | 'automations' | 'calendar') => void;
  theme: ThemeMode;
  accentColor?: string;
  onToggleTheme: () => void;
  onOpenCustomizer: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenNewTaskModal: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  theme,
  accentColor,
  onToggleTheme,
  onOpenCustomizer,
  user,
  onSignIn,
  onSignOut,
  unreadCount,
  onOpenNotifications,
  onOpenNewTaskModal,
}) => {

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-xl px-4 sm:px-6 py-2.5 transition-colors duration-200">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 sm:gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-red-500/30 shadow-md ring-1 ring-black/40 shrink-0">
              <img
                src="/assets/oculis/logo.jpg"
                alt="Oculis"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 font-heading">
              Oculis
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] overflow-x-auto">
          <button
            onClick={() => onSelectTab('table')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'table'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Main Table
          </button>

          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Executive Dashboard
          </button>

          <button
            onClick={() => onSelectTab('kanban')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'kanban'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Kanban &amp; Charts
          </button>

          <button
            onClick={() => onSelectTab('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar Schedule
          </button>

          <button
            onClick={() => onSelectTab('automations')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'automations'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-subtle)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Automations &amp; Rules
          </button>
          </nav>
        </div>


        {/* Zone 3: Actions (Dark/White toggle, Customizer, Notifications, Google Auth, + Task) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Simple Dark vs White/Light Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
            title={theme === 'dark' ? 'Switch to White / Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Customize Dashboard Button */}
          <button
            onClick={onOpenCustomizer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all whitespace-nowrap"
            title="Customize Dashboard Layout & Palette Shades"
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-xs shrink-0"
              style={{ backgroundColor: accentColor || 'var(--accent-primary)' }}
            />
            <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden sm:inline font-mono text-[11px]">Palette</span>
          </button>


          {/* Notifications bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-text)] text-[10px] font-bold flex items-center justify-center font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Google Auth status or Sign In */}
          {user ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)]">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--accent-container)] text-white text-[10px] font-bold flex items-center justify-center font-mono">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden xl:inline text-xs font-medium text-[var(--text-primary)] max-w-[120px] truncate">
                {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
              </span>
              <button
                onClick={onSignOut}
                className="text-[var(--text-muted)] hover:text-red-500 p-0.5 ml-1 transition-colors"
                title="Disconnect Google Workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-strong)] bg-white text-slate-900 hover:bg-slate-100 shadow-sm transition-all whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Sign in with Google
            </button>
          )}

          {/* Primary Action Button */}
          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-text)] hover:opacity-90 shadow-md transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New Task
          </button>
        </div>
      </div>
    </header>
  );
};
