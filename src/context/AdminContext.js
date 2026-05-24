import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AdminContext = createContext({
  users: [],
  stats: null,
  queries: [],
  activeUsers: [],
  loading: false,
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
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_users');
      if (error) {
        console.log('Admin fetchUsers error:', error);
        return;
      }
      setUsers(data || []);
    } catch (e) {
      console.log('Admin fetchUsers exception:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('admin_get_stats');
      if (error) {
        console.log('Admin fetchStats error:', error);
        return;
      }
      setStats(data || null);
    } catch (e) {
      console.log('Admin fetchStats exception:', e);
    }
  }, []);

  const fetchQueries = useCallback(async (status = 'all') => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('admin_get_queries', { p_status: status });
      if (error) {
        console.log('Admin fetchQueries error:', error);
        return;
      }
      setQueries(data || []);
    } catch (e) {
      console.log('Admin fetchQueries exception:', e);
    }
  }, []);

  const fetchActiveUsers = useCallback(async (period = 'week') => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('admin_get_active_users', { p_period: period });
      if (error) {
        console.log('Admin fetchActiveUsers error:', error);
        return;
      }
      setActiveUsers(data || []);
    } catch (e) {
      console.log('Admin fetchActiveUsers exception:', e);
    }
  }, []);

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
    loading,
    fetchUsers,
    fetchStats,
    fetchQueries,
    fetchActiveUsers,
    updateUserRole,
    toggleBan,
    replyToQuery,
  }), [users, stats, queries, activeUsers, loading, fetchUsers, fetchStats, fetchQueries, fetchActiveUsers, updateUserRole, toggleBan, replyToQuery]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
