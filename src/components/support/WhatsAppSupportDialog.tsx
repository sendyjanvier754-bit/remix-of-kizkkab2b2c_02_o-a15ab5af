import { useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useWhatsAppSupport } from '@/hooks/useWhatsAppSupport';

const leadSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre').max(80, 'Nombre demasiado largo'),
  email: z.string().trim().email('Correo inválido').max(255, 'Correo demasiado largo'),
  message: z.string().trim().max(500, 'Mensaje demasiado largo').optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppSupportDialog({ open, onOpenChange }: Props) {
  const { registerLead, openWhatsApp } = useWhatsAppSupport();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsed = leadSchema.safeParse({ name, email, message });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        next[String(i.path[0])] = i.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();
    const text = `Hola, soy ${cleanName} (${cleanEmail}).${
      cleanMessage ? ` ${cleanMessage}` : ' Necesito ayuda.'
    }`;
    // Preserve the browser's user gesture so WhatsApp opens outside the preview iframe.
    openWhatsApp(text);
    setSubmitting(true);
    await registerLead({ name: cleanName, email: cleanEmail, message: cleanMessage });
    setSubmitting(false);
    onOpenChange(false);
    setMessage('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Ayuda por WhatsApp
          </DialogTitle>
          <DialogDescription>
            Déjanos tus datos y continuamos la conversación en WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="wa-name">Nombre</Label>
            <Input id="wa-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-email">Correo electrónico</Label>
            <Input id="wa-email" type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-message">¿En qué podemos ayudarte? (opcional)</Label>
            <Textarea id="wa-message" value={message} maxLength={500} rows={3} onChange={(e) => setMessage(e.target.value)} />
            {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white">
            {submitting ? 'Abriendo...' : 'Abrir WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
