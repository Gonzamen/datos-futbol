import { loginWithGoogle } from '../../shared/session/sessionStore.js'
import { Logo } from '../../shared/ui/Logo.js'

export function LoginScreen() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <Logo size="full" />
        <p>
          Cargá estadísticas del partido con tus amigos, mirando el video, cada uno desde su casa.
        </p>
        <button type="button" className="btn btn--primary" onClick={loginWithGoogle}>
          Iniciar sesión con Google
        </button>
      </div>
    </div>
  )
}
