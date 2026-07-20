import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { getDefaultRouteForUser } from '../auth/authHelpers'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    username: '',
    password: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const authenticatedUser = await login(form)

      navigate(
        getDefaultRouteForUser(authenticatedUser),
        { replace: true },
      )
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        'No se pudo iniciar sesión. Revisa tu usuario y contraseña.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo-wrapper">
            <img
              src="src/assets/EcoPosada_Tisey_logo.png"
              alt="Logo EcoPosada Tisey"
              className="login-logo"
            />
          </div>

          <h1>EcoPosada Tisey</h1>
          <p>Sistema de gestión de hospedaje y restaurante</p>
        </div>

        <div className="login-content">
          <h2>Iniciar sesión</h2>
          <div className="login-subtitle">
          <p>Ingresa tus credenciales para continuar.</p>

          <p className="login-help-text">
            Si no tienes acceso, contacta al administrador del sistema o pregúntale a tu jefe directo.
          </p>
        </div>

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Usuario
              </label>

              <input
                id="username"
                name="username"
                type="text"
                className="form-control login-input"
                value={form.username}
                onChange={handleChange}
                placeholder="Ej: admin"
                autoComplete="username"
                minLength={3}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>

              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control login-input"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn login-button w-100"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className="login-footer">
            Acceso autorizado únicamente para personal de EcoPosada Tisey.
          </p>
        </div>
      </section>
    </main>
  )
}