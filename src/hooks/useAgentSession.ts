import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AgentSession {
  id: string;
  agent_id: string;
  target_user_id: string;
  status: string;
  session_expires_at: string | null;
  verified_at: string | null;
  created_at: string;
}

interface TargetUserInfo {
  id: string;
  full_name: string;
  email: string;
}

export function useAgentSession() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null);
  const [targetUser, setTargetUser] = useState<TargetUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Load active sessions
  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('agent_id', user.id)
      .in('status', ['active', 'pending_verification'])
      .order('created_at', { ascending: false });
    if (data) setSessions(data as AgentSession[]);
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Timer for active session
  useEffect(() => {
    if (!activeSession?.session_expires_at) { setTimeRemaining(0); return; }
    const update = () => {
      const remaining = Math.max(0, new Date(activeSession.session_expires_at!).getTime() - Date.now());
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        setActiveSession(null);
        toast.error('Sesión de agente expirada');
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Request OTP
  const requestOTP = useCallback(async (targetUserId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-agent-otp', {
        body: { target_user_id: targetUserId },
      });
      if (error) throw error;
      const channels = [];
      if (data.whatsapp_sent) channels.push('WhatsApp');
      channels.push('notificación in-app');
      toast.success(`Código enviado a ${data.target_user_name} vía ${channels.join(' y ')}`);
      await loadSessions();
      return data;
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar código');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  // Verify OTP
  const verifyOTP = useCallback(async (sessionId: string, code: string) => {
    setIsLoading(true);
    try {
      // Read session to validate code
      const { data: session, error } = await supabase
        .from('agent_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) throw new Error('Sesión no encontrada');
      if (session.status !== 'pending_verification') throw new Error('Sesión no está pendiente');
      if (new Date(session.code_expires_at) < new Date()) throw new Error('Código expirado');
      if (session.verification_code !== code) throw new Error('Código incorrecto');

      // Activate session
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h
      const { data: updated, error: updateError } = await supabase
        .from('agent_sessions')
        .update({
          status: 'active',
          verified_at: new Date().toISOString(),
          session_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Load target user info
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', session.target_user_id)
        .single();

      setActiveSession(updated as AgentSession);
      if (profile) setTargetUser(profile as TargetUserInfo);
      toast.success('Sesión activada. Tienes 2 horas.');
      await loadSessions();
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Error al verificar código');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  // Close session
  const closeSession = useCallback(async (sessionId: string) => {
    await supabase
      .from('agent_sessions')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setTargetUser(null);
    }
    await loadSessions();
    toast.info('Sesión cerrada');
  }, [activeSession, loadSessions]);

  // Resume a session
  const resumeSession = useCallback(async (session: AgentSession) => {
    if (session.status !== 'active' || !session.session_expires_at) return;
    if (new Date(session.session_expires_at) < new Date()) {
      toast.error('Esta sesión ha expirado');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', session.target_user_id)
      .single();
    setActiveSession(session);
    if (profile) setTargetUser(profile as TargetUserInfo);
  }, []);

  return {
    sessions,
    activeSession,
    targetUser,
    isLoading,
    timeRemaining,
    requestOTP,
    verifyOTP,
    closeSession,
    resumeSession,
    loadSessions,
  };
}
