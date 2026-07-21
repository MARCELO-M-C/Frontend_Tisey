import { Link } from 'react-router'

export default function UnauthorizedPage() {
  return (
    <main className="container py-4">
      <div className="alert alert-warning">
        No tienes permisos para acceder a esta sección.
      </div>

      <Link to="/login" className="btn btn-primary">
        Volver al login
      </Link>      
    </main>
  )  
}