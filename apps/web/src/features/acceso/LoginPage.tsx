import { useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../shared/auth/client';
import { FullPageMessage, ME_KEY, useSession } from '../../shared/auth/session';
import { Alert, Button, TextField } from '../../shared/ui/form';

const REASONS: Record<string, string> = {
  disabled: 'Tu cuenta está desactivada. Habla con el administrador.',
  not_provisioned: 'Tu cuenta no tiene un rol asignado. Habla con el administrador.',
};

/** Ingreso con correo y contraseña, y código de 6 dígitos si el usuario tiene segundo factor (RF-001). */
export function LoginPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session.status === 'loading') return <FullPageMessage>Cargando…</FullPageMessage>;
  if (session.status === 'authenticated') return <Navigate to="/" replace />;

  const reason = params.get('motivo');
  const next = params.get('siguiente');

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ME_KEY });
    void navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
  };

  const submitCredentials = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(
        err.status === 401
          ? 'Correo o contraseña incorrectos.'
          : 'No fue posible ingresar. Si tu cuenta fue desactivada, habla con el administrador.',
      );
      return;
    }
    if ('twoFactorRedirect' in data && data.twoFactorRedirect) {
      setStep('code');
      return;
    }
    await finish();
  };

  const submitCode = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    if (err) {
      setError('El código no es válido o ya venció. Escribe el que muestra ahora tu aplicación.');
      return;
    }
    await finish();
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-chimichurri-strong">Quatreros</h1>
        <p className="mt-1 text-ink-muted">
          {step === 'credentials' ? 'Ingresa con tu correo de trabajo.' : 'Verificación en dos pasos.'}
        </p>

        <div className="mt-6 rounded-panel border border-line bg-panel p-5">
          {reason && REASONS[reason] && step === 'credentials' ? (
            <div className="mb-4">
              <Alert>{REASONS[reason]}</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          {step === 'credentials' ? (
            <form className="flex flex-col gap-4" onSubmit={(e) => void submitCredentials(e)}>
              <TextField
                label="Correo"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
              />
              <TextField
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
              />
              <Button type="submit" disabled={busy}>
                {busy ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={(e) => void submitCode(e)}>
              <TextField
                label="Código de 6 dígitos"
                hint="Ábrelo en tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator…)."
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                className="tabular tracking-widest"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                }}
              />
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? 'Verificando…' : 'Verificar'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStep('credentials');
                  setCode('');
                  setError(null);
                }}
              >
                Volver
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
