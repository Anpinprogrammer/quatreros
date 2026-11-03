import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  ChevronRight,
  Factory,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../services/auth-client';
import { ME_KEY, useSession } from '../../hooks/useSession';
import { Alert, Button, PasswordField, TextField } from '../../components/ui/form';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const REASONS: Record<string, string> = {
  disabled: 'Tu cuenta está desactivada. Habla con el administrador.',
  not_provisioned: 'Tu cuenta no tiene un rol asignado. Habla con el administrador.',
  expired: 'Tu sesión expiró por inactividad. Vuelve a ingresar.',
};

const PROFILES = [
  {
    id: 'administrador',
    label: 'Administrador',
    badge: 'Plataforma ERP',
    description: 'Control completo de la operación',
    icon: ShieldCheck,
  },
  {
    id: 'cajero',
    label: 'Cajero',
    badge: 'Sistema POS',
    description: 'Caja y punto de venta',
    icon: ShoppingCart,
  },
  {
    id: 'distribuidor',
    label: 'Distribuidor',
    badge: 'Distribución',
    description: 'Ruta, entregas y recaudo',
    icon: Truck,
  },
] as const;

type ProfileId = (typeof PROFILES)[number]['id'];

const FEATURES = [
  { label: 'Producción', icon: Factory },
  { label: 'Inventarios', icon: Boxes },
  { label: 'Distribución', icon: Truck },
  { label: 'POS & Ventas', icon: BarChart3 },
] as const;

/** Duración de la cortina (styles.css, `.login-curtain`): el foco se mueve cuando termina de cerrarse. */
const CURTAIN_MS = 650;

/**
 * Ingreso con correo y contraseña, y código de 6 dígitos si el usuario tiene segundo factor (RF-001).
 * El perfil elegido solo adapta la presentación: el servidor decide a qué pantalla entra cada rol.
 */
export function LoginPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  // El perfil se conserva al cerrar para que el contenido no desaparezca mientras la cortina se abre.
  const [profile, setProfile] = useState<ProfileId>('administrador');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useDocumentTitle(step === 'credentials' ? 'Ingresar' : 'Código de verificación');

  const activeProfile = PROFILES.find((item) => item.id === profile) ?? PROFILES[0];
  const ActiveIcon = activeProfile.icon;

  const closeCurtain = () => {
    setOpen(false);
    setStep('credentials');
    setCode('');
    setError(null);
  };

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      return;
    }
    // En escritorio el foco va al correo; en móvil a "Cambiar de rol" para no abrir el teclado.
    const timer = window.setTimeout(() => {
      if (window.matchMedia('(min-width: 64rem)').matches) emailRef.current?.focus();
      else backRef.current?.focus();
    }, CURTAIN_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCurtain();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
    <main className="login-theme relative min-h-dvh overflow-hidden bg-[#FFF6EF]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="login-brand-panel absolute inset-0" />
        <div className="login-tech-grid absolute inset-0" />
      </div>

      {/* Paso 1: presentación y selección de perfil. */}
      <div
        inert={open}
        className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12"
      >
        <header className="flex items-center justify-between gap-4">
          <img
            src="/logo-mark.webp"
            alt="Quatreros"
            width={112}
            height={112}
            decoding="async"
            className="size-20 object-contain drop-shadow-[0_14px_24px_rgba(120,60,20,0.22)] sm:size-24 lg:size-28"
          />
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-caption font-semibold text-ink-2 shadow-[0_6px_16px_-12px_rgba(17,24,39,0.5)] backdrop-blur-xl">
            <LockKeyhole aria-hidden className="size-3.5 text-brand-ink" />
            Acceso restringido
          </p>
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:py-10">
          <section aria-labelledby="ingreso-titulo">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-ink uppercase">
              Plataforma de operación
            </p>
            <h1
              id="ingreso-titulo"
              className="mt-3 max-w-[36rem] font-display text-[clamp(2rem,4.4vw,3.6rem)] leading-[1.04] font-bold tracking-[-0.045em] text-ink [text-wrap:balance]"
            >
              Toda tu operación.{' '}
              <span className="block bg-gradient-to-r from-[#FF5A0A] to-[#E23E00] bg-clip-text pb-1.5 text-transparent">
                Un solo lugar.
              </span>
            </h1>
            <p className="mt-4 max-w-[30rem] text-[15px] leading-7 text-ink-2">
              Controla producción, inventarios, ventas y distribución desde una sola plataforma pensada para
              tu negocio.
            </p>

            <ul
              aria-label="Áreas de la plataforma"
              className="mt-8 hidden max-w-[30rem] grid-cols-2 gap-3 sm:grid"
            >
              {FEATURES.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/65 px-3.5 py-3 shadow-[0_14px_30px_-24px_rgba(17,24,39,0.5)] backdrop-blur-xl"
                >
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink"
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="text-[14px] font-semibold text-ink">{label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="perfil-titulo" className="relative mt-14 lg:mt-0">
            <img
              src="/cuatreros-bot-full.webp"
              alt=""
              width={360}
              height={360}
              decoding="async"
              className="pointer-events-none absolute right-4 bottom-[calc(100%-1.25rem)] h-28 w-auto object-contain drop-shadow-[0_16px_22px_rgba(120,60,20,0.2)] sm:right-8 lg:h-36"
            />
            <div className="relative rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_30px_60px_-30px_rgba(120,60,20,0.35)] backdrop-blur-xl sm:p-7">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-ink uppercase">
                Paso 1 de 2
              </p>
              <h2
                id="perfil-titulo"
                className="mt-2 font-display text-[1.6rem] leading-8 font-bold tracking-[-0.03em] text-ink"
              >
                Selecciona tu perfil
              </h2>
              <p className="mt-1.5 text-[14px] leading-6 text-ink-2">
                Elige cómo vas a entrar. Podrás cambiarlo cuando quieras.
              </p>

              <ul className="mt-6 space-y-2.5">
                {PROFILES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={(event) => {
                          triggerRef.current = event.currentTarget;
                          setProfile(item.id);
                          setOpen(true);
                        }}
                        className="group flex w-full items-center gap-3.5 rounded-2xl border border-line/80 bg-white p-3.5 text-left transition-[transform,border-color,box-shadow] duration-200 hover:border-brand/40 hover:shadow-[0_18px_30px_-20px_rgba(255,69,0,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.99] motion-safe:hover:-translate-y-0.5"
                      >
                        <span
                          aria-hidden
                          className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FF7A2F] to-[#FF4500] text-white shadow-[0_8px_16px_-8px_rgba(255,69,0,0.7)]"
                        >
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[15px] font-bold text-ink">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block truncate text-caption text-ink-2">
                            {item.description}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition-colors duration-200 group-hover:bg-brand group-hover:text-white"
                        >
                          <ChevronRight className="size-4" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-caption text-ink-2">
                <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                Acceso restringido al personal autorizado.
              </p>
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-4 text-caption text-ink-2">
          <span>Los 4 Treros · Plataforma de operación</span>
          <span>¿Problemas para entrar? Habla con el administrador.</span>
        </footer>
      </div>

      {/* Paso 2: la cortina se cierra sobre la selección y presenta el acceso del perfil. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="acceso-titulo"
        aria-hidden={!open}
        inert={!open}
        data-open={open}
        className="login-curtain fixed inset-0 z-40 overflow-hidden"
      >
        <aside className="login-curtain-left login-curtain-fabric absolute inset-y-0 left-0 hidden w-1/2 flex-col overflow-hidden bg-panel p-10 text-white lg:flex xl:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -bottom-24 size-[30rem] rounded-full bg-[radial-gradient(circle,rgba(253,83,0,0.35),rgba(253,83,0,0)_65%)] blur-2xl"
          />
          {/* Diagonal: rol arriba a la izquierda, logo al centro exacto del paño y mascota abajo a la derecha. */}
          <div className="login-curtain-content relative max-w-[26rem]">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FF7A2F] to-[#FF4500] text-white shadow-[0_14px_28px_-12px_rgba(255,69,0,0.8)]"
              >
                <ActiveIcon className="size-6" />
              </span>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-on-dark uppercase">
                {activeProfile.badge}
              </p>
            </div>
            <p className="mt-4 font-display text-[clamp(2.25rem,3.6vw,3.25rem)] leading-[1.05] font-bold tracking-[-0.04em]">
              {activeProfile.label}
            </p>
            <p className="mt-2 text-[15px] leading-7 text-white/75">{activeProfile.description}.</p>
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* Versión de 512 px: a este tamaño la de 256 px se vería borrosa en pantallas de alta densidad. */}
            <img
              src="/logo-mark-512.webp"
              alt="Quatreros"
              width={256}
              height={256}
              className="login-curtain-content aspect-square h-[clamp(11rem,30vh,16rem)] w-auto object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.55)]"
            />
          </div>

          <img
            src="/cuatreros-bot-full.webp"
            alt=""
            width={360}
            height={360}
            className="login-curtain-content pointer-events-none absolute right-10 bottom-0 h-[clamp(10rem,30vh,16rem)] w-auto object-contain object-bottom drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)]"
          />
          <p className="login-curtain-content relative mt-auto text-caption text-white/70">Paso 2 de 2</p>
        </aside>

        <div className="login-curtain-right absolute inset-0 flex flex-col overflow-y-auto bg-white lg:left-1/2 lg:shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.45)]">
          <div className="flex min-h-full flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-14 lg:py-10">
            <div className="flex items-center justify-between gap-4">
              <button
                ref={backRef}
                type="button"
                onClick={closeCurtain}
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-caption font-semibold text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <ArrowLeft aria-hidden className="size-4" />
                Cambiar de rol
              </button>
              {/* En escritorio el logo vive en el paño oscuro; en móvil acompaña al formulario. */}
              <img
                src="/logo-mark.webp"
                alt="Quatreros"
                width={80}
                height={80}
                className="size-20 object-contain drop-shadow-[0_14px_24px_rgba(120,60,20,0.22)] lg:hidden"
              />
            </div>

            <div className="login-curtain-content my-auto w-full max-w-[400px] self-center py-8">
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line/80 bg-surface-2/60 p-3 lg:hidden">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FF7A2F] to-[#FF4500] text-white"
                >
                  <ActiveIcon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-bold text-ink">
                    {activeProfile.label}
                  </span>
                  <span className="block text-caption text-ink-2">{activeProfile.badge}</span>
                </span>
              </div>

              {step === 'code' ? (
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-caption font-semibold text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <ArrowLeft aria-hidden className="size-4" />
                  Volver al ingreso
                </button>
              ) : null}

              <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-ink uppercase">
                {step === 'credentials' ? 'Bienvenido de nuevo' : 'Segundo factor'}
              </p>
              <h2
                id="acceso-titulo"
                className="mt-2 font-display text-[1.85rem] leading-9 font-bold tracking-[-0.03em] text-ink"
              >
                {step === 'credentials' ? 'Ingresa a tu operación' : 'Verifica tu identidad'}
              </h2>
              <p className="mt-2 text-[14px] leading-6 text-ink-2">
                {step === 'credentials'
                  ? 'Accede con tus credenciales para continuar.'
                  : 'Escribe el código de 6 dígitos de tu aplicación de autenticación.'}
              </p>

              <div className="mt-7 space-y-4">
                {reason && REASONS[reason] && step === 'credentials' ? (
                  <Alert>{REASONS[reason]}</Alert>
                ) : null}
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
                      ref={emailRef}
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
                      <p className="text-right text-caption text-ink-2">
                        ¿Olvidaste tu contraseña? Habla con el administrador.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={busy}
                      aria-busy={busy}
                      className="mt-2 h-14 w-full bg-[linear-gradient(180deg,#FF6A1F_0%,#FF4A00_55%,#F03E00_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_16px_32px_-12px_rgba(255,69,0,0.75)] motion-safe:hover:-translate-y-0.5"
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
                      className="mt-2 h-14 w-full bg-[linear-gradient(180deg,#FF6A1F_0%,#FF4A00_55%,#F03E00_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_16px_32px_-12px_rgba(255,69,0,0.75)] disabled:bg-none motion-safe:hover:-translate-y-0.5"
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

              <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-caption text-ink-2">
                <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                Acceso restringido al personal autorizado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
