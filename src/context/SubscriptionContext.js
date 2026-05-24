import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import storage from '../utils/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext({
  subscription: null,
  loading: true,
  subscribe: async () => ({ error: null }),
  cancelSubscription: async () => ({ error: null }),
  isActive: false,
  isPro: false,
  planLabel: 'Free',
});

const PLANS = {
  free: { id: 'free', label: 'Free', price: 0, scansPerMonth: 20, testsLimit: 1, aiGrading: false, storage: 100 },
  monthly: { id: 'monthly', label: 'Pro Monthly', price: 9.99, scansPerMonth: -1, testsLimit: -1, aiGrading: true, storage: 5000 },
  yearly: { id: 'yearly', label: 'Pro Yearly', price: 79.99, scansPerMonth: -1, testsLimit: -1, aiGrading: true, storage: 5000 },
};

export { PLANS };

export function SubscriptionProvider({ children }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Hydrate subscription from local cache, then Supabase
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Local cache first
      try {
        const raw = await storage.getItem('@gradesmart:subscription');
        if (mounted && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed) setSubscription(parsed);
          } catch {}
        }
      } catch {}

      // Sync from Supabase
      if (isSupabaseConfigured && user?.id) {
        try {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data && mounted) {
            const sub = {
              id: data.id,
              planId: data.plan_id || 'free',
              status: data.status || 'inactive',
              currentPeriodStart: data.current_period_start,
              currentPeriodEnd: data.current_period_end,
              cancelledAt: data.cancelled_at,
              createdAt: data.created_at,
            };
            setSubscription(sub);
          }
        } catch {}
      }

      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Persist locally
  useEffect(() => {
    if (loading) return;
    storage.setItem('@gradesmart:subscription', JSON.stringify(subscription));
  }, [subscription, loading]);

  const isActive = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status !== 'active') return false;
    if (subscription.currentPeriodEnd) {
      return new Date(subscription.currentPeriodEnd) > new Date();
    }
    return true;
  }, [subscription]);

  const isPro = useMemo(() => {
    return isActive && subscription?.planId !== 'free';
  }, [isActive, subscription]);

  const planLabel = useMemo(() => {
    if (!subscription || subscription.planId === 'free') return 'Free';
    return PLANS[subscription.planId]?.label || 'Free';
  }, [subscription]);

  const currentPlan = useMemo(() => {
    return PLANS[subscription?.planId] || PLANS.free;
  }, [subscription]);

  const subscribe = useCallback(async (planId) => {
    // Simulated subscription flow for all 3 plans
    const now = new Date();
    const periodEnd = new Date(now);
    if (planId === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (planId === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const plan = PLANS[planId] || PLANS.free;
    const userEmail = user?.email || null;

    const sub = {
      id: subscription?.id || Date.now().toString(),
      planId,
      status: planId === 'free' ? 'inactive' : 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: planId === 'free' ? null : periodEnd.toISOString(),
      cancelledAt: null,
      createdAt: subscription?.createdAt || now.toISOString(),
      email: userEmail,
    };

    setSubscription(sub);

    if (isSupabaseConfigured && user?.id) {
      try {
        // Upsert subscription record linked to user email
        await supabase.from('subscriptions').upsert({
          id: sub.id,
          user_id: user.id,
          email: userEmail,
          plan_id: planId,
          status: sub.status,
          current_period_start: sub.currentPeriodStart,
          current_period_end: sub.currentPeriodEnd,
          cancelled_at: null,
          created_at: sub.createdAt,
          updated_at: now.toISOString(),
        }, { onConflict: 'id' });

        // Log subscription activity for notifications
        await supabase.from('activities').insert({
          user_id: user.id,
          type: 'subscription_changed',
          meta: {
            plan_id: planId,
            plan_label: plan.label,
            email: userEmail,
            status: sub.status,
            period_end: sub.currentPeriodEnd,
          },
        });

        // Insert a notification record so realtime picks it up
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'success',
          title: planId === 'free' ? 'Switched to Free Plan' : `${plan.label} Activated!`,
          message: planId === 'free'
            ? 'You are now on the Free plan.'
            : `Your ${plan.label} subscription is active until ${periodEnd.toLocaleDateString()}. A confirmation has been sent to ${userEmail || 'your email'}.`,
        });
      } catch (e) {
        console.log('Subscription sync error:', e);
      }
    }

    return { error: null };
  }, [subscription, user]);

  const cancelSubscription = useCallback(async () => {
    if (!subscription) return { error: 'No active subscription' };

    const now = new Date().toISOString();
    const updated = { ...subscription, status: 'cancelled', cancelledAt: now };
    setSubscription(updated);

    if (isSupabaseConfigured && user?.id && subscription.id) {
      try {
        await supabase.from('subscriptions').update({
          status: 'cancelled',
          cancelled_at: now,
          updated_at: now,
        }).eq('id', subscription.id).eq('user_id', user.id);
      } catch {}
    }

    return { error: null };
  }, [subscription, user]);

  const value = useMemo(() => ({
    subscription,
    loading,
    subscribe,
    cancelSubscription,
    isActive,
    isPro,
    planLabel,
    currentPlan,
  }), [subscription, loading, subscribe, cancelSubscription, isActive, isPro, planLabel, currentPlan]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export default SubscriptionContext;
