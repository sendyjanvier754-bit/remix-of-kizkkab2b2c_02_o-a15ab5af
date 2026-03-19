import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OnboardingStep = 'store_info' | 'social_media' | 'address' | 'payment_methods' | 'complete';

const STEPS_ORDER: OnboardingStep[] = ['store_info', 'social_media', 'address', 'payment_methods', 'complete'];

export interface OnboardingProgress {
  id: string;
  user_id: string;
  steps_completed: Record<string, boolean>;
  current_step: OnboardingStep;
  is_complete: boolean;
}

export const useSellerOnboarding = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: progress, isLoading } = useQuery({
    queryKey: ['seller-onboarding', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('seller_onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as OnboardingProgress | null;
    },
    enabled: !!user?.id,
  });

  const completeStep = useMutation({
    mutationFn: async (step: OnboardingStep) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const currentSteps = progress?.steps_completed || {};
      const newSteps = { ...currentSteps, [step]: true };
      
      // Calculate next step
      const stepIndex = STEPS_ORDER.indexOf(step);
      const nextStep = stepIndex < STEPS_ORDER.length - 1 ? STEPS_ORDER[stepIndex + 1] : 'complete';
      const allDone = STEPS_ORDER.slice(0, -1).every(s => newSteps[s]);

      const { error } = await supabase
        .from('seller_onboarding_progress')
        .upsert({
          user_id: user.id,
          steps_completed: newSteps,
          current_step: allDone ? 'complete' : nextStep,
          is_complete: allDone,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // If completing onboarding, no notification needed
      if (!allDone) {
        // Insert reminder notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Completa la configuración de tu tienda',
          message: `Siguiente paso: ${getStepLabel(nextStep as OnboardingStep)}`,
          type: 'system',
          data: { action_url: '/seller/cuenta' },
        }).then(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-onboarding'] });
    },
  });

  const initOnboarding = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('seller_onboarding_progress')
        .upsert({
          user_id: user.id,
          steps_completed: {},
          current_step: 'store_info',
          is_complete: false,
        }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-onboarding'] });
    },
  });

  const getStepIndex = (step: OnboardingStep) => STEPS_ORDER.indexOf(step);
  const totalSteps = STEPS_ORDER.length - 1; // exclude 'complete'
  const completedCount = Object.values(progress?.steps_completed || {}).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return {
    progress,
    isLoading,
    completeStep,
    initOnboarding,
    getStepIndex,
    totalSteps,
    completedCount,
    progressPercent,
    stepsOrder: STEPS_ORDER,
    isOnboardingComplete: progress?.is_complete ?? false,
    currentStep: (progress?.current_step || 'store_info') as OnboardingStep,
  };
};

export const getStepLabel = (step: OnboardingStep): string => {
  const labels: Record<OnboardingStep, string> = {
    store_info: 'Información de tienda',
    social_media: 'Redes sociales',
    address: 'Dirección',
    payment_methods: 'Métodos de pago',
    complete: 'Completado',
  };
  return labels[step] || step;
};
