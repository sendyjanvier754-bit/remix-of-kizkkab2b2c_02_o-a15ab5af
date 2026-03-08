import { useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

interface AgentOTPVerificationProps {
  sessionId: string;
  targetUserName: string;
  onVerify: (sessionId: string, code: string) => Promise<any>;
  isLoading?: boolean;
}

export default function AgentOTPVerification({
  sessionId,
  targetUserName,
  onVerify,
  isLoading,
}: AgentOTPVerificationProps) {
  const [code, setCode] = useState('');

  const handleSubmit = () => {
    if (code.length === 6) {
      onVerify(sessionId, code);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
        <ShieldCheck className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Verificación de Acceso</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Se ha enviado un código de 6 dígitos a <strong>{targetUserName}</strong>.
          Solicítalo al usuario e ingrésalo aquí.
        </p>
      </div>
      <InputOTP maxLength={6} value={code} onChange={setCode}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <Button onClick={handleSubmit} disabled={code.length !== 6 || isLoading} className="w-full max-w-xs">
        Verificar Código
      </Button>
    </div>
  );
}
