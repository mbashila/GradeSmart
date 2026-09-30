import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured, withRequestTimeout } from '../lib/supabase';

const IDLE = { loading: false, loaded: false, error: null };
const INITIAL_STATUS = { users: IDLE, stats: IDLE, queries: IDLE, activeUsers: IDLE };

const AdminContext = createContext({
  users: [],
  stats: null,
  queries: [],
  activeUsers: [],
  loading: false,
  status: INITIAL_STATUS,
  fetchUsers: async () => {},
  fetchStats: async () => {},
  fetchQueries: async () => {},
  fetchActiveUsers: async () => {},
  updateUserRole: async () => ({ error: null }),
  toggleBan: async () => ({ error: null }),
  replyToQuery: async () => ({ error: null }),
});

export function AdminProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [queries, setQueries] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [status, setStatus] = useState(INITIAL_STATUS);

  const setResourceStatus = useCallback((key, patch) => {
    setStatus((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  // Runs one admin RPC with a loading -> success | error lifecycle so screens
  // can tell a pending request from a failed one.
  const runRpc = useCallback(async (key, fn, args, onData) => {
    if (!isSupabaseConfigured) return;
    setResourceStatus(key, { loading: true, error: null });
    try {
      const { data, error } = await withRequestTimeout((signal) => supabase.rpc(fn, args).abortSignal(signal));
      if (error) throw error;
      onData(data);
      setResourceStatus(key, { loading: false, loaded: true, error: null });
    } catch (e) {
      console.log(`Admin ${fn} error:`, e?.message || e);
      setResourceStatus(key, { loading: false, error: e });
    }
  }, [setResourceStatus]);

  const fetchUsers = useCallback(
    () => runRpc('users', 'admin_get_users', undefined, (data) => setUsers(data || [])),
    [runRpc]
  );

  const fetchStats = useCallback(
    () => runRpc('stats', 'admin_get_stats', undefined, (data) => setStats(data || null)),
    [runRpc]
  );

  const fetchQueries = useCallback(
    (queryStatus = 'all') => runRpc('queries', 'admin_get_queries', { p_status: queryStatus }, (data) => setQueries(data || [])),
    [runRpc]
  );

  const fetchActiveUsers = useCallback(
    (period = 'week') => runRpc('activeUsers', 'admin_get_active_users', { p_period: period }, (data) => setActiveUsers(data || [])),
    [runRpc]
  );

  const updateUserRole = useCallback(async (targetUserId, newRole) => {
    if (!isSupabaseConfigured) return { error: { message: 'Not configured' } };
    try {
      const { error } = await supabase.rpc('admin_update_role', {
        target_user_id: targetUserId,
        new_role: newRole,
      });
      if (!error) {
        setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      }
      return { error };
    } catch (e) {
      return { error: { message: e.message } };
    }
  }, []);

  const toggleBan = useCallback(async (targetUserId, shouldBan, reason = null) => {
    if (!isSupabaseConfigured) return { error: { message: 'Not configured' } };
    try {
      const { error } = await supabase.rpc('admin_toggle_ban', {
        target_user_id: targetUserId,
        should_ban: shouldBan,
        reason,
      });
      if (!error) {
        setUsers(prev => prev.map(u =>
          u.id === targetUserId ? { ...u, is_banned: shouldBan, ban_reason: reason } : u
        ));
      }
      return { error };
    } catch (e) {
      return { error: { message: e.message } };
    }
  }, []);

  const replyToQuery = useCallback(async (queryId, reply, status = 'resolved') => {
    if (!isSupabaseConfigured) return { error: { message: 'Not configured' } };
    try {
      const { error } = await supabase.rpc('admin_reply_query', {
        p_query_id: queryId,
        p_reply: reply,
        p_status: status,
      });
      if (!error) {
        setQueries(prev => prev.map(q =>
          q.id === queryId ? { ...q, admin_reply: reply, status, replied_at: new Date().toISOString() } : q
        ));
      }
      return { error };
    } catch (e) {
      return { error: { message: e.message } };
    }
  }, []);

  const value = useMemo(() => ({
    users,
    stats,
    queries,
    activeUsers,
    loading: status.users.loading,
    status,
    fetchUsers,
    fetchStats,
    fetchQueries,
    fetchActiveUsers,
    updateUserRole,
    toggleBan,
    replyToQuery,
  }), [users, stats, queries, activeUsers, status, fetchUsers, fetchStats, fetchQueries, fetchActiveUsers, updateUserRole, toggleBan, replyToQuery]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
