import { useQueryClient } from '@tanstack/react-query';
import { Boxes, Factory, ShieldCheck, Truck } from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../shared/auth/client';
import { FullPageMessage, ME_KEY, useSession } from '../../shared/auth/session';
import { Brand, BrandMark } from '../../shared/ui/Brand';
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
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-panel p-10 lg:flex xl:p-14">
        <div
          aria-hidden
          className="absolute -top-40 -right-32 size-[30rem] rounded-full bg-brand/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-48 -left-32 size-[26rem] rounded-full bg-terracotta/10 blur-3xl"
        />
        <div className="relative">
          <Brand to="/ingresar" inverse area="Plataforma" markSize="lg" />
        </div>

        <div className="relative max-w-md">
          <p className="text-caption font-semibold tracking-[0.16em] text-white/50 uppercase">Los 4 Treros</p>
          <h2 className="mt-3 font-display text-[2.25rem] leading-[1.15] font-bold tracking-tight text-white">
            La operación de la empresa, en una sola plataforma.
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-white/65">
            Producción, inventario, distribución y caja con la misma información y los mismos permisos en cada
            punto.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              {
                icon: <Factory className="size-4" />,
                title: 'Producción trazable',
                detail: 'Recetas, lotes y rendimiento por orden.',
              },
              {
                icon: <Boxes className="size-4" />,
                title: 'Inventario con FEFO',
                detail: 'Existencias por ubicación y vencimiento.',
              },
              {
                icon: <Truck className="size-4" />,
                title: 'Reparto y cartera',
                detail: 'Entregas, cobros y cupos en la misma línea.',
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-on-dark"
                >
                  {item.icon}
                </span>
                <span>
                  <span className="block text-body font-semibold text-white">{item.title}</span>
                  <span className="block text-caption text-white/60">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 border-t border-white/10 pt-5 text-caption text-white/50">
          <ShieldCheck aria-hidden className="size-4" />
          Acceso restringido al personal autorizado.
        </div>
      </aside>

      <section className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" />
            <div>
              <p className="font-display text-title font-extrabold tracking-tight text-ink">Quatreros</p>
              <p className="text-caption text-ink-2">Los 4 Treros · Plataforma</p>
            </div>
          </div>

          <p className="text-caption font-semibold tracking-[0.14em] text-ink-3 uppercase">
            {step === 'credentials' ? 'Bienvenido' : 'Segundo factor'}
          </p>
          <h1 className="mt-2 font-display text-display font-bold text-ink">
            {step === 'credentials' ? 'Ingresa a tu operación' : 'Verifica tu identidad'}
          </h1>
          <p className="mt-2 text-body text-ink-2">
            {step === 'credentials'
              ? 'Usa tu correo de trabajo y tu contraseña.'
              : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
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
                <Button type="submit" disabled={busy} className="w-full">
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
                <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
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

          <p className="mt-6 text-center text-caption text-ink-3">Quatreros · Plataforma de operación</p>
        </div>
      </section>
    </main>
  );
}
