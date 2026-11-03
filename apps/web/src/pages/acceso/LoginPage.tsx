import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  Factory,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../services/auth-client';
import { ME_KEY, useSession } from '../../hooks/useSession';
import { Alert, Button, PasswordField, TextField } from '../../components/ui/form';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const REASONS: Record<string, string> = {
  disabled: 'Tu cuenta está desactivada. Habla con el administrador.',
  not_provisioned: 'Tu cuenta no tiene un rol asignado. Habla con el administrador.',
};

const FEATURES = [
  { label: 'Producción', icon: Factory },
  { label: 'Inventarios', icon: Boxes },
  { label: 'Distribución', icon: Truck },
  { label: 'POS & Ventas', icon: BarChart3 },
] as const;

function FeaturePill({
  label,
  icon: Icon,
  className = '',
}: {
  label: string;
  icon: typeof Factory;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border border-white/60 bg-white/75 px-3.5 py-2.5 shadow-[0_14px_30px_-18px_rgba(17,24,39,0.45)] backdrop-blur-xl ${className}`}
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FF7A2F] to-[#FF4500] text-white shadow-[0_8px_16px_-8px_rgba(255,69,0,0.7)]"
      >
        <Icon className="size-4" />
      </span>
      <span className="text-[13px] leading-4 font-semibold whitespace-nowrap text-ink">{label}</span>
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
    <main className="login-theme min-h-dvh bg-[#FBFAF9] lg:grid lg:h-dvh lg:grid-cols-[55%_45%] lg:overflow-hidden">
      <aside className="login-brand-panel relative hidden flex-col overflow-hidden p-10 lg:flex lg:h-dvh xl:p-14">
        <div aria-hidden className="login-brand-grid pointer-events-none absolute inset-0 opacity-20" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-[26rem] rounded-[3.5rem] bg-white/45 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-10%] bottom-[-14%] size-[32rem] rounded-full bg-[#FF5500]/10 blur-3xl"
        />

        <header className="relative z-10 flex items-center gap-3">
          <img
            src="/logo-mark.webp"
            alt=""
            width={48}
            height={48}
            decoding="async"
            className="size-12 shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(120,60,20,0.16)]"
          />
          <span className="font-display text-[1.2rem] leading-none font-extrabold tracking-[-0.03em] text-ink">
            Quatreros
          </span>
          <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-brand-ink uppercase shadow-[0_6px_16px_-10px_rgba(17,24,39,0.4)] backdrop-blur-xl">
            Plataforma ERP
          </span>
        </header>

        <div className="relative z-10 mt-10 max-w-[34rem] xl:mt-14 2xl:mt-16 2xl:max-w-[40rem]">
          <h1 className="font-display text-[clamp(2.5rem,4.2vw,4.1rem)] leading-[1.02] font-bold tracking-[-0.045em] text-ink [text-wrap:balance]">
            Toda tu operación.{' '}
            <span className="block bg-gradient-to-r from-[#FF5A0A] to-[#E23E00] bg-clip-text text-transparent">
              Un solo lugar.
            </span>
          </h1>
          <p className="mt-6 max-w-[27rem] text-[15px] leading-7 text-ink-2 xl:text-base">
            Controla producción, inventarios, ventas y distribución desde una sola plataforma pensada para tu
            negocio.
          </p>
        </div>

        <div className="relative z-10 mt-8 flex min-h-0 flex-1 items-end">
          <ul
            aria-hidden
            className="absolute top-1/2 left-0 z-20 flex w-[10.75rem] -translate-y-1/2 flex-col gap-3 xl:w-[11.5rem] 2xl:gap-4"
          >
            {FEATURES.map((feature) => (
              <li key={feature.label}>
                <FeaturePill label={feature.label} icon={feature.icon} className="login-float" />
              </li>
            ))}
          </ul>

          <div className="relative ml-auto flex h-full w-full max-w-[27rem] items-end justify-end">
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 h-[clamp(5rem,10vh,8rem)] w-[clamp(17rem,30vw,25rem)] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,85,0,0.2),rgba(255,85,0,0)_70%)] blur-2xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-2 bottom-16 size-[clamp(14rem,24vw,22rem)] rounded-full bg-[radial-gradient(circle,rgba(255,133,51,0.18),rgba(255,133,51,0)_66%)] blur-3xl"
            />
            <span
              aria-hidden
              className="absolute right-[9%] bottom-2 h-9 w-[64%] rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,228,210,0.55))] shadow-[0_22px_38px_-20px_rgba(120,60,20,0.5)]"
            />
            <span
              aria-hidden
              className="absolute right-[13%] bottom-0 h-5 w-[56%] rounded-[50%] bg-[#7A3B12]/10 blur-lg"
            />
            <img
              src="/cuatreros-bot-full.webp"
              alt=""
              width={360}
              height={360}
              className="animate-float-soft relative bottom-2 h-[clamp(12.5rem,33vh,26rem)] 2xl:h-[min(25rem,42vh)] w-auto object-contain object-bottom drop-shadow-[0_28px_34px_rgba(120,60,20,0.18)]"
            />
          </div>
        </div>
      </aside>

      <section className="relative flex min-h-dvh flex-col items-center bg-[#FBFAF9] px-4 pt-5 lg:bg-[linear-gradient(180deg,#FFF7F2_0%,#FCFBFA_45%,#FFFFFF_100%)] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 md:justify-center lg:h-dvh lg:min-h-0 lg:justify-center lg:overflow-y-auto lg:px-10 lg:py-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="login-brand-panel absolute inset-0" />
          <div className="login-brand-grid absolute inset-0 opacity-20" />
          <div className="absolute -top-24 -right-20 size-72 rounded-full bg-white/40 blur-3xl" />
        </div>

        <div className="animate-rise relative z-10 w-full max-w-[440px]">
          <div className="mb-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-mark.webp"
                alt=""
                width={40}
                height={40}
                decoding="async"
                className="size-10 shrink-0 object-contain"
              />
              <span className="font-display text-[1.05rem] leading-none font-extrabold tracking-[-0.03em] text-ink">
                Quatreros
              </span>
              <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] text-brand-ink uppercase backdrop-blur-xl">
                Plataforma ERP
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3 overflow-hidden rounded-3xl border border-white/70 bg-white/65 px-3 py-2 backdrop-blur-xl">
              <img
                src="/cuatreros-bot-full.webp"
                alt=""
                width={360}
                height={360}
                className="h-20 w-auto shrink-0 object-contain drop-shadow-[0_10px_16px_rgba(120,60,20,0.16)]"
              />
              <p className="text-[12px] leading-5 text-ink-2">
                La operación completa de tu negocio, en una sola plataforma.
              </p>
            </div>

            <div
              role="group"
              aria-label="Módulos de la plataforma"
              tabIndex={0}
              className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {FEATURES.map((feature) => (
                <FeaturePill
                  key={feature.label}
                  label={feature.label}
                  icon={feature.icon}
                  className="shrink-0 scale-[0.92]"
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:p-8 lg:bg-white">
            {step === 'code' ? (
              <button
                type="button"
                onClick={backToCredentials}
                className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-caption font-semibold text-ink-2 transition-colors hover:text-ink"
              >
                <ArrowLeft aria-hidden className="size-4" />
                Volver al ingreso
              </button>
            ) : null}

            <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-ink uppercase">
              {step === 'credentials' ? 'Bienvenido de nuevo' : 'Segundo factor'}
            </p>
            <h1 className="mt-2 font-display text-[1.85rem] leading-9 font-bold tracking-[-0.03em] text-ink">
              {step === 'credentials' ? 'Ingresa a tu operación' : 'Verifica tu identidad'}
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-ink-2">
              {step === 'credentials'
                ? 'Accede con tus credenciales para continuar.'
                : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
            </p>

            <div className="mt-6 space-y-4">
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
                <form className="space-y-4" onSubmit={(e) => void submitCredentials(e)} aria-busy={busy}>
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
                  <div className="space-y-1.5">
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
                    <p className="text-right text-[11px] leading-4 text-ink-2">
                      ¿Olvidaste tu contraseña? Habla con el administrador.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={busy}
                    aria-busy={busy}
                    className="mt-1 h-[56px] w-full rounded-xl bg-gradient-to-r from-[#FF5A0A] to-[#FF4500] shadow-[0_10px_24px_-14px_rgba(255,69,0,0.9)] transition-[transform,box-shadow,background-color] duration-300 hover:shadow-[0_18px_34px_-14px_rgba(255,69,0,0.55)] motion-safe:hover:-translate-y-0.5"
                  >
                    {busy ? (
                      <>
                        <Loader2 aria-hidden className="size-5 animate-spin" />
                        Ingresando…
                      </>
                    ) : (
                      <>
                        Ingresar a Quatreros
                        <ArrowRight aria-hidden className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={(e) => void submitCode(e)} aria-busy={busy}>
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
                    className="mt-1 h-[56px] w-full rounded-xl bg-gradient-to-r from-[#FF5A0A] to-[#FF4500] shadow-[0_10px_24px_-14px_rgba(255,69,0,0.9)] transition-[transform,box-shadow,background-color] duration-300 hover:shadow-[0_18px_34px_-14px_rgba(255,69,0,0.55)] motion-safe:hover:-translate-y-0.5"
                  >
                    {busy ? (
                      <>
                        <Loader2 aria-hidden className="size-5 animate-spin" />
                        Verificando…
                      </>
                    ) : (
                      <>
                        Verificar
                        <ArrowRight aria-hidden className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-3">
              <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
              Acceso restringido al personal autorizado.
            </p>
            <p className="mt-4 border-t border-line/70 pt-4 text-center text-[11px] text-ink-2">
              Los 4 Treros · Plataforma de operación
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
