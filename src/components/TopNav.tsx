import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Table2,
  LayoutDashboard,
  Kanban,
  Calendar,
  Zap,
  Bell,
  Plus,
  Sun,
  Moon,
  Sliders,
  LogOut,
  Users,
  Share2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
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
  activeWorkspaceName?: string;
  memberCount?: number;
  onOpenWorkspaceModal: () => void;
  onOpenShareModal?: () => void;
}

const NAV_ITEMS: Array<{
  id: 'table' | 'dashboard' | 'kanban' | 'calendar' | 'automations';
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'table', label: 'Main Table', shortLabel: 'Table', icon: Table2 },
  { id: 'dashboard', label: 'Executive Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { id: 'kanban', label: 'Kanban & Charts', shortLabel: 'Kanban', icon: Kanban },
  { id: 'calendar', label: 'Calendar Schedule', shortLabel: 'Calendar', icon: Calendar },
  { id: 'automations', label: 'Automations & Rules', shortLabel: 'Automations', icon: Zap },
];

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
  activeWorkspaceName,
  memberCount = 1,
  onOpenWorkspaceModal,
  onOpenShareModal,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('taskowl_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('taskowl_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleSelectNav = (tab: 'table' | 'dashboard' | 'kanban' | 'automations' | 'calendar') => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleMobileAction = (fn: () => void) => {
    fn();
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      aria-label="Primary sidebar navigation"
      className={`sidebar-shell sticky top-0 z-40 w-full border-b md:border-b-0 md:border-r md:h-screen md:shrink-0 md:flex md:flex-col transition-all duration-200 select-none ${
        isCollapsed ? 'md:w-[72px]' : 'md:w-[224px]'
      }`}
    >
      {/* Mobile Compact Header Bar (< md) */}
      <div className="flex md:hidden items-center justify-between px-3.5 py-2.5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-[var(--border-strong)] shadow-sm shrink-0">
            <img
              src="/assets/taskowl/logo.jpg"
              alt="TaskOwl"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap font-heading">
            TaskOwl
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="group sidebar-action-item relative h-9 w-9 rounded-lg flex items-center justify-center"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-text)] text-[10px] font-bold flex items-center justify-center font-mono-num">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="sidebar-cta-item h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className="sidebar-action-item h-9 w-9 rounded-lg flex items-center justify-center"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Desktop Header Row + Full Sidebar Body */}
      <div
        className={`${
          isMobileMenuOpen ? 'flex' : 'hidden'
        } md:flex flex-col flex-1 min-h-0 px-3 pb-3 pt-2 md:py-3.5 gap-3 overflow-y-auto border-t md:border-t-0 border-[var(--border-subtle)]`}
      >
        {/* Brand & Collapse Toggle (Desktop) */}
        <div
          className={`hidden md:flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between gap-2'
          } px-1 pb-1`}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-[var(--border-strong)] shadow-sm shrink-0">
                <img
                  src="/assets/taskowl/logo.jpg"
                  alt="TaskOwl"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-sm font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap truncate font-heading">
                TaskOwl
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapse}
            className="group sidebar-action-item h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar for more space'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Action: New Task */}
        <button
          type="button"
          onClick={() => handleMobileAction(onOpenNewTaskModal)}
          title="Create New Task"
          className={`sidebar-cta-item h-10 rounded-lg text-xs font-semibold flex items-center ${
            isCollapsed ? 'justify-center px-0' : 'justify-center gap-2 px-3'
          } whitespace-nowrap shrink-0`}
        >
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          {!isCollapsed && <span>New Task</span>}
        </button>

        {/* Primary Workspace Views */}
        <nav aria-label="Workspace views" className="flex flex-col gap-1">
          {!isCollapsed && (
            <span className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Views
            </span>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-active={isActive ? 'true' : 'false'}
                onClick={() => handleSelectNav(item.id)}
                title={item.label}
                className={`group sidebar-nav-item h-10 rounded-lg text-xs font-medium flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                } whitespace-nowrap w-full text-left`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-[var(--accent-primary)] group-hover:text-[var(--accent-primary-text)]'
                      : 'text-[var(--text-secondary)] group-hover:text-[var(--accent-primary-text)]'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Workspace & Sharing */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
          {!isCollapsed && (
            <span className="px-2 pb-0.5 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Workspace
            </span>
          )}

          <button
            type="button"
            onClick={() => handleMobileAction(onOpenWorkspaceModal)}
            title={`Workspace: ${activeWorkspaceName || 'Team'} (${memberCount})`}
            className={`group sidebar-action-item h-10 rounded-lg text-xs font-medium flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-between gap-2 px-2.5'
            } whitespace-nowrap w-full`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 shrink-0 text-[var(--accent-primary)] group-hover:text-[var(--accent-primary-text)] transition-colors" />
              {!isCollapsed && (
                <span className="truncate">{activeWorkspaceName || 'Team'}</span>
              )}
            </span>
            {!isCollapsed && (
              <span className="font-mono-num text-[11px] text-[var(--text-muted)] group-hover:text-[var(--accent-primary-text)] shrink-0 transition-colors">
                {memberCount}
              </span>
            )}
          </button>

          {onOpenShareModal && (
            <button
              type="button"
              onClick={() => handleMobileAction(onOpenShareModal)}
              title="Share workspace via unrestricted link"
              className={`group sidebar-action-item h-10 rounded-lg text-xs font-medium flex items-center ${
                isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
              } whitespace-nowrap w-full`}
            >
              <Share2 className="w-4 h-4 shrink-0 text-[var(--accent-primary)] group-hover:text-[var(--accent-primary-text)] transition-colors" />
              {!isCollapsed && <span className="truncate">Share Link</span>}
            </button>
          )}
        </div>

        {/* Bottom Controls: Preferences, Alerts & Account */}
        <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
          {/* Compact 3-action utility strip */}
          <div
            className={`grid ${
              isCollapsed ? 'grid-cols-1 gap-1.5' : 'grid-cols-3 gap-1.5'
            }`}
          >
            <button
              type="button"
              onClick={onToggleTheme}
              className="group sidebar-action-item h-10 rounded-lg flex items-center justify-center"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:text-[var(--accent-primary-text)] transition-colors" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 group-hover:text-[var(--accent-primary-text)] transition-colors" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenCustomizer)}
              className="group sidebar-action-item h-10 rounded-lg flex items-center justify-center gap-1"
              title="Customize Palette & Layout"
              aria-label="Customize palette and layout"
            >
              <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)] group-hover:text-[var(--accent-primary-text)] transition-colors" />
              <span
                className="w-2 h-2 rounded-full border border-white/30 group-hover:border-current shrink-0"
                style={{ backgroundColor: accentColor || 'var(--accent-primary)' }}
              />
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenNotifications)}
              className="group sidebar-action-item relative h-10 rounded-lg flex items-center justify-center"
              title="View Notifications"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-text)] group-hover:bg-[var(--bg-surface)] group-hover:text-[var(--text-primary)] text-[10px] font-bold flex items-center justify-center font-mono-num transition-colors">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Google Account Footer */}
          {user ? (
            <div
              className={`flex items-center ${
                isCollapsed ? 'flex-col gap-1.5' : 'justify-between gap-2 px-2 py-1.5'
              } rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70`}
            >
              <div
                className="flex items-center gap-2 min-w-0"
                title={user.email || user.displayName || 'Connected Account'}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-container)] text-white text-[10px] font-bold flex items-center justify-center font-mono shrink-0">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                {!isCollapsed && (
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleMobileAction(onSignOut)}
                className="group sidebar-action-item h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                title="Disconnect Google Workspace"
                aria-label="Disconnect Google Workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleMobileAction(onSignIn)}
              title="Sign in with Google"
              className={`group sidebar-action-item h-10 rounded-lg text-xs font-semibold flex items-center ${
                isCollapsed ? 'justify-center px-0' : 'justify-center gap-2 px-2.5'
              } whitespace-nowrap w-full`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
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
              {!isCollapsed && <span className="truncate">Sign in</span>}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
