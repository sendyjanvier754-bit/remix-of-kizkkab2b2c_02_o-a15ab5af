import { useState } from 'react';
import { useAgentSession } from '@/hooks/useAgentSession';
import { useAgentCartDraft } from '@/hooks/useAgentCartDraft';
import AgentUserSearch from '@/components/agent/AgentUserSearch';
import AgentOTPVerification from '@/components/agent/AgentOTPVerification';
import AgentSessionTimer from '@/components/agent/AgentSessionTimer';
import AgentDraftList from '@/components/agent/AgentDraftList';
import AgentProductSelector from '@/components/agent/AgentProductSelector';
import AgentCartDraft from '@/components/agent/AgentCartDraft';
import AgentShippingConfig from '@/components/agent/AgentShippingConfig';
import { RoleAwareLayout } from '@/components/layout/RoleAwareLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Step = 'search' | 'otp' | 'workspace';

export default function AdminAgentOrders() {
  const [step, setStep] = useState<Step>('search');
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingUserName, setPendingUserName] = useState('');

  const {
    sessions,
    activeSession,
    targetUser,
    isLoading: sessionLoading,
    timeRemaining,
    requestOTP,
    verifyOTP,
    closeSession,
    resumeSession,
  } = useAgentSession();

  const {
    drafts,
    activeDraft,
    draftItems,
    isLoading: draftLoading,
    draftSubtotal,
    draftItemCount,
    createDraft,
    selectDraft,
    addItem,
    updateItemQuantity,
    removeItem,
    updateShippingAddress,
    updateMarketCountry,
    pushToCheckout,
    cancelDraft,
  } = useAgentCartDraft();

  const handleSelectUser = async (userId: string) => {
    try {
      const result = await requestOTP(userId);
      if (result) {
        setPendingSessionId(result.session_id);
        setPendingUserName(result.target_user_name);
        setStep('otp');
      }
    } catch { }
  };

  const handleVerifyOTP = async (sessionId: string, code: string) => {
    try {
      const result = await verifyOTP(sessionId, code);
      if (result) {
        // Create a draft for this session
        await createDraft(result.target_user_id, result.id);
        setStep('workspace');
      }
    } catch { }
  };

  const handleCloseSession = async () => {
    if (activeSession) {
      await closeSession(activeSession.id);
      setStep('search');
    }
  };

  const handleNewDraft = async () => {
    if (activeSession && targetUser) {
      await createDraft(targetUser.id, activeSession.id);
    }
  };

  // If there's an active session, go directly to workspace
  const effectiveStep = activeSession ? 'workspace' : step;

  return (
    <RoleAwareLayout title="Pedidos por Agente" subtitle="Crea pedidos en nombre de los usuarios">
      {activeSession && targetUser && (
        <div className="mb-4">
          <AgentSessionTimer
            targetUserName={targetUser.full_name}
            timeRemaining={timeRemaining}
            onClose={handleCloseSession}
          />
        </div>
      )}
        {effectiveStep === 'search' && (
          <div className="max-w-lg mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Iniciar Sesión de Asistencia</CardTitle>
              </CardHeader>
              <CardContent>
                <AgentUserSearch onSelectUser={handleSelectUser} isLoading={sessionLoading} />
              </CardContent>
            </Card>

            {/* Resume active sessions */}
            {sessions.filter(s => s.status === 'active').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sesiones Activas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sessions.filter(s => s.status === 'active').map(s => (
                    <Button
                      key={s.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => resumeSession(s)}
                    >
                      Reanudar sesión ({s.target_user_id.slice(0, 8)}...)
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Existing drafts */}
            <AgentDraftList
              drafts={drafts}
              activeDraftId={activeDraft?.id || null}
              onSelect={(d) => { selectDraft(d as any); setStep('workspace'); }}
              onCancel={cancelDraft}
            />
          </div>
        )}

        {effectiveStep === 'otp' && pendingSessionId && (
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="p-6">
                <AgentOTPVerification
                  sessionId={pendingSessionId}
                  targetUserName={pendingUserName}
                  onVerify={handleVerifyOTP}
                  isLoading={sessionLoading}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {effectiveStep === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left sidebar - Drafts */}
            <div className="lg:col-span-2 space-y-4">
              <Button onClick={handleNewDraft} size="sm" variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Nuevo Borrador
              </Button>
              <AgentDraftList
                drafts={drafts}
                activeDraftId={activeDraft?.id || null}
                onSelect={(d) => selectDraft(d as any)}
                onCancel={cancelDraft}
              />
            </div>

            {/* Center - Product selector */}
            <div className="lg:col-span-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Seleccionar Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <AgentProductSelector onAddProduct={addItem} />
                </CardContent>
              </Card>
            </div>

            {/* Right sidebar - Cart + Shipping */}
            <div className="lg:col-span-4 space-y-4">
              <AgentCartDraft
                items={draftItems}
                subtotal={draftSubtotal}
                itemCount={draftItemCount}
                onUpdateQuantity={updateItemQuantity}
                onRemoveItem={removeItem}
                onPushToCheckout={pushToCheckout}
                isLoading={draftLoading}
                draftStatus={activeDraft?.status || 'draft'}
              />
              {activeDraft?.status === 'draft' && (
                <AgentShippingConfig
                  shippingAddress={activeDraft?.shipping_address}
                  onUpdate={updateShippingAddress}
                  marketCountry={activeDraft?.market_country || null}
                  onUpdateCountry={updateMarketCountry}
                />
              )}
            </div>
          </div>
        )}
    </RoleAwareLayout>
  );
}
