import { Link } from 'react-router'

export default function UnauthorizedPage() {
  return (
    <main className="container py-4">
      <div className="alert alert-warning">
        No tienes permisos para acceder a esta sección.
      </div>

      <Link to="/dashboard" className="btn btn-primary">
        Volver al dashboard
      </Link>
    </main>
  )
}