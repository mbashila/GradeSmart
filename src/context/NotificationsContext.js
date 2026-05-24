import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const NotificationsContext = createContext({
  notifications: [],
  setNotifications: () => {},
  addNotification: () => {},
  unreadCount: 0,
  markAllRead: () => {},
  toggleRead: () => {},
  loading: true,
});

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function mapRow(row) {
  return {
    id: row.id,
    type: row.type || 'info',
    title: row.title || '',
    message: row.message || '',
    time: timeAgo(row.created_at),
    createdAt: row.created_at,
    read: row.read ?? false,
  };
}

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef(null);

  // Fetch initial notifications and subscribe to realtime
  useEffect(() => {
    let mounted = true;
    let channel = null;

    (async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false);
        return;
      }

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      userIdRef.current = userId;

      if (!userId) {
        if (mounted) setLoading(false);
        return;
      }

      // Fetch existing notifications
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data && mounted) {
          setNotifications(data.map(mapRow));
        }
      } catch (e) {
        console.log('Notifications fetch error:', e);
      }

      if (mounted) setLoading(false);

      // Subscribe to realtime inserts
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new && mounted) {
              setNotifications(prev => [mapRow(payload.new), ...prev].slice(0, 50));
            }
          }
        )
        .subscribe();
    })();

    // Also listen for auth changes (user login/logout)
    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      const newUserId = sess?.user?.id;
      if (newUserId === userIdRef.current) return;
      userIdRef.current = newUserId;

      // Cleanup old channel
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      if (!newUserId) {
        if (mounted) {
          setNotifications([]);
          setLoading(false);
        }
        return;
      }

      // Refetch for new user
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', newUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data && mounted) {
          setNotifications(data.map(mapRow));
        }
      } catch {}

      // Re-subscribe
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${newUserId}`,
          },
          (payload) => {
            if (payload.new && mounted) {
              setNotifications(prev => [mapRow(payload.new), ...prev].slice(0, 50));
            }
          }
        )
        .subscribe();
    });

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      authSub?.subscription?.unsubscribe?.();
    };
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Persist to Supabase
    if (isSupabaseConfigured && userIdRef.current) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userIdRef.current)
          .eq('read', false);
      } catch {}
    }
  }, []);

  const toggleRead = useCallback(async (id) => {
    let newRead = false;
    setNotifications(prev => prev.map(n => {
      if (n.id === id) {
        newRead = !n.read;
        return { ...n, read: newRead };
      }
      return n;
    }));
    // Persist to Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase.from('notifications').update({ read: newRead }).eq('id', id);
      } catch {}
    }
  }, []);

  const addNotification = useCallback(async (notification) => {
    const newNotif = {
      id: Date.now().toString(),
      time: 'Just now',
      read: false,
      ...notification,
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);

    // Also persist to Supabase if possible
    if (isSupabaseConfigured && userIdRef.current) {
      try {
        await supabase.from('notifications').insert({
          user_id: userIdRef.current,
          type: newNotif.type || 'info',
          title: newNotif.title,
          message: newNotif.message,
          read: false,
        });
      } catch {}
    }
  }, []);

  const value = useMemo(() => ({
    notifications,
    setNotifications,
    addNotification,
    unreadCount,
    markAllRead,
    toggleRead,
    loading,
  }), [notifications, unreadCount, markAllRead, toggleRead, addNotification, loading]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

export default NotificationsContext;
