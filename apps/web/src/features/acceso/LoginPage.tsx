import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../shared/auth/client';
import { FullPageMessage, ME_KEY, useSession } from '../../shared/auth/session';
import { BrandMark } from '../../shared/ui/Brand';
import { Alert, Button, PasswordField, TextField } from '../../shared/ui/form';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

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
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  useDocumentTitle(step === 'credentials' ? 'Ingresar' : 'Código de verificación');

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
      // El botón se deshabilita durante el envío y el foco se perdería: se devuelve al campo.
      passwordRef.current?.focus();
      passwordRef.current?.select();
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
      codeRef.current?.focus();
      codeRef.current?.select();
      return;
    }
    await finish();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-char px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <h1 className="text-display font-bold tracking-tight">Quatreros</h1>
        </div>
        <p className="mt-3 text-ash">
          {step === 'credentials' ? 'Ingresa con tu correo de trabajo.' : 'Verificación en dos pasos.'}
        </p>

        <div className="mt-6 rounded-2xl border border-grill bg-smoke p-5 shadow-xl md:p-6">
          {reason && REASONS[reason] && step === 'credentials' ? (
            <div className="mb-4">
              <Alert>{REASONS[reason]}</Alert>
            </div>
          ) : null}
          {error ? (
            <div className="mb-4">
              <Alert id="error-ingreso">{error}</Alert>
            </div>
          ) : null}

          {step === 'credentials' ? (
            <form className="flex flex-col gap-5" onSubmit={(e) => void submitCredentials(e)}>
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
              <PasswordField
                ref={passwordRef}
                label="Contraseña"
                autoComplete="current-password"
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'error-ingreso' : undefined}
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
            <form className="flex flex-col gap-5" onSubmit={(e) => void submitCode(e)}>
              <TextField
                ref={codeRef}
                label="Código de 6 dígitos"
                hint="Ábrelo en tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator…)."
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                aria-invalid={error ? true : undefined}
                className="font-mono text-title tracking-[0.4em]"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                }}
              />
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? 'Verificando…' : 'Verificar'}
              </Button>
              <Button
                variant="ghost"
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
