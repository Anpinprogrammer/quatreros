import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  Factory,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../services/auth-client';
import { ME_KEY, useSession } from '../../hooks/useSession';
import { Brand } from '../../components/ui/Brand';
import { Alert, Button, PasswordField, TextField } from '../../components/ui/form';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const REASONS: Record<string, string> = {
  disabled: 'Tu cuenta está desactivada. Habla con el administrador.',
  not_provisioned: 'Tu cuenta no tiene un rol asignado. Habla con el administrador.',
};

function FloatingChip({
  icon,
  label,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-[#171717]/8 bg-surface px-3 py-2 shadow-card ${className}`}
    >
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"
      >
        {icon}
      </span>
      <span className="text-caption font-semibold whitespace-nowrap text-ink">{label}</span>
    </div>
  );
}

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

  if (session.status === 'loading') {
    return (
      <main className="login-theme grid min-h-dvh place-items-center bg-surface">
        <p role="status" className="text-body text-ink-2">
          Cargando…
        </p>
      </main>
    );
  }
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

  const backToCredentials = () => {
    setStep('credentials');
    setCode('');
    setError(null);
  };

  return (
    <main className="login-theme min-h-dvh bg-surface lg:grid lg:h-dvh lg:grid-cols-[52%_48%] lg:overflow-hidden">
      <aside className="login-brand-panel relative hidden flex-col overflow-hidden p-8 lg:flex lg:h-dvh xl:p-12">
        <div aria-hidden className="login-brand-grid pointer-events-none absolute inset-0 opacity-40" />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -left-40 size-[34rem] rounded-full bg-white/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-24 size-[26rem] rounded-full bg-brand/10 blur-3xl"
        />

        <div className="relative z-10">
          <Brand to="/ingresar" area="Plataforma" markSize="lg" />
        </div>

        <div className="relative z-10 mt-8 max-w-[34rem] xl:mt-12">
          <div className="flex items-center gap-2 text-caption font-semibold tracking-[0.14em] text-brand-ink uppercase">
            <span aria-hidden className="h-px w-6 bg-brand" />
            Los 4 Treros · Plataforma
          </div>
          <h2 className="mt-4 font-display text-[clamp(2.5rem,4.4vw,4rem)] leading-[1.05] font-bold tracking-[-0.04em] text-ink [text-wrap:balance]">
            Toda tu operación.
            <span className="relative mt-1 block w-fit text-brand-ink">
              Un solo lugar.
              <span
                aria-hidden
                className="absolute right-0 -bottom-1 left-0 h-1.5 rounded-full bg-brand/80"
              />
            </span>
          </h2>
          <p className="mt-5 max-w-[32rem] text-[15px] leading-7 text-ink-2 xl:text-base">
            Controla producción, inventarios, ventas y distribución desde una plataforma diseñada para tu
            negocio.
          </p>
        </div>

        <div className="relative z-10 mt-auto flex min-h-[16rem] flex-1 items-end justify-end pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-24 left-0 hidden w-44 flex-col gap-3 xl:flex"
          >
            <FloatingChip
              icon={<Factory className="size-3.5" />}
              label="Producción"
              className="translate-x-2"
            />
            <FloatingChip
              icon={<Boxes className="size-3.5" />}
              label="Inventarios"
              className="translate-x-10"
            />
            <FloatingChip
              icon={<Truck className="size-3.5" />}
              label="Distribución"
              className="translate-x-1"
            />
          </div>

          <div className="relative mr-0 flex items-end justify-end xl:mr-2">
            <div
              aria-hidden
              className="pointer-events-none absolute right-2 bottom-16 size-[clamp(16rem,27vw,26rem)] rounded-full bg-[radial-gradient(circle,rgba(253,83,0,0.22),rgba(253,83,0,0)_66%)] blur-2xl"
            />
            <span
              aria-hidden
              className="absolute bottom-3 left-1/2 h-5 w-44 -translate-x-1/2 rounded-full bg-[#B84300]/15 blur-xl"
            />
            <img
              src="/cuatreros-bot-full.webp"
              alt=""
              width={360}
              height={360}
              className="animate-float-soft relative h-[clamp(14rem,36vh,23.75rem)] w-auto object-contain drop-shadow-[0_24px_28px_rgba(120,60,20,0.16)]"
            />
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 border-t border-[#171717]/10 pt-4 text-caption text-ink-2">
          <ShieldCheck aria-hidden className="size-4 shrink-0 text-ink-3" />
          Acceso restringido al personal autorizado.
        </div>
      </aside>

      <section className="relative flex min-h-dvh items-start justify-center bg-surface px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 md:items-center lg:h-dvh lg:min-h-0 lg:items-center lg:overflow-y-auto lg:border-l lg:border-line lg:px-10 lg:py-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="login-brand-panel absolute inset-0" />
          <div className="login-brand-grid absolute inset-0 opacity-30" />
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="absolute bottom-24 -left-20 size-64 rounded-full bg-white/35 blur-3xl" />
        </div>

        <div className="animate-rise relative z-10 w-full max-w-[420px]">
          <div className="mb-6 flex items-center lg:hidden">
            <Brand to="/ingresar" area="Plataforma" markSize="md" />
          </div>

          {step === 'code' ? (
            <button
              type="button"
              onClick={backToCredentials}
              className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-caption font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Volver al ingreso
            </button>
          ) : null}

          <div className="flex items-center gap-2">
            <span aria-hidden className="h-px w-6 bg-brand" />
            <p className="text-caption font-semibold tracking-[0.14em] text-brand-ink uppercase">
              {step === 'credentials' ? 'Bienvenido de nuevo' : 'Segundo factor'}
            </p>
          </div>
          <h1 className="mt-3 font-display text-[2rem] leading-10 font-bold tracking-[-0.03em] text-ink">
            {step === 'credentials' ? 'Ingresa a tu operación' : 'Verifica tu identidad'}
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-2">
            {step === 'credentials'
              ? 'Accede con tus credenciales para continuar.'
              : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
          </p>

          <div className="mt-6 space-y-5 rounded-[20px] border border-[#171717]/10 bg-[#FFFDFC] p-5 shadow-[0_24px_60px_-38px_rgba(120,50,10,0.45)] sm:p-6 lg:mt-7 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            {reason && REASONS[reason] && step === 'credentials' ? <Alert>{REASONS[reason]}</Alert> : null}
            {error ? (
              <Alert id="error-ingreso">
                <span className="flex items-start gap-2">
                  <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </span>
              </Alert>
            ) : null}

            {step === 'credentials' ? (
              <form className="space-y-5" onSubmit={(e) => void submitCredentials(e)} aria-busy={busy}>
                <TextField
                  label="Correo electrónico"
                  type="email"
                  inputSize="lg"
                  leadingIcon={<Mail className="size-4" />}
                  placeholder="nombre@empresa.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  invalid={Boolean(error)}
                  value={email}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'error-ingreso' : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                />
                <PasswordField
                  ref={passwordRef}
                  label="Contraseña"
                  inputSize="lg"
                  leadingIcon={<LockKeyhole className="size-4" />}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                  invalid={Boolean(error)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'error-ingreso' : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                />
                <Button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="mt-1 h-[56px] w-full rounded-[14px] lg:h-[52px]"
                >
                  {busy ? (
                    <>
                      <Loader2 aria-hidden className="size-5 animate-spin" />
                      Ingresando…
                    </>
                  ) : (
                    'Ingresar a Quatreros'
                  )}
                </Button>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={(e) => void submitCode(e)} aria-busy={busy}>
                <TextField
                  ref={codeRef}
                  label="Código de 6 dígitos"
                  inputSize="lg"
                  leadingIcon={<KeyRound className="size-4" />}
                  hint="Abre tu aplicación de autenticación y escribe el código actual."
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  invalid={Boolean(error)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'error-ingreso' : undefined}
                  className="font-mono text-title tracking-[0.35em]"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    if (error) setError(null);
                  }}
                />
                <Button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  aria-busy={busy}
                  className="mt-1 h-[56px] w-full rounded-[14px] lg:h-[52px]"
                >
                  {busy ? (
                    <>
                      <Loader2 aria-hidden className="size-5 animate-spin" />
                      Verificando…
                    </>
                  ) : (
                    'Verificar'
                  )}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-ink-2 lg:hidden">
            <ShieldCheck aria-hidden className="size-3.5" />
            Acceso restringido al personal autorizado.
          </p>

          <div aria-hidden className="relative mx-auto mt-5 h-[212px] w-full max-w-xs lg:hidden">
            <div className="absolute bottom-7 left-1/2 size-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,83,0,0.22),rgba(253,83,0,0)_66%)] blur-2xl" />
            <div className="hidden min-[360px]:block">
              <FloatingChip
                icon={<Factory className="size-3.5" />}
                label="Producción"
                className="absolute top-4 left-0 z-20 scale-90"
              />
            </div>
            <div className="hidden min-[360px]:block">
              <FloatingChip
                icon={<Boxes className="size-3.5" />}
                label="Inventarios"
                className="absolute top-24 right-0 z-20 scale-90"
              />
            </div>
            <span className="absolute bottom-1 left-1/2 h-4 w-40 -translate-x-1/2 rounded-full bg-[#B84300]/20 blur-lg" />
            <img
              src="/cuatreros-bot-full.webp"
              alt=""
              width={360}
              height={360}
              className="animate-float-soft absolute bottom-0 left-1/2 z-10 h-[205px] w-auto -translate-x-1/2 object-contain drop-shadow-[0_18px_24px_rgba(120,60,20,0.14)]"
            />
          </div>

          <p className="mt-4 text-center text-[11px] text-ink-2 lg:mt-7">
            Los 4 Treros · Plataforma de operación
          </p>
        </div>
      </section>
    </main>
  );
}
