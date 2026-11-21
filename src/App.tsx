import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Copy, Check, AlertCircle, Globe, Edit3 } from 'lucide-react';
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
import { sendGmailAlert, escapeHtml, formatCustomReminderHtml } from './services/emailService';
import { sounds } from './services/soundEffects';
import {
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
  sanitizeForFirestore,
  emailToMemberId,
  deriveNameFromEmail,
  deriveInitials,
} from './services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  INITIAL_PREFERENCES,
  DEFAULT_CUSTOMIZATION,
} from './services/defaultData';
import { applyThemeAndAccentToDom } from './services/colorUtils';
import {
  Task,
  LaneType,
  PriorityType,
  ThemeMode,
  Assignee,
  Workspace,
  WorkspaceShare,
  SavedWorkspaceShare,
  WorkspaceMember,
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
import { WorkspaceMembersModal } from './components/WorkspaceMembersModal';

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

  // User, Auth & Shared Workspace State
  const [user, setUser] = useState<User | null>(null);
  const [hasOAuthToken, setHasOAuthToken] = useState(false);
  const [memberWorkspaces, setMemberWorkspaces] = useState<Workspace[]>([]);
  const [savedShareWorkspaces, setSavedShareWorkspaces] = useState<Workspace[]>([]);
  const [linkSharedWorkspace, setLinkSharedWorkspace] = useState<Workspace | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [focusShareInModal, setFocusShareInModal] = useState(false);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [copiedBannerLink, setCopiedBannerLink] = useState(false);
  const [incomingShareToken, setIncomingShareToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('share')?.trim() || null;
      return token && /^[a-zA-Z0-9_-]{8,128}$/.test(token) ? token : null;
    } catch {
      return null;
    }
  });
  const [guestDisplayName, setGuestDisplayName] = useState<string>(() => {
    return sessionStorage.getItem('taskowl_guest_name') || 'Guest Collaborator';
  });
  const [isEditingGuestName, setIsEditingGuestName] = useState(false);
  const [guestNameDraft, setGuestNameDraft] = useState(guestDisplayName);
  const migratedUsersRef = useRef<Set<string>>(new Set());
  const appliedShareTokenRef = useRef<string | null>(null);

  const workspaces = useMemo(() => {
    const map = new Map<string, Workspace>();
    memberWorkspaces.forEach((w) => map.set(w.id, w));
    savedShareWorkspaces.forEach((w) => {
      if (!map.has(w.id)) map.set(w.id, w);
    });
    if (linkSharedWorkspace && !map.has(linkSharedWorkspace.id)) {
      map.set(linkSharedWorkspace.id, linkSharedWorkspace);
    }
    return Array.from(map.values());
  }, [memberWorkspaces, savedShareWorkspaces, linkSharedWorkspace]);

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

  const showBanner = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setBannerNotice({ message, type });
    setTimeout(() => {
      setBannerNotice(null);
    }, 4500);
  }, []);

  // Google Calendar fetch helper
  const loadCalendarEvents = useCallback(async (token: string) => {
    if (!token) return;
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

  // Auth listener (keeps Firebase session alive across reloads)
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        if (token) {
          setHasOAuthToken(true);
          loadCalendarEvents(token);
        } else {
          setHasOAuthToken(false);
        }
      },
      () => {
        setUser(null);
        setHasOAuthToken(false);
      }
    );

    return () => unsubscribeAuth();
  }, [loadCalendarEvents]);

  // Persist selected workspace ID per user for seamless reload
  const handleSelectWorkspace = useCallback(
    (wsId: string) => {
      setActiveWorkspaceId(wsId);
      if (user) {
        localStorage.setItem(`taskowl_active_ws_${user.uid}`, wsId);
      }
    },
    [user]
  );

  // Discover shared workspaces & run 1-time legacy /users/{uid} migration into personal workspace
  useEffect(() => {
    if (!user || !user.email) {
      setMemberWorkspaces([]);
      setSavedShareWorkspaces([]);
      if (!linkSharedWorkspace) {
        setActiveWorkspaceId(null);
        setWorkspaceMembers([]);
        setTasks([]);
        setPreferences(INITIAL_PREFERENCES);
        setLogs([]);
        setNotifications([]);
        setCustomization(DEFAULT_CUSTOMIZATION);
      }
      return;
    }

    const userEmailLower = user.email.toLowerCase();
    const personalWsId = `ws-${user.uid}`;

    const ensurePersonalWorkspaceAndMigrate = async () => {
      if (migratedUsersRef.current.has(user.uid)) return;
      migratedUsersRef.current.add(user.uid);

      try {
        const personalWsRef = doc(db, 'workspaces', personalWsId);
        const personalWsSnap = await getDoc(personalWsRef);

        if (!personalWsSnap.exists()) {
          const ownerName = user.displayName || deriveNameFromEmail(userEmailLower);
          const wsPayload: Workspace = {
            id: personalWsId,
            name: `${ownerName.split(' ')[0]}'s Workspace`,
            ownerId: user.uid,
            ownerEmail: userEmailLower,
            memberEmails: [userEmailLower],
            createdAt: new Date().toISOString(),
          };
          await setDoc(personalWsRef, sanitizeForFirestore(wsPayload));

          const ownerMember: WorkspaceMember = {
            id: emailToMemberId(userEmailLower),
            email: userEmailLower,
            name: ownerName,
            role: 'Owner',
            workspaceRole: 'owner',
            initials: deriveInitials(ownerName),
            ...(user.photoURL ? { avatar: user.photoURL } : {}),
            uid: user.uid,
            addedBy: user.uid,
            addedAt: new Date().toISOString(),
          };
          await setDoc(
            doc(db, `workspaces/${personalWsId}/members`, ownerMember.id),
            sanitizeForFirestore(ownerMember)
          );

          // Migrate legacy /users/{uid} data into ws-{uid} if present
          try {
            const legacyTasksSnap = await getDocs(collection(db, `users/${user.uid}/tasks`));
            for (const d of legacyTasksSnap.docs) {
              const raw = d.data() as Partial<Task>;
              const normalizedTask: Task = {
                id: raw.id || d.id,
                title: (raw.title || 'Untitled Task').slice(0, 500),
                description: (raw.description || '').slice(0, 5000),
                lane: raw.lane || 'backlog',
                priority: raw.priority || 'medium',
                ...(raw.originalPriority ? { originalPriority: raw.originalPriority } : {}),
                deadline: raw.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                estimatedHours: Number.isFinite(Number(raw.estimatedHours)) ? Number(raw.estimatedHours) : 2,
                assignee: {
                  name: raw.assignee?.name || ownerName,
                  role: raw.assignee?.role || 'Owner',
                  initials: raw.assignee?.initials || deriveInitials(raw.assignee?.name || ownerName),
                  email: raw.assignee?.email || userEmailLower,
                  ...(raw.assignee?.avatar ? { avatar: raw.assignee.avatar } : {}),
                },
                tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 50) : ['General'],
                syncedToCalendar: Boolean(raw.syncedToCalendar),
                ...(raw.calendarEventId ? { calendarEventId: raw.calendarEventId } : {}),
                ...(raw.calendarEventUrl ? { calendarEventUrl: raw.calendarEventUrl } : {}),
                escalated: Boolean(raw.escalated),
                ...(typeof raw.email48hSent === 'boolean' ? { email48hSent: raw.email48hSent } : {}),
                ...(typeof raw.email24hSent === 'boolean' ? { email24hSent: raw.email24hSent } : {}),
                createdAt: raw.createdAt || new Date().toISOString(),
                ...(raw.completedAt ? { completedAt: raw.completedAt } : {}),
                createdBy: user.uid,
              };
              await setDoc(
                doc(db, `workspaces/${personalWsId}/tasks`, normalizedTask.id),
                sanitizeForFirestore(normalizedTask)
              );
            }

            const legacyAutoSnap = await getDoc(doc(db, `users/${user.uid}/preferences`, 'automation'));
            if (legacyAutoSnap.exists()) {
              await setDoc(
                doc(db, `workspaces/${personalWsId}/preferences`, 'automation'),
                sanitizeForFirestore({ ...INITIAL_PREFERENCES, ...legacyAutoSnap.data() })
              );
            }

            const legacyCustomSnap = await getDoc(doc(db, `users/${user.uid}/preferences`, 'customization'));
            if (legacyCustomSnap.exists()) {
              await setDoc(
                doc(db, `workspaces/${personalWsId}/preferences`, 'customization'),
                sanitizeForFirestore({ ...DEFAULT_CUSTOMIZATION, ...legacyCustomSnap.data() })
              );
            }

            const legacyLogsSnap = await getDocs(collection(db, `users/${user.uid}/logs`));
            for (const d of legacyLogsSnap.docs) {
              const l = d.data() as AutomationLog;
              await setDoc(
                doc(db, `workspaces/${personalWsId}/logs`, l.id || d.id),
                sanitizeForFirestore({ ...l, id: l.id || d.id })
              );
            }

            const legacyNotifsSnap = await getDocs(collection(db, `users/${user.uid}/notifications`));
            for (const d of legacyNotifsSnap.docs) {
              const n = d.data() as InAppNotification;
              await setDoc(
                doc(db, `workspaces/${personalWsId}/notifications`, n.id || d.id),
                sanitizeForFirestore({ ...n, id: n.id || d.id })
              );
            }
          } catch (migrationErr) {
            console.warn('Legacy migration note:', migrationErr);
          }
        }
      } catch (err) {
        console.error('Failed to ensure personal workspace:', err);
      }
    };

    ensurePersonalWorkspaceAndMigrate();

    const wsQuery = query(
      collection(db, 'workspaces'),
      where('memberEmails', 'array-contains', userEmailLower)
    );
    const unsubscribeWorkspaces = onSnapshot(
      wsQuery,
      (snapshot) => {
        const wsList = snapshot.docs.map((d) => d.data() as Workspace);
        setMemberWorkspaces(wsList);
        if (wsList.length > 0 && !incomingShareToken) {
          setActiveWorkspaceId((prev) => {
            if (prev && wsList.some((w) => w.id === prev)) return prev;
            const saved = localStorage.getItem(`taskowl_active_ws_${user.uid}`);
            if (saved && wsList.some((w) => w.id === saved)) return saved;
            const owned = wsList.find((w) => w.id === personalWsId);
            return owned ? owned.id : wsList[0].id;
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'workspaces')
    );

    const savedSharesQuery = collection(db, `users/${user.uid}/savedShares`);
    const unsubscribeSavedShares = onSnapshot(
      savedSharesQuery,
      async (snapshot) => {
        const savedList = snapshot.docs.map((d) => d.data() as SavedWorkspaceShare);
        const resolved: Workspace[] = [];
        for (const item of savedList) {
          try {
            const wsSnap = await getDoc(doc(db, 'workspaces', item.workspaceId));
            if (wsSnap.exists()) {
              const wsData = wsSnap.data() as Workspace;
              if (wsData.shareEnabled && wsData.shareToken === item.shareToken) {
                resolved.push(wsData);
              }
            }
          } catch {
            // Link may have been disabled or revoked by owner; ignore silently
          }
        }
        setSavedShareWorkspaces(resolved);
      },
      (error) => console.warn('Could not sync saved shared workspaces:', error)
    );

    return () => {
      unsubscribeWorkspaces();
      unsubscribeSavedShares();
    };
  }, [user, incomingShareToken]);

  // Resolve incoming ?share=<token> link (works without sign-in or restrictions)
  useEffect(() => {
    if (!incomingShareToken) {
      setLinkSharedWorkspace(null);
      setShareLinkError(null);
      return;
    }

    let isCancelled = false;
    let unsubscribeWs: (() => void) | null = null;

    const resolveShareToken = async () => {
      setShareLinkError(null);
      try {
        const shareSnap = await getDoc(doc(db, 'workspaceShares', incomingShareToken));
        if (isCancelled) return;

        if (!shareSnap.exists()) {
          setLinkSharedWorkspace(null);
          setShareLinkError('This workspace share link is invalid or has been disabled by the owner.');
          return;
        }

        const shareData = shareSnap.data() as WorkspaceShare;
        if (!shareData.active || !shareData.workspaceId) {
          setLinkSharedWorkspace(null);
          setShareLinkError('This workspace share link is no longer active.');
          return;
        }

        unsubscribeWs = onSnapshot(
          doc(db, 'workspaces', shareData.workspaceId),
          (wsSnap) => {
            if (isCancelled) return;
            if (!wsSnap.exists()) {
              setLinkSharedWorkspace(null);
              setShareLinkError('The shared workspace could not be found.');
              return;
            }
            const wsData = wsSnap.data() as Workspace;
            if (!wsData.shareEnabled || wsData.shareToken !== incomingShareToken) {
              setLinkSharedWorkspace(null);
              setShareLinkError('Link sharing has been disabled or regenerated by the workspace owner.');
              return;
            }

            setShareLinkError(null);
            setLinkSharedWorkspace(wsData);
            if (appliedShareTokenRef.current !== incomingShareToken) {
              appliedShareTokenRef.current = incomingShareToken;
              setActiveWorkspaceId(wsData.id);
            }
          },
          (err) => {
            console.warn('Shared workspace listener error:', err);
            if (!isCancelled) {
              setLinkSharedWorkspace(null);
              setShareLinkError('Unable to access this shared workspace link.');
            }
          }
        );
      } catch (err) {
        console.warn('Share token lookup failed:', err);
        if (!isCancelled) {
          setLinkSharedWorkspace(null);
          setShareLinkError('This workspace share link is invalid or has been disabled by the owner.');
        }
      }
    };

    resolveShareToken();

    return () => {
      isCancelled = true;
      if (unsubscribeWs) unsubscribeWs();
    };
  }, [incomingShareToken]);

  // Persist opened share link to signed-in user's savedShares so it stays in their switcher
  useEffect(() => {
    if (!user || !linkSharedWorkspace || !incomingShareToken) return;
    if (
      linkSharedWorkspace.ownerId === user.uid ||
      (user.email && linkSharedWorkspace.memberEmails.includes(user.email.toLowerCase()))
    ) {
      return;
    }

    const savedPayload: SavedWorkspaceShare = sanitizeForFirestore({
      workspaceId: linkSharedWorkspace.id,
      shareToken: incomingShareToken,
      workspaceName: linkSharedWorkspace.name,
      savedAt: new Date().toISOString(),
    });
    setDoc(doc(db, `users/${user.uid}/savedShares`, linkSharedWorkspace.id), savedPayload).catch(
      (e) => console.warn('Could not save shared workspace bookmark:', e)
    );
  }, [user, linkSharedWorkspace, incomingShareToken]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const isActiveWorkspaceMember = Boolean(
    user &&
      activeWorkspace &&
      (activeWorkspace.ownerId === user.uid ||
        (user.email && activeWorkspace.memberEmails.includes(user.email.toLowerCase())))
  );
  const isActiveWorkspacePublicShared = Boolean(
    activeWorkspace && activeWorkspace.shareEnabled && activeWorkspace.shareToken
  );
  const canAccessActiveWorkspace = Boolean(
    activeWorkspaceId && (isActiveWorkspaceMember || isActiveWorkspacePublicShared)
  );

  // Active Workspace Subcollections Synchronization
  useEffect(() => {
    if (!activeWorkspaceId || !canAccessActiveWorkspace) {
      setWorkspaceMembers([]);
      setTasks([]);
      setLogs([]);
      setNotifications([]);
      return;
    }

    const wsPath = `workspaces/${activeWorkspaceId}`;

    // 1. Workspace Members Subscription
    const membersQuery = query(collection(db, `${wsPath}/members`), orderBy('addedAt', 'asc'));
    const unsubscribeMembers = onSnapshot(
      membersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as WorkspaceMember);
        setWorkspaceMembers(list);

        // Enrich current user's member profile with Google displayName / photoURL / uid if missing or changed
        if (user?.email && isActiveWorkspaceMember) {
          const emailLower = user.email.toLowerCase();
          const selfMember = list.find((m) => m.email.toLowerCase() === emailLower);
          if (selfMember) {
            const desiredName = user.displayName || selfMember.name;
            const desiredAvatar = user.photoURL || selfMember.avatar;
            if (
              !selfMember.uid ||
              (user.displayName && selfMember.name !== user.displayName) ||
              (user.photoURL && selfMember.avatar !== user.photoURL)
            ) {
              const updatedMember: WorkspaceMember = {
                ...selfMember,
                uid: user.uid,
                name: desiredName,
                initials: deriveInitials(desiredName),
                ...(desiredAvatar ? { avatar: desiredAvatar } : {}),
              };
              setDoc(
                doc(db, `${wsPath}/members`, selfMember.id),
                sanitizeForFirestore(updatedMember)
              ).catch((e) => console.warn('Could not enrich member profile:', e));
            }
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `${wsPath}/members`)
    );

    // 2. Tasks Subscription
    const tasksQuery = query(collection(db, `${wsPath}/tasks`), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const taskList = snapshot.docs.map((d) => d.data() as Task);
        setTasks(taskList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `${wsPath}/tasks`)
    );

    // 3. Automation Preferences Subscription (strictly for verified workspace members to protect email PII)
    let unsubscribePrefs: (() => void) | null = null;
    if (isActiveWorkspaceMember && user) {
      const prefsDoc = doc(db, `${wsPath}/preferences`, 'automation');
      unsubscribePrefs = onSnapshot(
        prefsDoc,
        (snapshot) => {
          if (snapshot.exists()) {
            setPreferences({ ...INITIAL_PREFERENCES, ...(snapshot.data() as AutomationPreferences) });
          } else {
            const initial = sanitizeForFirestore({
              ...INITIAL_PREFERENCES,
              recipientEmail: user.email || '',
            });
            setDoc(prefsDoc, initial).catch((e) =>
              handleFirestoreError(e, OperationType.CREATE, prefsDoc.path)
            );
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, prefsDoc.path)
      );
    } else {
      setPreferences(INITIAL_PREFERENCES);
    }

    // 4. Customization Subscription
    const customDoc = doc(db, `${wsPath}/preferences`, 'customization');
    const unsubscribeCustom = onSnapshot(
      customDoc,
      (snapshot) => {
        if (snapshot.exists()) {
          setCustomization({ ...DEFAULT_CUSTOMIZATION, ...(snapshot.data() as DashboardCustomization) });
        } else if (isActiveWorkspaceMember) {
          setDoc(customDoc, sanitizeForFirestore(DEFAULT_CUSTOMIZATION)).catch((e) =>
            handleFirestoreError(e, OperationType.CREATE, customDoc.path)
          );
        } else {
          setCustomization(DEFAULT_CUSTOMIZATION);
        }
      },
      (error) => {
        if (isActiveWorkspaceMember) {
          handleFirestoreError(error, OperationType.GET, customDoc.path);
        } else {
          console.warn('Could not read workspace customization:', error);
        }
      }
    );

    // 5. Logs Subscription
    const logsQuery = query(collection(db, `${wsPath}/logs`), orderBy('triggeredAt', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logList = snapshot.docs.map((d) => d.data() as AutomationLog);
        setLogs(logList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `${wsPath}/logs`)
    );

    // 6. Notifications Subscription
    const notifsQuery = query(
      collection(db, `${wsPath}/notifications`),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubscribeNotifs = onSnapshot(
      notifsQuery,
      (snapshot) => {
        const notifList = snapshot.docs.map((d) => d.data() as InAppNotification);
        setNotifications(notifList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `${wsPath}/notifications`)
    );

    return () => {
      unsubscribeMembers();
      unsubscribeTasks();
      if (unsubscribePrefs) unsubscribePrefs();
      unsubscribeCustom();
      unsubscribeLogs();
      unsubscribeNotifs();
    };
  }, [user, activeWorkspaceId, canAccessActiveWorkspace, isActiveWorkspaceMember]);

  // Connection test on boot
  useEffect(() => {
    testConnection();
  }, []);

  const handleUpdatePreferences = useCallback(
    async (newPrefs: Partial<AutomationPreferences>) => {
      if (!user || !activeWorkspaceId) return;
      const next = sanitizeForFirestore({ ...preferences, ...newPrefs });
      const prefsDoc = doc(db, `workspaces/${activeWorkspaceId}/preferences`, 'automation');
      try {
        await setDoc(prefsDoc, next);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, prefsDoc.path);
      }
    },
    [user, activeWorkspaceId, preferences]
  );

  // Synchronize recipient email whenever signed-in Google user email updates and recipientEmail is empty
  useEffect(() => {
    if (user?.email && !preferences.recipientEmail) {
      handleUpdatePreferences({ recipientEmail: user.email });
    }
  }, [user?.email, preferences.recipientEmail, handleUpdatePreferences]);

  // Sign In with Google
  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasOAuthToken(true);
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
    migratedUsersRef.current.clear();
    setUser(null);
    setHasOAuthToken(false);
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
    const next = sanitizeForFirestore({
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
    });
    setCustomization(next);
    if (!user || !activeWorkspaceId || !isActiveWorkspaceMember) return;
    const customDoc = doc(db, `workspaces/${activeWorkspaceId}/preferences`, 'customization');
    try {
      await setDoc(customDoc, next);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, customDoc.path);
    }
  };

  const handleResetCustomization = async () => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    if (!user || !activeWorkspaceId || !isActiveWorkspaceMember) return;
    const customDoc = doc(db, `workspaces/${activeWorkspaceId}/preferences`, 'customization');
    try {
      await setDoc(customDoc, sanitizeForFirestore(DEFAULT_CUSTOMIZATION));
      showBanner('Reset dashboard preferences to default', 'info');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, customDoc.path);
    }
  };

  // Add Log Entry
  const addLog = useCallback(
    async (ruleName: string, details: string, status: 'success' | 'warning' | 'info', taskTitle?: string, taskId?: string) => {
      if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newLog: AutomationLog = sanitizeForFirestore({
        id: logId,
        ruleName: ruleName.slice(0, 200),
        details: details.slice(0, 2000),
        status,
        ...(taskTitle ? { taskTitle: taskTitle.slice(0, 500) } : {}),
        ...(taskId ? { taskId: taskId.slice(0, 128) } : {}),
        triggeredAt: new Date().toISOString(),
      });

      const logDoc = doc(db, `workspaces/${activeWorkspaceId}/logs`, logId);
      try {
        await setDoc(logDoc, newLog);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, logDoc.path);
      }
    },
    [canAccessActiveWorkspace, activeWorkspaceId]
  );

  // Add Notification Entry
  const addNotification = useCallback(
    async (
      title: string,
      message: string,
      type: InAppNotification['type'],
      taskId?: string
    ) => {
      if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newNotif: InAppNotification = sanitizeForFirestore({
        id: notifId,
        title: title.slice(0, 200),
        message: message.slice(0, 1000),
        type,
        ...(taskId ? { taskId: taskId.slice(0, 128) } : {}),
        timestamp: new Date().toISOString(),
        read: false,
      });

      const notifDoc = doc(db, `workspaces/${activeWorkspaceId}/notifications`, notifId);
      try {
        await setDoc(notifDoc, newNotif);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, notifDoc.path);
      }
    },
    [canAccessActiveWorkspace, activeWorkspaceId]
  );

  // Workspace & Member Management Handlers
  const handleCreateWorkspace = async (name: string) => {
    if (!user || !user.email) return;
    const emailLower = user.email.toLowerCase();
    const wsId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ownerName = user.displayName || deriveNameFromEmail(emailLower);

    const wsPayload: Workspace = {
      id: wsId,
      name: name.trim().slice(0, 120),
      ownerId: user.uid,
      ownerEmail: emailLower,
      memberEmails: [emailLower],
      createdAt: new Date().toISOString(),
    };

    const ownerMember: WorkspaceMember = {
      id: emailToMemberId(emailLower),
      email: emailLower,
      name: ownerName,
      role: 'Owner',
      workspaceRole: 'owner',
      initials: deriveInitials(ownerName),
      ...(user.photoURL ? { avatar: user.photoURL } : {}),
      uid: user.uid,
      addedBy: user.uid,
      addedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'workspaces', wsId), sanitizeForFirestore(wsPayload));
      await setDoc(doc(db, `workspaces/${wsId}/members`, ownerMember.id), sanitizeForFirestore(ownerMember));
      handleSelectWorkspace(wsId);
      showBanner(`Created workspace "${wsPayload.name}"`);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `workspaces/${wsId}`);
    }
  };

  const handleRenameWorkspace = async (wsId: string, newName: string) => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws || !user || ws.ownerId !== user.uid) return;
    const updated: Workspace = {
      ...ws,
      name: newName.trim().slice(0, 120),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'workspaces', wsId), sanitizeForFirestore(updated));
      showBanner(`Renamed workspace to "${updated.name}"`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `workspaces/${wsId}`);
    }
  };

  const handleAddWorkspaceMember = async (
    email: string,
    name?: string,
    role?: string,
    sendInviteEmail?: boolean
  ): Promise<WorkspaceMember | null> => {
    if (!user || !activeWorkspace) {
      showBanner('Please sign in first to add workspace members.', 'warning');
      return null;
    }

    const emailLower = email.trim().toLowerCase();
    const memberId = emailToMemberId(emailLower);
    const displayName = (name?.trim() || deriveNameFromEmail(emailLower)).slice(0, 120);
    const memberRole = (role?.trim() || 'Member').slice(0, 80);

    const newMember: WorkspaceMember = sanitizeForFirestore({
      id: memberId,
      email: emailLower,
      name: displayName,
      role: memberRole,
      workspaceRole: 'member',
      initials: deriveInitials(displayName),
      addedBy: user.uid,
      addedAt: new Date().toISOString(),
    });

    const nextEmails = Array.from(new Set([...activeWorkspace.memberEmails, emailLower])).slice(0, 50);
    const updatedWs: Workspace = sanitizeForFirestore({
      ...activeWorkspace,
      memberEmails: nextEmails,
      updatedAt: new Date().toISOString(),
    });

    try {
      await setDoc(doc(db, 'workspaces', activeWorkspace.id), updatedWs);
      await setDoc(doc(db, `workspaces/${activeWorkspace.id}/members`, memberId), newMember);

      if (sendInviteEmail) {
        const token = await getAccessToken();
        if (token) {
          try {
            await sendGmailAlert(
              token,
              emailLower,
              `[TaskOwl] You were added to "${activeWorkspace.name}"`,
              `<div style="font-family: sans-serif; background: #000000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
                <h2 style="color: #eab308; margin-top: 0;">You've been added to a TaskOwl Workspace</h2>
                <p><strong>${user.displayName || user.email}</strong> added you (<strong>${emailLower}</strong>) to <strong>${activeWorkspace.name}</strong>.</p>
                <p>Sign in with your Google account (${emailLower}) in TaskOwl to view shared tasks, collaborate on boards, and receive task assignments.</p>
              </div>`
            );
          } catch (mailErr) {
            console.warn('Workspace member added, but invite email failed:', mailErr);
          }
        }
      }

      addLog(
        'Workspace Member Added',
        `Added ${displayName} (${emailLower}) as ${memberRole} to "${activeWorkspace.name}".`,
        'success'
      );
      showBanner(`Added ${emailLower} to ${activeWorkspace.name}`);
      return newMember;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `workspaces/${activeWorkspace.id}/members/${memberId}`);
      return null;
    }
  };

  const handleRemoveWorkspaceMember = async (member: WorkspaceMember) => {
    if (!user || !activeWorkspace || activeWorkspace.ownerId !== user.uid) return;
    if (member.workspaceRole === 'owner') return;

    const nextEmails = activeWorkspace.memberEmails.filter(
      (e) => e.toLowerCase() !== member.email.toLowerCase()
    );
    if (!nextEmails.includes(activeWorkspace.ownerEmail)) {
      nextEmails.unshift(activeWorkspace.ownerEmail);
    }

    try {
      await deleteDoc(doc(db, `workspaces/${activeWorkspace.id}/members`, member.id));
      await setDoc(
        doc(db, 'workspaces', activeWorkspace.id),
        sanitizeForFirestore({
          ...activeWorkspace,
          memberEmails: nextEmails,
          updatedAt: new Date().toISOString(),
        })
      );
      addLog(
        'Workspace Member Removed',
        `Removed ${member.email} from "${activeWorkspace.name}".`,
        'info'
      );
      showBanner(`Removed ${member.email} from workspace`, 'info');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `workspaces/${activeWorkspace.id}/members/${member.id}`);
    }
  };

  // Unrestricted Workspace Link Sharing Handlers
  const generateShareToken = () => {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleEnableShareLink = async (wsId: string): Promise<string | null> => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws || !user || ws.ownerId !== user.uid) {
      showBanner('Only the workspace owner can enable link sharing.', 'warning');
      return null;
    }
    if (ws.shareEnabled && ws.shareToken && ws.shareToken.length >= 8) {
      return ws.shareToken;
    }

    const token = generateShareToken();
    const nowIso = new Date().toISOString();
    const sharePayload: WorkspaceShare = sanitizeForFirestore({
      token,
      workspaceId: ws.id,
      workspaceName: ws.name.slice(0, 120),
      ownerId: user.uid,
      active: true,
      createdAt: nowIso,
    });
    const updatedWs: Workspace = sanitizeForFirestore({
      ...ws,
      shareEnabled: true,
      shareToken: token,
      updatedAt: nowIso,
    });

    try {
      await setDoc(doc(db, 'workspaceShares', token), sharePayload);
      await setDoc(doc(db, 'workspaces', ws.id), updatedWs);
      addLog(
        'Workspace Share Link Enabled',
        `Generated unrestricted share link for "${ws.name}".`,
        'success'
      );
      showBanner(`Generated share link for "${ws.name}"`);
      return token;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `workspaces/${ws.id}`);
      return null;
    }
  };

  const handleRegenerateShareLink = async (wsId: string): Promise<string | null> => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws || !user || ws.ownerId !== user.uid) return null;

    const oldToken = ws.shareToken;
    const newToken = generateShareToken();
    const nowIso = new Date().toISOString();

    const sharePayload: WorkspaceShare = sanitizeForFirestore({
      token: newToken,
      workspaceId: ws.id,
      workspaceName: ws.name.slice(0, 120),
      ownerId: user.uid,
      active: true,
      createdAt: nowIso,
    });
    const updatedWs: Workspace = sanitizeForFirestore({
      ...ws,
      shareEnabled: true,
      shareToken: newToken,
      updatedAt: nowIso,
    });

    try {
      await setDoc(doc(db, 'workspaceShares', newToken), sharePayload);
      await setDoc(doc(db, 'workspaces', ws.id), updatedWs);
      if (oldToken && oldToken.length >= 8 && oldToken !== newToken) {
        await deleteDoc(doc(db, 'workspaceShares', oldToken)).catch(() => {});
      }
      addLog(
        'Workspace Share Link Regenerated',
        `Rotated share link for "${ws.name}". Previous link invalidated.`,
        'info'
      );
      showBanner('Generated new share link (old link disabled)');
      return newToken;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `workspaces/${ws.id}`);
      return null;
    }
  };

  const handleDisableShareLink = async (wsId: string): Promise<void> => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws || !user || ws.ownerId !== user.uid) return;

    const oldToken = ws.shareToken;
    const updatedWs: Workspace = sanitizeForFirestore({
      ...ws,
      shareEnabled: false,
      shareToken: '',
      updatedAt: new Date().toISOString(),
    });

    try {
      await setDoc(doc(db, 'workspaces', ws.id), updatedWs);
      if (oldToken && oldToken.length >= 8) {
        await deleteDoc(doc(db, 'workspaceShares', oldToken)).catch(() => {});
      }
      addLog(
        'Workspace Share Link Disabled',
        `Disabled public share link for "${ws.name}".`,
        'info'
      );
      showBanner('Share link disabled', 'info');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `workspaces/${ws.id}`);
    }
  };

  // Heartbeat Automation Engine Runner (Auto 48h & 24h Gmail Alerts)
  const runHeartbeat = useCallback(async () => {
    if (!isActiveWorkspaceMember || !user) return;
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
        if (preferences.emailUpdatesEnabled !== false && token && recipient) {
          try {
            const formattedDeadline = new Date(task.deadline).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const customHtml = formatCustomReminderHtml(preferences.customReminderMessage, {
              taskTitle: task.title,
              deadline: formattedDeadline,
              priority: task.priority.toUpperCase(),
              owner: task.assignee?.name || 'Unassigned',
              recipientEmail: recipient,
            });
            await sendGmailAlert(
              token,
              recipient,
              `[48-Hour Reminder] Deliverable "${task.title}" is due in 2 days`,
              `<div style="font-family: sans-serif; background: #000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
                <h2 style="color: #38bdf8; margin-top: 0;">48-Hour Deadline Reminder</h2>
                ${
                  customHtml
                    ? `<div style="margin: 14px 0; padding: 14px 16px; background: #0b192e; border-left: 3px solid #38bdf8; border-radius: 6px; color: #f8fafc; font-size: 14px; line-height: 1.6;">${customHtml}</div>`
                    : `<p>Your deliverable <strong>${escapeHtml(task.title)}</strong> is scheduled for completion in <strong>2 days</strong>.</p>`
                }
                <div style="margin: 16px 0; padding: 16px; background: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
                  <p style="margin: 4px 0;"><strong>Task:</strong> ${escapeHtml(task.title)}</p>
                  <p style="margin: 4px 0;"><strong>Deadline:</strong> ${escapeHtml(formattedDeadline)}</p>
                  <p style="margin: 4px 0;"><strong>Priority:</strong> ${escapeHtml(task.priority.toUpperCase())}</p>
                  <p style="margin: 4px 0;"><strong>Owner:</strong> ${escapeHtml(task.assignee?.name || 'Unassigned')}</p>
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
        if (preferences.emailUpdatesEnabled !== false && token && recipient) {
          try {
            const formattedDeadline = new Date(task.deadline).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const customHtml = formatCustomReminderHtml(preferences.customReminderMessage, {
              taskTitle: task.title,
              deadline: formattedDeadline,
              priority: task.priority.toUpperCase(),
              owner: task.assignee?.name || 'Unassigned',
              recipientEmail: recipient,
            });
            await sendGmailAlert(
              token,
              recipient,
              `[24-Hour Urgent Warning] Deliverable "${task.title}" is due tomorrow`,
              `<div style="font-family: sans-serif; background: #000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #ef4444;">
                <h2 style="color: #ef4444; margin-top: 0;">24-Hour Urgent Deadline Warning</h2>
                ${
                  customHtml
                    ? `<div style="margin: 14px 0; padding: 14px 16px; background: #261018; border-left: 3px solid #ef4444; border-radius: 6px; color: #f8fafc; font-size: 14px; line-height: 1.6;">${customHtml}</div>`
                    : `<p>Urgent alert: Your deliverable <strong>${escapeHtml(task.title)}</strong> is due in <strong>less than 24 hours</strong>!</p>`
                }
                <div style="margin: 16px 0; padding: 16px; background: #1e1015; border-radius: 8px; border: 1px solid #881337;">
                  <p style="margin: 4px 0;"><strong>Task:</strong> ${escapeHtml(task.title)}</p>
                  <p style="margin: 4px 0; color: #f87171;"><strong>Deadline:</strong> ${escapeHtml(formattedDeadline)}</p>
                  <p style="margin: 4px 0;"><strong>Priority:</strong> URGENT</p>
                  <p style="margin: 4px 0;"><strong>Owner:</strong> ${escapeHtml(task.assignee?.name || 'Unassigned')}</p>
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

    if (updatedTasks && user && activeWorkspaceId) {
      for (const t of taskUpdates) {
        const original = tasks.find((ot) => ot.id === t.id);
        if (original && JSON.stringify(original) !== JSON.stringify(t)) {
          const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, t.id);
          await setDoc(taskDoc, sanitizeForFirestore(t)).catch((e) =>
            handleFirestoreError(e, OperationType.UPDATE, taskDoc.path)
          );
        }
      }
    }

    // Check for external calendar events that aren't task-synced
    if (preferences.emailUpdatesEnabled !== false && preferences.remindCalendarExternalEvents && calendarEvents.length > 0 && token) {
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
              const formattedStart = new Date(startRaw).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              const customHtml = formatCustomReminderHtml(preferences.customReminderMessage, {
                taskTitle: evt.summary,
                deadline: formattedStart,
                priority: 'CALENDAR EVENT',
                owner: user?.displayName || recipient,
                recipientEmail: recipient,
              });
              await sendGmailAlert(
                token,
                recipient,
                `[Personal Calendar Alert] "${evt.summary}" is starting in less than 24 hours`,
                `<div style="font-family: sans-serif; background: #000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #38bdf8;">
                  <h2 style="color: #38bdf8; margin-top: 0;">Personal Calendar Reminder</h2>
                  ${
                    customHtml
                      ? `<div style="margin: 14px 0; padding: 14px 16px; background: #0b192e; border-left: 3px solid #38bdf8; border-radius: 6px; color: #f8fafc; font-size: 14px; line-height: 1.6;">${customHtml}</div>`
                      : `<p>Your calendar event <strong>${escapeHtml(evt.summary)}</strong> is starting <strong>tomorrow</strong>.</p>`
                  }
                  <div style="margin: 16px 0; padding: 16px; background: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
                    <p style="margin: 4px 0;"><strong>Event:</strong> ${escapeHtml(evt.summary)}</p>
                    <p style="margin: 4px 0;"><strong>Start Time:</strong> ${escapeHtml(formattedStart)}</p>
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
    if (!token || !user || !activeWorkspaceId) {
      showBanner('Click Sign in / Reconnect Google in the top bar to sync with Google Calendar.', 'warning');
      return;
    }

    try {
      const result = await createCalendarEvent(token, task, preferences.calendarReminderMinutes);
      const updatedTask = sanitizeForFirestore({
        ...task,
        syncedToCalendar: true,
        calendarEventId: result.id,
        ...(result.htmlLink ? { calendarEventUrl: result.htmlLink } : {}),
      });

      const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, task.id);
      await setDoc(taskDoc, updatedTask).catch((e) =>
        handleFirestoreError(e, OperationType.UPDATE, taskDoc.path)
      );

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
    if (!token || !user || !activeWorkspaceId) {
      showBanner('Please connect Google in the top bar to sync all deliverables.', 'warning');
      return;
    }

    const unsynced = tasks.filter((t) => !t.syncedToCalendar && t.lane !== 'done');
    if (unsynced.length === 0) {
      showBanner('All upcoming deliverables are already synced to Google Calendar.', 'info');
      return;
    }

    let successCount = 0;

    for (const item of unsynced) {
      try {
        const res = await createCalendarEvent(token, item, preferences.calendarReminderMinutes);
        const updatedTask = sanitizeForFirestore({
          ...item,
          syncedToCalendar: true,
          calendarEventId: res.id,
          ...(res.htmlLink ? { calendarEventUrl: res.htmlLink } : {}),
        });
        const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, item.id);
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
    const customDigestHtml = formatCustomReminderHtml(preferences.customReminderMessage, {
      taskTitle: upcoming[0]?.title || 'Active Deliverables',
      deadline: new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      priority: urgent.length > 0 ? 'URGENT' : 'NORMAL',
      owner: user?.displayName || recipient,
      recipientEmail: recipient,
    });

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000000; color: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #334155;">
        <h2 style="color: #eab308; margin-top: 0;">TaskOwl | Daily Executive Digest</h2>
        <p style="font-size: 14px; color: #94a3b8;">Here is your executive deliverable briefing for <strong>${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
        ${
          customDigestHtml
            ? `<div style="margin: 16px 0; padding: 14px 16px; background: #0b192e; border-left: 3px solid #38bdf8; border-radius: 6px; color: #f8fafc; font-size: 13px; line-height: 1.6;">${customDigestHtml}</div>`
            : ''
        }
        
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
    if (!canAccessActiveWorkspace || !activeWorkspaceId) {
      showBanner('Please sign in with Google or open a shared workspace link to save tasks.', 'warning');
      return;
    }
    const wsPath = `workspaces/${activeWorkspaceId}`;

    if (editingTask) {
      const updated = sanitizeForFirestore({ ...editingTask, ...taskData }) as Task;
      const taskDoc = doc(db, `${wsPath}/tasks`, editingTask.id);
      try {
        await setDoc(taskDoc, updated);
        showBanner(`Updated "${updated.title}"`);
        if (syncDirectly && !editingTask.syncedToCalendar) {
          await handleSyncTaskToCalendar(updated);
        }
      } catch (e) {
        showBanner('Failed to update task. Please check connection.', 'warning');
        handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
      }
    } else {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const fallbackName = user
        ? user.displayName || (user.email ? deriveNameFromEmail(user.email) : 'Workspace Owner')
        : guestDisplayName.trim() || 'Guest Collaborator';
      const newTask: Task = sanitizeForFirestore({
        id: taskId,
        title: (taskData.title || 'Untitled Deliverable').slice(0, 500),
        description: (taskData.description || '').slice(0, 5000),
        lane: taskData.lane || defaultModalLane,
        priority: taskData.priority || 'medium',
        originalPriority: taskData.priority || 'medium',
        deadline: taskData.deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        estimatedHours: Number.isFinite(Number(taskData.estimatedHours)) ? Number(taskData.estimatedHours) : 2,
        assignee: taskData.assignee || {
          name: fallbackName.slice(0, 120),
          ...(user?.email ? { email: user.email.toLowerCase() } : {}),
          role: user ? 'Owner' : 'Collaborator',
          initials: deriveInitials(fallbackName),
          ...(user?.photoURL ? { avatar: user.photoURL } : {}),
        },
        tags: (taskData.tags && taskData.tags.length > 0 ? taskData.tags : ['Agile']).slice(0, 50),
        syncedToCalendar: false,
        escalated: false,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'shared_link_guest',
      });

      const taskDoc = doc(db, `${wsPath}/tasks`, taskId);
      try {
        await setDoc(taskDoc, newTask);
        showBanner(`Created deliverable "${newTask.title}"`);
        if (syncDirectly) {
          await handleSyncTaskToCalendar(newTask);
        }
      } catch (e) {
        showBanner('Failed to create task. Please check connection.', 'warning');
        handleFirestoreError(e, OperationType.CREATE, taskDoc.path);
      }
    }
  };

  // Move task lane in Kanban / Table
  const handleUpdateTaskLane = async (taskId: string, newLane: LaneType) => {
    if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const { completedAt: _prevCompleted, ...taskWithoutCompleted } = task;
    const updatedTask = sanitizeForFirestore({
      ...taskWithoutCompleted,
      lane: newLane,
      ...(newLane === 'done' ? { completedAt: new Date().toISOString() } : {}),
    });

    const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId);
    try {
      await setDoc(taskDoc, updatedTask);
    } catch (e) {
      showBanner('Failed to update task status.', 'warning');
      handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
    }
  };

  // Inline quick task add from MainTableView
  const handleAddNewTaskInline = async (
    title: string,
    lane: LaneType = 'backlog',
    priority: PriorityType = 'medium',
    dueDate?: string,
    assigneeOverride?: Assignee
  ) => {
    if (!canAccessActiveWorkspace || !activeWorkspaceId) {
      showBanner('Please sign in with Google or open a shared workspace link to save tasks.', 'warning');
      return;
    }
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fallbackName = user
      ? user.displayName || (user.email ? deriveNameFromEmail(user.email) : 'Workspace Owner')
      : guestDisplayName.trim() || 'Guest Collaborator';

    const newTask: Task = sanitizeForFirestore({
      id: taskId,
      title: title.trim().slice(0, 500),
      description: '',
      lane,
      priority,
      originalPriority: priority,
      deadline: dueDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      estimatedHours: 2,
      assignee: assigneeOverride || {
        name: fallbackName.slice(0, 120),
        ...(user?.email ? { email: user.email.toLowerCase() } : {}),
        role: user ? 'Owner' : 'Collaborator',
        initials: deriveInitials(fallbackName),
        ...(user?.photoURL ? { avatar: user.photoURL } : {}),
      },
      tags: ['Daily Life'],
      syncedToCalendar: false,
      escalated: false,
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || 'shared_link_guest',
    });

    const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId);
    try {
      await setDoc(taskDoc, newTask);
      showBanner(`Created "${newTask.title}"`);
    } catch (e) {
      showBanner('Failed to save task. Please try again.', 'warning');
      handleFirestoreError(e, OperationType.CREATE, taskDoc.path);
    }
  };

  // Direct priority toggle from MainTableView
  const handleUpdateTaskPriority = async (taskId: string, newPriority: PriorityType) => {
    if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId);
    try {
      await setDoc(taskDoc, sanitizeForFirestore({ ...task, priority: newPriority }));
      showBanner(`Updated priority to ${newPriority.toUpperCase()}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
    }
  };

  // Reassign task owner to another workspace member
  const handleUpdateTaskAssignee = async (taskId: string, newAssignee: Assignee) => {
    if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId);
    try {
      await setDoc(taskDoc, sanitizeForFirestore({ ...task, assignee: newAssignee }));
      showBanner(`Assigned "${task.title}" to ${newAssignee.name}`);
    } catch (e) {
      showBanner('Failed to reassign task.', 'warning');
      handleFirestoreError(e, OperationType.UPDATE, taskDoc.path);
    }
  };

  // Reschedule deadline (e.g., drag and drop on calendar view)
  const handleUpdateTaskDeadline = async (taskId: string, newDeadlineIso: string) => {
    if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskId);
    try {
      await setDoc(taskDoc, sanitizeForFirestore({ ...task, deadline: newDeadlineIso }));
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

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.task || !canAccessActiveWorkspace || !activeWorkspaceId) return;
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

    const taskDoc = doc(db, `workspaces/${activeWorkspaceId}/tasks`, taskToDelete.id);
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
    <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-200">
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
        activeWorkspaceName={activeWorkspace?.name}
        memberCount={workspaceMembers.length}
        onOpenWorkspaceModal={() => {
          setFocusShareInModal(false);
          setIsWorkspaceModalOpen(true);
        }}
        onOpenShareModal={() => {
          setFocusShareInModal(true);
          setIsWorkspaceModalOpen(true);
        }}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-7">
        {shareLinkError && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{shareLinkError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShareLinkError(null);
                setIncomingShareToken(null);
                window.history.replaceState({}, '', window.location.pathname);
              }}
              className="px-3 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeWorkspace && !isActiveWorkspaceMember && isActiveWorkspacePublicShared && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent-primary)]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Globe className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold text-[var(--text-primary)]">
                  Viewing Shared Workspace: {activeWorkspace.name}
                </span>
                <span className="ml-2 text-[11px] font-mono text-emerald-400">
                  Open link access · Unrestricted
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!user && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
                  {isEditingGuestName ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const cleaned = guestNameDraft.trim().slice(0, 80) || 'Guest Collaborator';
                        setGuestDisplayName(cleaned);
                        sessionStorage.setItem('taskowl_guest_name', cleaned);
                        setIsEditingGuestName(false);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={guestNameDraft}
                        onChange={(e) => setGuestNameDraft(e.target.value)}
                        maxLength={80}
                        className="w-32 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none border-b border-[var(--accent-primary)]"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="text-[11px] text-[var(--text-muted)]">Name:</span>
                      <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                        {guestDisplayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setGuestNameDraft(guestDisplayName);
                          setIsEditingGuestName(true);
                        }}
                        className="text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                        title="Change collaborator display name"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  const url = `${window.location.origin}${window.location.pathname}?share=${activeWorkspace.shareToken}`;
                  await navigator.clipboard?.writeText(url).catch(() => {});
                  setCopiedBannerLink(true);
                  setTimeout(() => setCopiedBannerLink(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
              >
                {copiedBannerLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBannerLink ? 'Copied Link' : 'Copy Share Link'}</span>
              </button>

              {memberWorkspaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIncomingShareToken(null);
                    window.history.replaceState({}, '', window.location.pathname);
                    handleSelectWorkspace(memberWorkspaces[0].id);
                  }}
                  className="px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-lowest)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  My Workspace
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'table' && (
          <MainTableView
            tasks={tasks}
            customization={customization}
            isGoogleConnected={!!user}
            workspaceMembers={workspaceMembers}
            activeWorkspaceName={activeWorkspace?.name}
            onUpdateTaskLane={handleUpdateTaskLane}
            onUpdateTaskPriority={handleUpdateTaskPriority}
            onUpdateTaskDeadline={handleUpdateTaskDeadline}
            onUpdateTaskAssignee={handleUpdateTaskAssignee}
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
            onOpenWorkspaceMembers={() => {
              setFocusShareInModal(false);
              setIsWorkspaceModalOpen(true);
            }}
            onOpenShareWorkspace={() => {
              setFocusShareInModal(true);
              setIsWorkspaceModalOpen(true);
            }}
            onNavigateToAutomations={() => setActiveTab('automations')}
            onNavigateToCalendar={() => setActiveTab('calendar')}
            onUpdateCustomization={handleUpdateCustomization}
            onReorderTasks={handleReorderTasks}
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
            workspaceMembers={workspaceMembers}
            onUpdateTaskLane={handleUpdateTaskLane}
            onUpdateTaskAssignee={handleUpdateTaskAssignee}
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
              if (!user || !activeWorkspaceId) return;
              for (const log of logs) {
                const logDoc = doc(db, `workspaces/${activeWorkspaceId}/logs`, log.id);
                await deleteDoc(logDoc).catch((e) =>
                  handleFirestoreError(e, OperationType.DELETE, logDoc.path)
                );
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
            onSendTestEmail={async (overrideRecipient?: string, overrideMessage?: string) => {
              const token = await getAccessToken();
              if (!token || !user) {
                const msg = 'Connect Google in the top bar to dispatch real emails.';
                showBanner(msg, 'warning');
                throw new Error(msg);
              }
              const recipient = (overrideRecipient || preferences.recipientEmail || user?.email || '').trim();
              if (!recipient) {
                const msg = 'Please connect your Google account or enter a recipient email.';
                showBanner(msg, 'warning');
                throw new Error(msg);
              }
              const sampleTask = tasks.find((t) => t.lane !== 'done') || tasks[0];
              const sampleDeadline = sampleTask
                ? new Date(sampleTask.deadline).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              const rawMsg = overrideMessage !== undefined ? overrideMessage : preferences.customReminderMessage;
              const customHtml = formatCustomReminderHtml(rawMsg, {
                taskTitle: sampleTask?.title || 'Sample Deliverable',
                deadline: sampleDeadline,
                priority: (sampleTask?.priority || 'high').toUpperCase(),
                owner: sampleTask?.assignee?.name || user?.displayName || 'Workspace Member',
                recipientEmail: recipient,
              });
              await sendGmailAlert(
                token,
                recipient,
                '[Reminder Test] TaskOwl Automation Engine',
                `<div style="font-family: sans-serif; background: #000000; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
                  <h2 style="color: #eab308; margin-top: 0;">TaskOwl Reminder Email Preview</h2>
                  ${
                    customHtml
                      ? `<div style="margin: 14px 0; padding: 14px 16px; background: #0b192e; border-left: 3px solid #38bdf8; border-radius: 6px; color: #f8fafc; font-size: 14px; line-height: 1.6;">${customHtml}</div>`
                      : `<p>This is a real-time test notification sent via Google Workspace Gmail API integration to <strong>${escapeHtml(recipient)}</strong>.</p>`
                  }
                  <div style="margin: 16px 0; padding: 16px; background: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
                    <p style="margin: 4px 0;"><strong>Recipient Inbox:</strong> ${escapeHtml(recipient)}</p>
                    <p style="margin: 4px 0;"><strong>Sample Task Context:</strong> ${escapeHtml(sampleTask?.title || 'Sample Deliverable')}</p>
                    <p style="margin: 4px 0;"><strong>Deadline:</strong> ${escapeHtml(sampleDeadline)}</p>
                  </div>
                  <p style="font-size: 12px; color: #94a3b8;">All automated deadline reminders will be routed to this inbox using your saved message.</p>
                </div>`
              );
              addLog(
                'Test Reminder Email Dispatched',
                `Sent test reminder email to ${recipient}.`,
                'success'
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
            onUpdateTaskDeadline={handleUpdateTaskDeadline}
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
        defaultAssigneeName={user?.displayName || guestDisplayName || 'Workspace Owner'}
        defaultAssigneeEmail={user?.email || ''}
        workspaceMembers={workspaceMembers}
        onQuickAddMember={
          isActiveWorkspaceMember
            ? async (email, name, role) =>
                handleAddWorkspaceMember(email, name, role, false)
            : undefined
        }
      />

      {/* Shared Workspace & Team Members Modal */}
      <WorkspaceMembersModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => {
          setIsWorkspaceModalOpen(false);
          setFocusShareInModal(false);
        }}
        currentUserUid={user?.uid || null}
        currentUserEmail={user?.email || null}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        members={workspaceMembers}
        tasks={tasks}
        hasGmailToken={hasOAuthToken}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onRenameWorkspace={handleRenameWorkspace}
        onAddMember={async (email, name, role, sendInviteEmail) => {
          await handleAddWorkspaceMember(email, name, role, sendInviteEmail);
        }}
        onRemoveMember={handleRemoveWorkspaceMember}
        onEnableShareLink={handleEnableShareLink}
        onRegenerateShareLink={handleRegenerateShareLink}
        onDisableShareLink={handleDisableShareLink}
        onSignIn={handleSignIn}
        focusShareSection={focusShareInModal}
      />

      {/* Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        onMarkAsRead={async (id) => {
          if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
          const n = notifications.find((notif) => notif.id === id);
          if (!n) return;
          const notifDoc = doc(db, `workspaces/${activeWorkspaceId}/notifications`, id);
          try {
            await setDoc(notifDoc, sanitizeForFirestore({ ...n, read: true }));
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, notifDoc.path);
          }
        }}
        onMarkAllAsRead={async () => {
          if (!canAccessActiveWorkspace || !activeWorkspaceId) return;
          for (const n of notifications) {
            if (!n.read) {
              const notifDoc = doc(db, `workspaces/${activeWorkspaceId}/notifications`, n.id);
              await setDoc(notifDoc, sanitizeForFirestore({ ...n, read: true })).catch((e) =>
                handleFirestoreError(e, OperationType.UPDATE, notifDoc.path)
              );
            }
          }
          showBanner('All notifications marked as read.', 'info');
        }}
        onClearAll={async () => {
          if (!isActiveWorkspaceMember || !activeWorkspaceId) return;
          for (const n of notifications) {
            const notifDoc = doc(db, `workspaces/${activeWorkspaceId}/notifications`, n.id);
            await deleteDoc(notifDoc).catch((e) =>
              handleFirestoreError(e, OperationType.DELETE, notifDoc.path)
            );
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

