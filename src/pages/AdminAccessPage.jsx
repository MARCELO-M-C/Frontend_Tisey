import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  createRoleRequest,
  createUserRequest,
  getPermissionsRequest,
  getRolesRequest,
  getUsersRequest,
  replaceRolePermissionsRequest,
  replaceUserRolesRequest,
  updateRoleRequest,
  updateUserRequest,
  updateUserStatusRequest,
} from '../services/accessService'
import './AdminAccessPage.css'

const accessTabs = [
  { id: 'users', label: 'Usuarios', helper: 'Crear, editar, activar y eliminar usuarios.' },
  { id: 'roles', label: 'Roles', helper: 'Gestionar roles administrativos.' },
  { id: 'permissions', label: 'Permisos', helper: 'Lista de permisos.' },
  { id: 'matrix', label: 'Matriz de roles y permisos', helper: 'Asignar permisos a cada rol.' },
]

const initialUserForm = {
  id: '',
  username: '',
  firstName: '',
  lastName: '',
  password: '',
  roleIds: [],
}

const initialRoleForm = {
  id: '',
  name: '',
  permissionIds: [],
}

export default function AdminAccessPage() {
  const { user, logout } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userSearch, setUserSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')

  const [userForm, setUserForm] = useState(initialUserForm)
  const [roleForm, setRoleForm] = useState(initialRoleForm)
  const [matrixRoleId, setMatrixRoleId] = useState('')
  const [matrixPermissionIds, setMatrixPermissionIds] = useState([])

  useEffect(() => {
    loadAccessData()
  }, [])

  useEffect(() => {
    if (!matrixRoleId && roles.length > 0) {
      const firstRole = roles[0]
      setMatrixRoleId(firstRole.id)
      setMatrixPermissionIds(getPermissionIds(firstRole))
    }
  }, [matrixRoleId, roles])

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase()

    return users.filter((item) => {
      const fullName = getFullName(item).toLowerCase()
      const username = String(item.username ?? '').toLowerCase()
      const roleIds = getRoleIds(item)

      const matchesSearch =
        !search || fullName.includes(search) || username.includes(search)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive)

      const matchesRole = roleFilter === 'all' || roleIds.includes(roleFilter)

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [roleFilter, statusFilter, userSearch, users])

  async function loadAccessData() {
    try {
      setLoading(true)
      setError('')

      const [usersPayload, rolesPayload, permissionsPayload] = await Promise.all([
        getUsersRequest(),
        getRolesRequest(),
        getPermissionsRequest(),
      ])

      const nextUsers = normalizeList(usersPayload, 'users')
      const nextRoles = normalizeList(rolesPayload, 'roles')
      const nextPermissions = normalizeList(permissionsPayload, 'permissions')

      setUsers(nextUsers)
      setRoles(nextRoles)
      setPermissions(nextPermissions)

      if (nextRoles.length > 0) {
        const selectedRole = nextRoles[0]
        setMatrixRoleId(selectedRole.id)
        setMatrixPermissionIds(getPermissionIds(selectedRole))
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo cargar Usuarios y Accesos.'))
    } finally {
      setLoading(false)
    }
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function handleTabChange(tabId) {
    clearMessages()
    setActiveTab(tabId)
    setDrawerOpen(false)
  }

  function handleUserFieldChange(event) {
    const { name, value } = event.target
    setUserForm((current) => ({ ...current, [name]: value }))
  }

  function handleUserRoleToggle(roleId) {
    setUserForm((current) => ({
      ...current,
      roleIds: toggleId(current.roleIds, roleId),
    }))
  }

  function startCreateUser() {
    clearMessages()
    setUserForm(initialUserForm)
  }

  function startEditUser(selectedUser) {
    clearMessages()
    setUserForm({
      id: selectedUser.id,
      username: selectedUser.username ?? '',
      firstName: selectedUser.firstName ?? '',
      lastName: selectedUser.lastName ?? '',
      password: '',
      roleIds: getRoleIds(selectedUser),
    })
    setActiveTab('users')
  }

  async function handleUserSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(userForm.id)
    const basePayload = {
      username: userForm.username.trim(),
      firstName: userForm.firstName.trim(),
      lastName: userForm.lastName.trim(),
      roleIds: userForm.roleIds.map(Number)
    }

    const createPayload = {
      ...basePayload,
      password: userForm.password,
    }

    if (!isEditing && !userForm.password.trim()) {
      setError('La contraseña es obligatoria para crear un usuario.')
      return
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateUserRequest(userForm.id, basePayload)
        await replaceUserRolesRequest(userForm.id, userForm.roleIds)
        setSuccess('Usuario actualizado correctamente.')
      } else {
        const createdPayload = await createUserRequest(createPayload)
        const createdUser = getSingleRecord(createdPayload, 'user')
        const createdUserId = createdUser?.id

        if (createdUserId && userForm.roleIds.length > 0) {
          await replaceUserRolesRequest(createdUserId, userForm.roleIds)
        }

        setSuccess('Usuario creado correctamente.')
      }

      setUserForm(initialUserForm)
      await loadAccessData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar el usuario.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleUserStatus(selectedUser) {
    clearMessages()

    try {
      setSaving(true)
      await updateUserStatusRequest(selectedUser.id, !selectedUser.isActive)
      setSuccess(
        selectedUser.isActive
          ? 'Usuario desactivado correctamente.'
          : 'Usuario activado correctamente.',
      )
      await loadAccessData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo cambiar el estado del usuario.'))
    } finally {
      setSaving(false)
    }
  }

  function handleRoleFieldChange(event) {
    const { value } = event.target
    setRoleForm((current) => ({ ...current, name: value }))
  }

  function handleRolePermissionToggle(permissionId) {
    setRoleForm((current) => ({
      ...current,
      permissionIds: toggleId(current.permissionIds, permissionId),
    }))
  }

  function startCreateRole() {
    clearMessages()
    setRoleForm(initialRoleForm)
  }

  function startEditRole(role) {
    clearMessages()
    setRoleForm({
      id: role.id,
      name: role.name ?? '',
      permissionIds: getPermissionIds(role),
    })
    setActiveTab('roles')
  }

  async function handleRoleSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(roleForm.id)
    const payload = { name: roleForm.name.trim() }

    try {
      setSaving(true)

      if (isEditing) {
        await updateRoleRequest(roleForm.id, payload)
        await replaceRolePermissionsRequest(roleForm.id, roleForm.permissionIds)
        setSuccess('Rol actualizado correctamente.')
      } else {
        const createdPayload = await createRoleRequest(payload)
        const createdRole = getSingleRecord(createdPayload, 'role')
        const createdRoleId = createdRole?.id

        if (createdRoleId && roleForm.permissionIds.length > 0) {
          await replaceRolePermissionsRequest(createdRoleId, roleForm.permissionIds)
        }

        setSuccess('Rol creado correctamente.')
      }

      setRoleForm(initialRoleForm)
      await loadAccessData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar el rol.'))
    } finally {
      setSaving(false)
    }
  }

  function handleMatrixRoleChange(event) {
    const roleId = event.target.value
    const selectedRole = roles.find((role) => role.id === roleId)

    setMatrixRoleId(roleId)
    setMatrixPermissionIds(getPermissionIds(selectedRole))
    clearMessages()
  }

  function handleMatrixPermissionToggle(permissionId) {
    setMatrixPermissionIds((current) => toggleId(current, permissionId))
  }

  async function handleMatrixSubmit(event) {
    event.preventDefault()
    clearMessages()

    if (!matrixRoleId) {
      setError('Selecciona un rol antes de guardar permisos.')
      return
    }

    try {
      setSaving(true)
      await replaceRolePermissionsRequest(matrixRoleId, matrixPermissionIds)
      setSuccess('Permisos del rol actualizados correctamente.')
      await loadAccessData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo actualizar la matriz RBAC.'))
    } finally {
      setSaving(false)
    }
  }

  const activeTabData = accessTabs.find((tab) => tab.id === activeTab)

  return (
    <main className="access-page">
      <section className="access-hero">
        <div>
          <span className="access-eyebrow">Administración</span>
          <h1>Usuarios y Accesos</h1>
          <p>
            Gestiona usuarios, roles y permisos del sistema.
          </p>
          <small className="access-last-update">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="access-hero-actions">
          <Link to="/dashboard" className="btn access-secondary-button">
            Volver al dashboard
          </Link>
          <button type="button" className="btn access-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="access-layout">
        <aside className={`access-sidebar ${drawerOpen ? 'is-open' : ''}`}>
          <div className="access-sidebar-header">
            <strong>Menú admin</strong>
            <button
              type="button"
              className="access-menu-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <button type="button" className="access-menu-item is-active">
            <span>Usuarios</span>
            <small>Usuarios y Accesos</small>
          </button>

          <button type="button" className="access-menu-item" disabled>
            <span>Órdenes</span>
            <small>Próximo módulo</small>
          </button>

          <button type="button" className="access-menu-item" disabled>
            <span>Hospedaje</span>
            <small>Próximo módulo</small>
          </button>

          <button type="button" className="access-menu-item" disabled>
            <span>Facturación</span>
            <small>Próximo módulo</small>
          </button>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="access-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú administrativo"
          />
        )}

        <section className="access-content">
          <div className="access-toolbar">
            <button
              type="button"
              className="access-menu-button"
              onClick={() => setDrawerOpen(true)}
            >
              ☰ Menú
            </button>

            <div>
              <span>Usuarios</span>
              <strong>Usuarios y Accesos</strong>
            </div>
          </div>

          <section className="access-card access-title-card">
            <div className="access-section-header">
              <div>
                <h2>{activeTabData?.label}</h2>
                <p>{activeTabData?.helper}</p>
              </div>
            </div>

            <div className="access-tabs" role="tablist" aria-label="Secciones RBAC">
              {accessTabs.map((tab) => (
                <button
                  type="button"
                  className={`access-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {error && <section className="access-alert access-alert-error">{error}</section>}
          {success && <section className="access-alert access-alert-success">{success}</section>}

          {loading ? (
            <section className="access-card access-empty-state">Cargando información...</section>
          ) : (
            <>
              {activeTab === 'users' && (
                <UsersPanel
                  filteredUsers={filteredUsers}
                  roles={roles}
                  userForm={userForm}
                  userSearch={userSearch}
                  statusFilter={statusFilter}
                  roleFilter={roleFilter}
                  saving={saving}
                  onSearchChange={setUserSearch}
                  onStatusFilterChange={setStatusFilter}
                  onRoleFilterChange={setRoleFilter}
                  onFieldChange={handleUserFieldChange}
                  onRoleToggle={handleUserRoleToggle}
                  onSubmit={handleUserSubmit}
                  onCreate={startCreateUser}
                  onEdit={startEditUser}
                  onToggleStatus={handleToggleUserStatus}
                />
              )}

              {activeTab === 'roles' && (
                <RolesPanel
                  roles={roles}
                  permissions={permissions}
                  roleForm={roleForm}
                  saving={saving}
                  onFieldChange={handleRoleFieldChange}
                  onPermissionToggle={handleRolePermissionToggle}
                  onSubmit={handleRoleSubmit}
                  onCreate={startCreateRole}
                  onEdit={startEditRole}
                />
              )}

              {activeTab === 'permissions' && (
                <PermissionsPanel permissions={permissions} />
              )}

              {activeTab === 'matrix' && (
                <MatrixPanel
                  roles={roles}
                  permissions={permissions}
                  matrixRoleId={matrixRoleId}
                  matrixPermissionIds={matrixPermissionIds}
                  saving={saving}
                  onRoleChange={handleMatrixRoleChange}
                  onPermissionToggle={handleMatrixPermissionToggle}
                  onSubmit={handleMatrixSubmit}
                />
              )}
            </>
          )}
        </section>
      </section>
    </main>
  )
}

function UsersPanel({
  filteredUsers,
  roles,
  userForm,
  userSearch,
  statusFilter,
  roleFilter,
  saving,
  onSearchChange,
  onStatusFilterChange,
  onRoleFilterChange,
  onFieldChange,
  onRoleToggle,
  onSubmit,
  onCreate,
  onEdit,
  onToggleStatus,
}) {
  const isEditing = Boolean(userForm.id)

  return (
    <section className="access-two-column">
      <article className="access-card">
        <div className="access-section-header">
          <div>
            <h2>{isEditing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <p>
              {isEditing
                ? 'Actualiza los datos principales y sus roles.'
                : 'Crea un usuario administrativo y asígnale roles.'}
            </p>
          </div>

          {isEditing && (
            <button type="button" className="access-small-button" onClick={onCreate}>
              Nuevo
            </button>
          )}
        </div>

        <form className="access-form" onSubmit={onSubmit}>
          <label>
            Usuario
            <input
              type="text"
              name="username"
              value={userForm.username}
              onChange={onFieldChange}
              minLength={3}
              maxLength={50}
              required
            />
          </label>

          <div className="access-form-grid">
            <label>
              Nombre
              <input
                type="text"
                name="firstName"
                value={userForm.firstName}
                onChange={onFieldChange}
                maxLength={80}
                required
              />
            </label>

            <label>
              Apellido
              <input
                type="text"
                name="lastName"
                value={userForm.lastName}
                onChange={onFieldChange}
                maxLength={80}
                required
              />
            </label>
          </div>

          {!isEditing && (
            <label>
              Contraseña inicial
              <input
                type="password"
                name="password"
                value={userForm.password}
                onChange={onFieldChange}
                minLength={6}
                maxLength={72}
                required
              />
            </label>
          )}

          <fieldset className="access-check-group">
            <legend>Roles del usuario</legend>

            {roles.length > 0 ? (
              roles.map((role) => (
                <label className="access-check-item" key={role.id}>
                  <input
                    type="checkbox"
                    checked={userForm.roleIds.includes(role.id)}
                    onChange={() => onRoleToggle(role.id)}
                  />
                  <span>{role.name}</span>
                </label>
              ))
            ) : (
              <p className="access-muted">Todavía no hay roles registrados.</p>
            )}
          </fieldset>

          <button type="submit" className="btn access-primary-button" disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar usuario' : 'Crear usuario'}
          </button>
        </form>
      </article>

      <article className="access-card">
        <div className="access-section-header">
          <div>
            <h2>Listado de usuarios</h2>
            <p>Filtra por nombre, usuario, estado o rol.</p>
          </div>
        </div>

        <div className="access-filters">
          <input
            type="search"
            placeholder="Buscar usuario..."
            value={userSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          <select
            value={roleFilter}
            onChange={(event) => onRoleFilterChange(event.target.value)}
          >
            <option value="all">Todos los roles</option>
            {roles.map((role) => (
              <option value={role.id} key={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="access-list">
            {filteredUsers.map((item) => (
              <div className="access-list-item" key={item.id}>
                <div>
                  <strong>{getFullName(item)}</strong>
                  <p>@{item.username}</p>

                  <div className="access-badges">
                    <span className={item.isActive ? 'badge-success' : 'badge-danger'}>
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    {getRoleNames(item).map((roleName) => (
                      <span key={roleName}>{roleName}</span>
                    ))}
                  </div>
                </div>

                <div className="access-row-actions">
                  <button type="button" onClick={() => onEdit(item)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => onToggleStatus(item)}>
                    {item.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="access-empty-state">No hay usuarios con esos filtros.</div>
        )}
      </article>
    </section>
  )
}

function RolesPanel({
  roles,
  permissions,
  roleForm,
  saving,
  onFieldChange,
  onPermissionToggle,
  onSubmit,
  onCreate,
  onEdit,
}) {
  const isEditing = Boolean(roleForm.id)

  return (
    <section className="access-two-column">
      <article className="access-card">
        <div className="access-section-header">
          <div>
            <h2>{isEditing ? 'Editar rol' : 'Nuevo rol'}</h2>
            <p>Define el nombre del rol y sus permisos asociados.</p>
          </div>

          {isEditing && (
            <button type="button" className="access-small-button" onClick={onCreate}>
              Nuevo
            </button>
          )}
        </div>

        <form className="access-form" onSubmit={onSubmit}>
          <label>
            Nombre del rol
            <input
              type="text"
              value={roleForm.name}
              onChange={onFieldChange}
              minLength={3}
              maxLength={50}
              required
            />
          </label>

          <fieldset className="access-check-group">
            <legend>Permisos del rol</legend>

            {permissions.length > 0 ? (
              permissions.map((permission) => (
                <label className="access-check-item" key={permission.id}>
                  <input
                    type="checkbox"
                    checked={roleForm.permissionIds.includes(permission.id)}
                    onChange={() => onPermissionToggle(permission.id)}
                  />
                  <span>{permission.code}</span>
                  {permission.description && <small>{permission.description}</small>}
                </label>
              ))
            ) : (
              <p className="access-muted">Todavía no hay permisos registrados.</p>
            )}
          </fieldset>

          <button type="submit" className="btn access-primary-button" disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar rol' : 'Crear rol'}
          </button>
        </form>
      </article>

      <article className="access-card">
        <div className="access-section-header">
          <div>
            <h2>Roles registrados</h2>
            <p>Selecciona un rol para editar sus permisos.</p>
          </div>
        </div>

        {roles.length > 0 ? (
          <div className="access-list">
            {roles.map((role) => (
              <div className="access-list-item" key={role.id}>
                <div>
                  <strong>{role.name}</strong>
                  <p>{getPermissionIds(role).length} permiso(s) asignado(s)</p>
                </div>

                <div className="access-row-actions">
                  <button type="button" onClick={() => onEdit(role)}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="access-empty-state">Todavía no hay roles registrados.</div>
        )}
      </article>
    </section>
  )
}

function PermissionsPanel({ permissions }) {
  return (
    <section className="access-card">
      <div className="access-section-header">
        <div>
          <h2>Permisos del sistema</h2>
          <p>
            Por ahora se muestran como catálogo técnico. Si quieres CRUD completo de permisos,
            primero agregamos endpoints específicos en backend.
          </p>
        </div>
      </div>

      {permissions.length > 0 ? (
        <div className="access-permission-grid">
          {permissions.map((permission) => (
            <article className="access-permission-card" key={permission.id}>
              <strong>{permission.code}</strong>
              <p>{permission.description || 'Sin descripción registrada.'}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="access-empty-state">Todavía no hay permisos registrados.</div>
      )}
    </section>
  )
}

function MatrixPanel({
  roles,
  permissions,
  matrixRoleId,
  matrixPermissionIds,
  saving,
  onRoleChange,
  onPermissionToggle,
  onSubmit,
}) {
  return (
    <section className="access-card">
      <div className="access-section-header">
        <div>
          <h2>Matriz RBAC</h2>
          <p>Selecciona un rol y marca los permisos que debe tener.</p>
        </div>
      </div>

      <form className="access-form" onSubmit={onSubmit}>
        <label>
          Rol
          <select value={matrixRoleId} onChange={onRoleChange} required>
            <option value="">Selecciona un rol</option>
            {roles.map((role) => (
              <option value={role.id} key={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="access-check-group access-matrix-grid">
          <legend>Permisos disponibles</legend>

          {permissions.length > 0 ? (
            permissions.map((permission) => (
              <label className="access-check-item" key={permission.id}>
                <input
                  type="checkbox"
                  checked={matrixPermissionIds.includes(permission.id)}
                  onChange={() => onPermissionToggle(permission.id)}
                />
                <span>{permission.code}</span>
                {permission.description && <small>{permission.description}</small>}
              </label>
            ))
          ) : (
            <p className="access-muted">Todavía no hay permisos registrados.</p>
          )}
        </fieldset>

        <button type="submit" className="btn access-primary-button" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar matriz RBAC'}
        </button>
      </form>
    </section>
  )
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return normalizeIds(payload)
  if (Array.isArray(payload?.[key])) return normalizeIds(payload[key])
  if (Array.isArray(payload?.items)) return normalizeIds(payload.items)
  if (Array.isArray(payload?.data)) return normalizeIds(payload.data)
  return []
}

function normalizeIds(items) {
  return items.map((item) => ({
    ...item,
    id: String(item.id),
    roles: Array.isArray(item.roles)
      ? item.roles.map((role) => ({ ...role, id: String(role.id) }))
      : item.roles,
    permissions: Array.isArray(item.permissions)
      ? item.permissions.map((permission) => ({ ...permission, id: String(permission.id) }))
      : item.permissions,
  }))
}

function getSingleRecord(payload, key) {
  if (!payload) return null
  if (payload.id) return { ...payload, id: String(payload.id) }
  if (payload[key]?.id) return { ...payload[key], id: String(payload[key].id) }
  if (payload.data?.id) return { ...payload.data, id: String(payload.data.id) }
  return null
}

function getRoleIds(user) {
  if (!Array.isArray(user?.roles)) return []
  return user.roles.map((role) => String(role.id))
}

function getRoleNames(user) {
  if (!Array.isArray(user?.roles)) return []
  return user.roles.map((role) => role.name).filter(Boolean)
}

function getPermissionIds(role) {
  if (!Array.isArray(role?.permissions)) return []
  return role.permissions.map((permission) => String(permission.id))
}

function getFullName(user) {
  return user?.fullName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Sin nombre'
}

function toggleId(currentIds, id) {
  const normalizedId = String(id)
  return currentIds.includes(normalizedId)
    ? currentIds.filter((currentId) => currentId !== normalizedId)
    : [...currentIds, normalizedId]
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}
