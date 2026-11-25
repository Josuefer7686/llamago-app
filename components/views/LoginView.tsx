'use client';

import { useEffect, useState } from 'react';
import { useAppStore, UserProfile } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { Smartphone, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { haptics } from '@/utils/haptics';
import { IosToastOverlay } from '@/components/shared/IosToastOverlay';
import { IosSpinner } from '@/components/shared/IosSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { APP_VERSION } from '@/lib/appVersion';


const LINES = ['Tu mototaxi, en minutos', 'Comida y compras a tu puerta', 'Viaja seguro por Bolivia'];

/** Frase que cambia sola cada pocos segundos. */
function RotatingLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % LINES.length), 2600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="mt-5 h-7 text-center" aria-live="off">
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="font-display text-lg font-bold tracking-tight text-white/90"
        >
          {LINES[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Fondo vivo: luces amarillas que se mueven despacio y puntos sutiles. */
function LobbyBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="lobby-drift-a absolute -left-24 top-[8%] h-80 w-80 rounded-full bg-gold-primary/[0.14] blur-[90px]" />
      <div className="lobby-drift-b absolute -right-28 top-[45%] h-96 w-96 rounded-full bg-gold-primary/[0.09] blur-[110px]" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_70%)]" />
    </div>
  );
}

/** Moto de delivery con repartidor y casco, rodando sobre la calle. */
function DeliveryBike() {
  return (
    <svg viewBox="0 0 140 76" className="lobby-bike h-24 w-auto" role="img" aria-label="Repartidor en moto con casco, viajando seguro">
      {/* líneas de velocidad */}
      <g className="lobby-speed" stroke="#FCEA0D" strokeLinecap="round" strokeWidth="3" opacity="0.7">
        <line x1="2" y1="30" x2="16" y2="30" />
        <line x1="0" y1="40" x2="12" y2="40" />
        <line x1="6" y1="50" x2="18" y2="50" />
      </g>
      <g className="lobby-bike-body">
        {/* caja de delivery */}
        <rect x="22" y="12" width="32" height="26" rx="4" fill="#FCEA0D" />
        <rect x="26" y="16" width="24" height="3" rx="1.5" fill="#0C0C0C" />
        <path d="M33 28l5 5 9-10" fill="none" stroke="#0C0C0C" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* chasis, horquilla, manubrio y asiento */}
        <path d="M36 56l22-18h24l12 18M82 38l8-16h10" fill="none" stroke="#FCEA0D" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="56" y="31" width="26" height="7" rx="3.5" fill="#FCEA0D" />
        {/* repartidor */}
        <path d="M64 33l8-18" fill="none" stroke="#FCEA0D" strokeWidth="9" strokeLinecap="round" />
        <path d="M66 34l16 6-2 14" fill="none" stroke="#FCEA0D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M76 17l16 7" fill="none" stroke="#FCEA0D" strokeWidth="5" strokeLinecap="round" />
        <circle cx="76" cy="5" r="8.5" fill="#FCEA0D" />
        <path d="M77 3.5h8.5a1 1 0 0 1 0 5H77z" fill="#0C0C0C" />
        {/* ruedas */}
        {[36, 100].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="58" r="13" fill="#0C0C0C" stroke="#FCEA0D" strokeWidth="4.5" />
            <g className="lobby-wheel" style={{ transformOrigin: `${cx}px 58px` }} stroke="#FCEA0D" strokeWidth="2.6" strokeLinecap="round">
              <line x1={cx - 8} y1="58" x2={cx + 8} y2="58" />
              <line x1={cx} y1="50" x2={cx} y2="66" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Calle con rayas que avanzan y la moto de delivery: la app "en movimiento". */
function RoadStrip() {
  return (
    <div className="pb-safe relative z-10 pt-4" aria-hidden>
      <div className="relative mx-auto h-[112px] w-full max-w-sm overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_20%,black_80%,transparent)]">
        <div className="absolute inset-x-0 top-0 flex justify-center"><DeliveryBike /></div>
        <div className="lobby-road absolute left-0 top-[104px] h-[3px] w-[200%] [background-image:repeating-linear-gradient(90deg,#FCEA0D_0_26px,transparent_26px_52px)]" />
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold tracking-[0.18em] text-text-secondary/80">RIBERALTA · BENI · BOLIVIA</p>
    </div>
  );
}

export const LoginView = () => {
  const { setCurrentView, loginUser, resetNotice, dismissResetNotice } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Iniciando sesión...');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTitle, setSuccessTitle] = useState('¡Bienvenido!');
  const [successSubtitle, setSuccessSubtitle] = useState('Sesión iniciada con éxito');
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal para pedir el número de celular en el primer registro
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Iniciar sesión con Google (Fácil, rápido, 1 toque)
  const handleGoogleLogin = async () => {
    haptics.heavy();
    setIsLoading(true);
    setLoadingText('Autenticando con Google...');
    setErrorMsg(null);

    try {
      const { profile, isFirstTime } = await apiService.loginWithGoogle();
      setPendingUser(profile);
      setIsFirstTimeUser(isFirstTime);
      setIsLoading(false);

      if (isFirstTime) {
        // Primer registro: verificar si le falta ingresar su teléfono
        const cleanPhone = (profile.phone || '').replace(/[^0-9]/g, '');
        if (!profile.phone || cleanPhone.length < 8 || cleanPhone === '59170000000') {
          setShowPhoneModal(true);
        } else {
          // Ya tiene teléfono, falta seleccionar rol
          setSuccessTitle('¡Bienvenido!');
          setSuccessSubtitle(`${profile.name}`);
          setShowSuccess(true);
        }
      } else {
        // Usuario recurrente con teléfono y rol ya registrados
        setSuccessTitle('¡Bienvenido de nuevo!');
        setSuccessSubtitle(`${profile.name}`);
        setShowSuccess(true);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setIsLoading(false);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Inicio de sesión cancelado.');
      } else {
        setErrorMsg('No se pudo conectar con Google. Por favor intenta de nuevo.');
      }
    }
  };

  // Guardar número de celular en el primer registro
  const handleSavePhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = phoneDigits.trim().replace(/[^0-9]/g, '');

    if (clean.length < 8) {
      setPhoneError('Por favor ingresa un número de celular válido de 8 dígitos (ej. 76868110)');
      haptics.error();
      return;
    }

    if (!pendingUser) return;

    haptics.heavy();
    setSavingPhone(true);
    setPhoneError(null);

    try {
      const fullPhone = await apiService.updateUserPhone(pendingUser.id, clean);
      const updatedProfile: UserProfile = {
        ...pendingUser,
        phone: fullPhone,
        hasSelectedRole: false,
      };

      setPendingUser(updatedProfile);
      setSavingPhone(false);
      setShowPhoneModal(false);

      // Feedback animado iOS
      setSuccessTitle('¡Cuenta Lista!');
      setSuccessSubtitle(`Bienvenido a LlamaGO, ${updatedProfile.name}`);
      setShowSuccess(true);
    } catch (err) {
      console.error('Error guardando celular:', err);
      setSavingPhone(false);
      setPhoneError('Hubo un error al guardar el teléfono. Intenta nuevamente.');
    }
  };

  // Fin de la animación HUD de éxito
  const handleSuccessFinished = () => {
    if (pendingUser) {
      const cleanPhone = (pendingUser.phone || '').replace(/[^0-9]/g, '');
      const hasPhone = cleanPhone.length >= 8 && cleanPhone !== '59170000000';
      // Solo va a selección de rol si es usuario nuevo y no ha elegido rol permanentemente
      const needsRoleSelection = isFirstTimeUser || !pendingUser.hasSelectedRole || !hasPhone;

      if (!needsRoleSelection) {
        // Usuario existente: VA DIRECTO A MAIN_APP sin volver a preguntar rol
        loginUser(pendingUser, 'MAIN_APP');
        setCurrentView('MAIN_APP');
      } else {
        // Primer registro: va a la pantalla de selección de rol única y permanente
        loginUser(pendingUser, 'ROLE_SELECTION');
        setCurrentView('ROLE_SELECTION');
      }
    }
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-background text-white">
      <LobbyBackdrop />

      {/* iOS Loading & Success Toast Overlay */}
      <IosToastOverlay
        isLoading={isLoading}
        loadingText={loadingText}
        showSuccess={showSuccess}
        successTitle={successTitle}
        successSubtitle={successSubtitle}
        onSuccessComplete={handleSuccessFinished}
      />

      {/* Si la pantalla es baja o ancha, el lobby se desplaza en vez de cortarse */}
      <div className="relative z-10 flex h-full flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-4">
        {/* Marca: el logo se dibuja de izquierda a derecha y flota suave */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="relative mx-auto w-[min(60vw,240px,30dvh)]"
        >
          <div className="lobby-pulse absolute inset-x-6 inset-y-4 rounded-full bg-gold-primary/25 blur-3xl" aria-hidden />
          <motion.img
            src="/wordmark.png"
            alt="LlamaGO: pide, viaja y disfruta"
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 1.1, delay: 0.15, ease: [0.77, 0, 0.175, 1] }}
            className="lobby-float relative z-10 h-auto w-full"
          />
        </motion.div>

        <RotatingLine />

        {resetNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="mt-6 space-y-2 rounded-2xl border border-gold-primary/40 bg-gold-primary/10 p-4 text-sm text-white"
          >
            <p className="font-extrabold text-gold-primary">LlamaGO se reinició: versión {APP_VERSION}</p>
            <p className="text-xs leading-relaxed text-text-secondary">
              Hicimos un reinicio general de la aplicación por temas de seguridad y cambios en nuestras normas, así que tu sesión se cerró. Ahora sí puedes registrarte de nuevo. ¡Gracias por tu paciencia!
            </p>
            <button type="button" onClick={dismissResetNotice} className="min-h-10 rounded-xl bg-gold-primary px-4 text-xs font-black text-background">Entendido</button>
          </motion.div>
        )}

        {errorMsg && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Botón principal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9, ease: [0.23, 1, 0.32, 1] }}
          className="mt-10 space-y-3"
        >
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="lobby-shine group relative flex min-h-14 w-full touch-manipulation items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-5 text-[15px] font-extrabold text-neutral-900 shadow-[0_0_0_1px_rgba(252,234,13,0.5),0_14px_40px_-12px_rgba(252,234,13,0.55)] transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continuar con Google</span>
            <ArrowRight className="h-4 w-4 text-neutral-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
          <p className="text-center text-[11px] text-text-secondary">
            Al continuar aceptas los Términos de LlamaGO Bolivia.
          </p>
        </motion.div>
      </div>

      <RoadStrip />
      </div>

      {/* MODAL CUPERTINO PARA PEDIR EL CELULAR EN EL PRIMER REGISTRO */}
      <AnimatePresence>
        {showPhoneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-surface border border-gold-primary/50 rounded-3xl p-6 shadow-2xl text-center space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-primary/10 rounded-full blur-2xl pointer-events-none" />

              <div className="w-16 h-16 rounded-2xl bg-gold-primary/20 border-2 border-gold-primary/60 flex items-center justify-center text-gold-primary mx-auto shadow-lg shadow-gold-primary/20">
                <Smartphone className="w-8 h-8 stroke-[2.2]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">¡Casi listo, {pendingUser?.name?.split(' ')[0]}!</h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Para coordinar tus viajes y que los mototaxistas puedan llamarte o ubicarte en Riberalta, ingresa tu número de celular:
                </p>
              </div>

              {phoneError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                  {phoneError}
                </div>
              )}

              <form onSubmit={handleSavePhone} className="space-y-4">
                <div className="relative flex items-center bg-surface-2 border border-gold-primary/50 rounded-2xl overflow-hidden shadow-inner focus-within:border-gold-primary transition">
                  <div className="px-3.5 py-3.5 bg-surface border-r border-border-custom flex items-center gap-1.5 text-gold-primary font-bold text-sm select-none">
                    <span>🇧🇴</span>
                    <span>+591</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    autoFocus
                    value={phoneDigits}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                      setPhoneDigits(val);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="76868110"
                    className="w-full py-3 px-4 text-lg font-black font-mono tracking-widest text-white placeholder-text-secondary/40 bg-transparent focus:outline-none"
                    style={{ fontSize: '18px' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPhone || phoneDigits.length < 8}
                  className="w-full py-3.5 bg-gradient-to-r from-gold-primary via-gold-primary to-gold-light text-background rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-gold-primary/25 transition active:scale-[0.98] disabled:opacity-40"
                >
                  {savingPhone ? (
                    <IosSpinner size="sm" color="dark" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Guardar y Continuar</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
