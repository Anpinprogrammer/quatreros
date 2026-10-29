import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { renderSVG } from 'uqr';
import { authClient } from '../../shared/auth/client';
import { FullPageMessage, ME_KEY, useSession, useSignOut } from '../../shared/auth/session';
import { Alert, Button, PasswordField, TextField } from '../../shared/ui/form';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';
import { BackupCodes } from './BackupCodes';

type Step =
  | { kind: 'password' }
  | { kind: 'scan'; uri: string; backupCodes: string[] }
  | { kind: 'codes'; backupCodes: string[] };

/**
 * Configuración guiada del segundo factor (DEC-043): contraseña → QR → primer código → códigos de respaldo.
 */
export function MfaSetupPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useDocumentTitle('Verificación en dos pasos');

  const qr = useMemo(() => {
    if (step.kind !== 'scan') return null;
    return `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(step.uri, { border: 2 }))}`;
  }, [step]);
  const manualKey = step.kind === 'scan' ? new URL(step.uri).searchParams.get('secret') : null;

  if (session.status === 'loading') return <FullPageMessage>Cargando…</FullPageMessage>;
  if (session.status === 'anonymous') return <Navigate to="/ingresar" replace />;
  if (session.me.mfa.enabled && step.kind !== 'codes') return <Navigate to="/" replace />;

  const start = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (err || !('totpURI' in data)) {
      setError('La contraseña no es correcta.');
      passwordRef.current?.focus();
      return;
    }
    setPassword('');
    setStep({ kind: 'scan', uri: data.totpURI, backupCodes: data.backupCodes });
  };

  const confirm = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== 'scan') return;
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (err) {
      setError(
        'El código no coincide. Revisa que la hora del celular sea automática y escribe el código actual.',
      );
      codeRef.current?.focus();
      codeRef.current?.select();
      return;
    }
    setStep({ kind: 'codes', backupCodes: step.backupCodes });
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">Verificación en dos pasos</h1>
      <p className="mt-2 text-ink-muted">
        Tu rol maneja información sensible, así que además de la contraseña pediremos un código de tu celular
        al ingresar.
      </p>

      <ol className="mt-6 flex gap-2 text-sm" aria-label="Pasos">
        {['Confirmar contraseña', 'Vincular aplicación', 'Guardar códigos'].map((label, i) => {
          const index = { password: 0, scan: 1, codes: 2 }[step.kind];
          return (
            <li
              key={label}
              aria-current={i === index ? 'step' : undefined}
              className={`flex-1 rounded-control px-2 py-1 ${i === index ? 'bg-chimichurri-soft font-semibold text-chimichurri-strong' : 'text-ink-muted'}`}
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-panel border border-line bg-panel p-5">
        {error ? (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        {step.kind === 'password' ? (
          <form className="flex flex-col gap-4" onSubmit={(e) => void start(e)}>
            <PasswordField
              ref={passwordRef}
              label="Tu contraseña actual"
              aria-invalid={error ? true : undefined}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
            <Button type="submit" disabled={busy || !password}>
              {busy ? 'Preparando…' : 'Continuar'}
            </Button>
          </form>
        ) : null}

        {step.kind === 'scan' ? (
          <form className="flex flex-col gap-4" onSubmit={(e) => void confirm(e)}>
            <p>
              Escanea este código con Google Authenticator, Microsoft Authenticator u otra aplicación de
              autenticación.
            </p>
            {qr ? (
              <img src={qr} alt="Código QR para vincular la aplicación" className="mx-auto size-52" />
            ) : null}
            <div className="text-sm text-ink-muted">
              <p>¿No puedes escanear? Escribe esta clave en la aplicación:</p>
              <p
                data-testid="clave-manual"
                data-key={manualKey ?? ''}
                className="mt-1 rounded-lg bg-surface px-3 py-2 font-mono text-base font-semibold tracking-wide text-ink"
              >
                {manualKey?.match(/.{1,4}/g)?.join(' ')}
              </p>
            </div>
            <TextField
              ref={codeRef}
              aria-invalid={error ? true : undefined}
              label="Código de 6 dígitos que muestra la aplicación"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="tabular tracking-widest"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
              }}
            />
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Verificando…' : 'Activar'}
            </Button>
          </form>
        ) : null}

        {step.kind === 'codes' ? (
          <div className="flex flex-col gap-4">
            <Alert tone="info">Verificación en dos pasos activada.</Alert>
            <p>
              Guarda estos códigos de respaldo en un lugar seguro. Cada uno sirve una sola vez si pierdes el
              celular.
            </p>
            <BackupCodes codes={step.backupCodes} />
            <Button
              onClick={() => {
                void queryClient
                  .invalidateQueries({ queryKey: ME_KEY })
                  .then(() => navigate('/', { replace: true }));
              }}
            >
              Ya los guardé, continuar
            </Button>
          </div>
        ) : null}
      </div>

      <Button variant="secondary" className="mt-4" onClick={() => void signOut()}>
        Cerrar sesión
      </Button>
    </main>
  );
}
