import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const NotificationsContext = createContext({
  notifications: [],
  setNotifications: () => {},
  addNotification: () => {},
  unreadCount: 0,
  markAllRead: () => {},
  toggleRead: () => {},
});

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([
    { id: '1', type: 'info', title: 'New results ready', message: 'Math Quiz - Class 5A is fully graded.', time: '2h ago', read: false },
    { id: '2', type: 'success', title: 'Scan successful', message: 'Paper scanned and processed.', time: '5h ago', read: true },
    { id: '3', type: 'warning', title: 'Low lighting detected', message: 'Scanning quality may be affected.', time: '1d ago', read: true },
    { id: '4', type: 'info', title: 'App update', message: 'Performance improvements and bug fixes.', time: '2d ago', read: false },
  ]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const toggleRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: !n.read } : n)));
  }, []);

  const addNotification = useCallback((notification) => {
    const newNotif = {
      id: Date.now().toString(),
      time: 'Just now',
      read: false,
      ...notification,
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]); // Keep max 50
  }, []);

  const value = useMemo(() => ({
    notifications,
    setNotifications,
    addNotification,
    unreadCount,
    markAllRead,
    toggleRead,
  }), [notifications, unreadCount, markAllRead, toggleRead, addNotification]);

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
