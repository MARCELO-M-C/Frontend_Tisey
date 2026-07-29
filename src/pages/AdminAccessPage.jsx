import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  canUsePermission,
  isAdminUser,
  isManagerUser,
} from '../auth/authHelpers'
import {
  createUserRequest,
  getPermissionsRequest,
  getRolesRequest,
  getUsersRequest,
  replaceUserPermissionsRequest,
  replaceUserRolesRequest,
  updateUserRequest,
  updateUserStatusRequest,
} from '../services/accessService'
import './AdminAccessPage.css'

const OPERATIONAL_ROLE_NAMES = new Set(['MESERO', 'COCINA', 'CAJA'])

const adminMenuSections = [
  {
    title: 'Administración',
    items: [
      {
        title: 'Usuarios y Accesos',
        description: 'Gestiona usuarios, roles y permisos individuales.',
        to: '/admin/access',
        icon: '🔐',
        permission: 'ADMIN_USERS_MANAGE',
      },
    ],
  },
  {
    title: 'Restaurante',
    items: [
      {
        title: 'Órdenes',
        description: 'Toma, revisa y gestiona órdenes.',
        to: '/admin/orders',
        icon: '🍽️',
        permission: 'ADMIN_ORDERS_MANAGE',
      },
      {
        title: 'Cocina / KDS',
        description: 'Da seguimiento a las órdenes en cocina.',
        to: '/kitchen',
        icon: '👨‍🍳',
        permission: 'ADMIN_KITCHEN_MANAGE',
      },
      {
        title: 'Mesas',
        description: 'Gestiona las mesas del restaurante.',
        to: '/admin/restaurant-tables',
        icon: '🪑',
        permission: 'ADMIN_TABLES_MANAGE',
      },
      {
        title: 'Turnos y estaciones',
        description: 'Administra turnos, áreas y estaciones.',
        to: '/admin/operations',
        icon: '🧭',
        permission: 'ADMIN_SHIFTS_&_STATIONS_MANAGE',
      },
    ],
  },
  {
    title: 'Menú',
    items: [
      {
        title: 'Menú del restaurante',
        description: 'Gestiona platillos, categorías y disponibilidad.',
        to: '/admin/menu',
        icon: '📋',
        permission: 'ADMIN_MENU_MANAGE',
      },
    ],
  },
  {
    title: 'Hospedaje',
    items: [
      {
        title: 'Hospedaje',
        description: 'Gestiona cabañas, huéspedes y estadías.',
        to: '/admin/lodging',
        icon: '🏡',
        permission: 'ADMIN_LODGING_MANAGE',
      },
    ],
  },
  {
    title: 'Facturación',
    items: [
      {
        title: 'Facturación',
        description: 'Gestiona facturas, cobros e historial.',
        to: '/billing',
        icon: '🧾',
        permission: 'ADMIN_BILLING_MANAGE',
      },
    ],
  },
]

const initialUserForm = {
  username: '',
  firstName: '',
  lastName: '',
  password: '',
  roleId: '',
  permissionIds: [],
}

export default function AdminAccessPage() {
  const { user, logout } = useAuth()
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalError, setModalError] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [activeModal, setActiveModal] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const currentUserIsAdmin = isAdminUser(user)
  const currentUserIsManager = isManagerUser(user) && !currentUserIsAdmin

  const menuSections = useMemo(
    () =>
      adminMenuSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            canUsePermission(user, item.permission),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [user],
  )

  const assignableRoles = useMemo(() => {
    if (currentUserIsAdmin) return roles

    return roles.filter((role) =>
      OPERATIONAL_ROLE_NAMES.has(normalizeRoleName(role.name)),
    )
  }, [currentUserIsAdmin, roles])

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
      const matchesRole =
        roleFilter === 'all' || roleIds.includes(String(roleFilter))

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [roleFilter, statusFilter, userSearch, users])

  const loadAccessData = useCallback(
    async ({ preserveMessages = false } = {}) => {
      try {
        setLoading(true)
        setError('')
        if (!preserveMessages) setSuccess('')

        const requests = [getUsersRequest(), getRolesRequest()]

        if (currentUserIsAdmin) {
          requests.push(getPermissionsRequest())
        }

        const [usersPayload, rolesPayload, permissionsPayload = []] =
          await Promise.all(requests)

        setUsers(normalizeList(usersPayload, 'users'))
        setRoles(normalizeList(rolesPayload, 'roles'))
        setPermissions(
          currentUserIsAdmin
            ? normalizeList(permissionsPayload, 'permissions')
            : [],
        )
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            'No se pudo cargar la información de Usuarios y Accesos.',
          ),
        )
      } finally {
        setLoading(false)
      }
    },
    [currentUserIsAdmin],
  )

  useEffect(() => {
    loadAccessData()
  }, [loadAccessData])

  useEffect(() => {
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)

        if (activeModal && !saving) {
          setActiveModal(null)
          setSelectedUser(null)
          setUserForm(initialUserForm)
          setPasswordEditorOpen(false)
          setShowPassword(false)
          setModalError('')
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeModal, saving])


  function clearMessages() {
    setError('')
    setSuccess('')
    setModalError('')
  }

  function openCreateModal() {
    clearMessages()
    setPasswordEditorOpen(false)
    setShowPassword(false)
    setSelectedUser(null)
    setUserForm({
      ...initialUserForm,
      roleId: assignableRoles[0]?.id ?? '',
    })
    setActiveModal('create')
  }

  function openDetailModal(item) {
    clearMessages()
    setPasswordEditorOpen(false)
    setShowPassword(false)
    setSelectedUser(item)
    setActiveModal('detail')
  }

  function openEditModal(item) {
    clearMessages()
    setPasswordEditorOpen(false)
    setShowPassword(false)
    setSelectedUser(item)
    setUserForm({
      username: item.username ?? '',
      firstName: item.firstName ?? '',
      lastName: item.lastName ?? '',
      password: '',
      roleId: getRoleIds(item)[0] ?? '',
      permissionIds: getPermissionIds(item),
    })
    setActiveModal('edit')
  }

  function openAccessModal(item) {
    clearMessages()
    setPasswordEditorOpen(false)
    setShowPassword(false)
    setSelectedUser(item)
    setUserForm({
      username: item.username ?? '',
      firstName: item.firstName ?? '',
      lastName: item.lastName ?? '',
      password: '',
      roleId: getRoleIds(item)[0] ?? '',
      permissionIds: getPermissionIds(item),
    })
    setActiveModal('access')
  }

  function openStatusModal(item) {
    clearMessages()
    setPasswordEditorOpen(false)
    setShowPassword(false)
    setSelectedUser(item)
    setActiveModal('status')
  }

  function closeModal() {
    setActiveModal(null)
    setSelectedUser(null)
    setUserForm(initialUserForm)
    setPasswordEditorOpen(false)
    setShowPassword(false)
    setModalError('')
  }

  function handlePasswordEditorToggle() {
    setModalError('')
    setPasswordEditorOpen((current) => {
      const nextValue = !current

      if (!nextValue) {
        setUserForm((currentForm) => ({
          ...currentForm,
          password: '',
        }))
        setShowPassword(false)
      }

      return nextValue
    })
  }

  function handleUserFieldChange(event) {
    const { name, value } = event.target
    setUserForm((current) => ({ ...current, [name]: value }))
  }

  function handleRoleChange(event) {
    const roleId = event.target.value
    const selectedRole = roles.find((role) => role.id === roleId)
    const roleName = normalizeRoleName(selectedRole?.name)

    setUserForm((current) => ({
      ...current,
      roleId,
      permissionIds:
        roleName === 'MANAGER' ? current.permissionIds : [],
    }))
  }

  function handlePermissionToggle(permissionId) {
    setUserForm((current) => ({
      ...current,
      permissionIds: toggleId(current.permissionIds, permissionId),
    }))
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    setModalError('')

    if (!userForm.roleId) {
      setModalError('Selecciona un rol para el nuevo usuario.')
      return
    }

    const selectedRole = roles.find((role) => role.id === userForm.roleId)

    if (!selectedRole) {
      setModalError('El rol seleccionado ya no está disponible.')
      return
    }

    try {
      setSaving(true)

      const createdPayload = await createUserRequest({
        username: userForm.username.trim(),
        password: userForm.password,
        firstName: userForm.firstName.trim(),
        lastName: userForm.lastName.trim(),
        isActive: true,
        roleIds: [Number(userForm.roleId)],
      })

      const createdUser = getSingleRecord(createdPayload, 'user')
      const selectedRoleName = normalizeRoleName(selectedRole.name)

      if (
        currentUserIsAdmin &&
        selectedRoleName === 'MANAGER' &&
        createdUser?.id
      ) {
        await replaceUserPermissionsRequest(
          createdUser.id,
          userForm.permissionIds.map(Number),
        )
      }

      closeModal()
      setSuccess('Usuario creado correctamente.')
      await loadAccessData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo crear el usuario.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault()
    setModalError('')

    if (!selectedUser) return

    if (passwordEditorOpen && !userForm.password.trim()) {
      setModalError('Escribe la nueva contraseña antes de guardar.')
      return
    }

    const payload = {
      username: userForm.username.trim(),
      firstName: userForm.firstName.trim(),
      lastName: userForm.lastName.trim(),
    }

    if (passwordEditorOpen) {
      payload.password = userForm.password
    }

    try {
      setSaving(true)
      await updateUserRequest(selectedUser.id, payload)
      closeModal()
      setSuccess('Datos del usuario actualizados correctamente.')
      await loadAccessData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo actualizar el usuario.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAccessSubmit(event) {
    event.preventDefault()
    setModalError('')

    if (!selectedUser || !userForm.roleId) {
      setModalError('Selecciona un rol antes de guardar el acceso.')
      return
    }

    const selectedRole = roles.find((role) => role.id === userForm.roleId)

    if (!selectedRole) {
      setModalError('El rol seleccionado ya no está disponible.')
      return
    }

    const wasManager = hasRoleName(selectedUser, 'MANAGER')
    const willBeManager = normalizeRoleName(selectedRole.name) === 'MANAGER'

    try {
      setSaving(true)

      if (currentUserIsAdmin && wasManager && !willBeManager) {
        await replaceUserPermissionsRequest(selectedUser.id, [])
      }

      await replaceUserRolesRequest(selectedUser.id, [Number(userForm.roleId)])

      if (currentUserIsAdmin && willBeManager) {
        await replaceUserPermissionsRequest(
          selectedUser.id,
          userForm.permissionIds.map(Number),
        )
      }

      closeModal()
      setSuccess('Acceso del usuario actualizado correctamente.')
      await loadAccessData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo actualizar el acceso.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusSubmit() {
    setModalError('')

    if (!selectedUser || isCurrentSessionUser(user, selectedUser)) {
      setModalError('No puedes cambiar el estado de tu propia cuenta.')
      return
    }

    try {
      setSaving(true)
      await updateUserStatusRequest(selectedUser.id, !selectedUser.isActive)
      const successMessage = selectedUser.isActive
        ? 'Usuario desactivado correctamente.'
        : 'Usuario activado correctamente.'

      closeModal()
      setSuccess(successMessage)
      await loadAccessData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado del usuario.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  function canManageUser(item) {
    if (currentUserIsAdmin) return true
    if (!currentUserIsManager) return false
    return !isAdministrativeUser(item)
  }

  const selectedRole = roles.find((role) => role.id === userForm.roleId)
  const selectedRoleName = normalizeRoleName(selectedRole?.name)

  return (
    <main className="access-page">
      <section className="access-hero">
        <div>
          <span className="access-eyebrow">Administración</span>
          <h1>Usuarios y Accesos</h1>
          <p>
            Consulta primero al personal registrado y abre únicamente la acción
            que necesites realizar.
          </p>
          <small className="access-last-update">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="access-hero-actions">
          <div className="access-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn access-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-controls="access-admin-menu"
            >
              <span>☰</span>
              Menú
            </button>

            {menuOpen && (
              <div className="access-menu-panel" id="access-admin-menu">
                <div className="access-menu-header">
                  <div>
                    <strong>Módulos del sistema</strong>
                    <p>Accede a las áreas habilitadas para tu cuenta.</p>
                  </div>
                  <button
                    type="button"
                    className="access-menu-close"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                  >
                    ×
                  </button>
                </div>

                <div className="access-menu-sections">
                  {menuSections.map((section) => (
                    <section className="access-menu-section" key={section.title}>
                      <h3>{section.title}</h3>
                      <div className="access-menu-items">
                        {section.items.map((item) => (
                          <Link
                            to={item.to}
                            className={`access-menu-item ${
                              item.to === '/admin/access' ? 'is-current' : ''
                            }`}
                            key={item.title}
                            onClick={() => setMenuOpen(false)}
                          >
                            <span>{item.icon}</span>
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.description}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link to="/dashboard" className="btn access-secondary-button">
            Volver al dashboard
          </Link>
          <button type="button" className="btn access-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      {error && <section className="access-alert access-alert-error">{error}</section>}
      {success && (
        <section className="access-alert access-alert-success">{success}</section>
      )}

      <section className="access-card access-management-card">
        <div className="access-management-header">
          <div>
            <span className="access-section-eyebrow">Gestión de personal</span>
            <h2>Usuarios registrados</h2>
            <p>
              Visualiza el estado, rol y nivel de acceso antes de realizar cambios.
            </p>
          </div>
          <button
            type="button"
            className="btn access-primary-button"
            onClick={openCreateModal}
            disabled={loading || assignableRoles.length === 0}
          >
            + Nuevo usuario
          </button>
        </div>

        <div className="access-filters" aria-label="Filtros de usuarios">
          <label className="access-search-field">
            <span>Buscar</span>
            <input
              type="search"
              placeholder="Nombre o usuario..."
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
            />
          </label>

          <label>
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>

          <label>
            <span>Rol</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">Todos los roles</option>
              {roles.map((role) => (
                <option value={role.id} key={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="access-results-summary">
          <span>
            {loading
              ? 'Cargando usuarios...'
              : `${filteredUsers.length} de ${users.length} usuario(s)`}
          </span>
          {(userSearch || statusFilter !== 'all' || roleFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setUserSearch('')
                setStatusFilter('all')
                setRoleFilter('all')
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="access-empty-state">Cargando información...</div>
        ) : filteredUsers.length > 0 ? (
          <div className="access-user-list">
            <div className="access-user-list-header" aria-hidden="true">
              <span>Usuario</span>
              <span>Rol</span>
              <span>Acceso</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>

            {filteredUsers.map((item) => {
              const isSelf = isCurrentSessionUser(user, item)
              const manageable = canManageUser(item)
              const accessSummary = getAccessSummary(item)

              return (
                <article className="access-user-row" key={item.id}>
                  <div className="access-user-identity">
                    <span className="access-avatar" aria-hidden="true">
                      {getInitials(item)}
                    </span>
                    <div>
                      <strong>{getFullName(item)}</strong>
                      <p>@{item.username}</p>
                      {isSelf && <small>Tu cuenta</small>}
                    </div>
                  </div>

                  <div className="access-user-cell" data-label="Rol">
                    <div className="access-badges">
                      {getRoleNames(item).map((roleName) => (
                        <span key={roleName}>{roleName}</span>
                      ))}
                    </div>
                  </div>

                  <div className="access-user-cell" data-label="Acceso">
                    <strong className="access-level-title">{accessSummary.title}</strong>
                    <small>{accessSummary.detail}</small>
                  </div>

                  <div className="access-user-cell" data-label="Estado">
                    <span
                      className={`access-status ${
                        item.isActive ? 'is-active' : 'is-inactive'
                      }`}
                    >
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="access-row-actions" data-label="Acciones">
                    <button type="button" onClick={() => openDetailModal(item)}>
                      Ver detalle
                    </button>

                    {manageable && (
                      <>
                        <button type="button" onClick={() => openEditModal(item)}>
                          Editar
                        </button>
                        <button type="button" onClick={() => openAccessModal(item)}>
                          Gestionar acceso
                        </button>
                        <button
                          type="button"
                          className={item.isActive ? 'is-danger' : 'is-success'}
                          onClick={() => openStatusModal(item)}
                          disabled={isSelf}
                          title={
                            isSelf
                              ? 'No puedes cambiar el estado de tu propia cuenta.'
                              : undefined
                          }
                        >
                          {item.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </>
                    )}
                  </div>

                  {!manageable && currentUserIsManager && (
                    <p className="access-restriction-note">
                      Solo ADMIN puede modificar cuentas ADMIN o MANAGER.
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="access-empty-state">
            No hay usuarios que coincidan con los filtros seleccionados.
          </div>
        )}
      </section>

      {activeModal === 'create' && (
        <AccessModal
          title="Nuevo usuario"
          subtitle="Registra sus datos y define el acceso inicial."
          onClose={closeModal}
          saving={saving}
          size="large"
        >
          <UserCreateForm
            userForm={userForm}
            roles={assignableRoles}
            permissions={permissions}
            selectedRoleName={selectedRoleName}
            isAdmin={currentUserIsAdmin}
            saving={saving}
            error={modalError}
            onFieldChange={handleUserFieldChange}
            onRoleChange={handleRoleChange}
            onPermissionToggle={handlePermissionToggle}
            onSubmit={handleCreateSubmit}
            onCancel={closeModal}
          />
        </AccessModal>
      )}

      {activeModal === 'detail' && selectedUser && (
        <AccessModal
          title="Detalle del usuario"
          subtitle={getFullName(selectedUser)}
          onClose={closeModal}
          saving={saving}
        >
          <UserDetail user={selectedUser} />
          <div className="access-modal-actions">
            <button type="button" className="access-cancel-button" onClick={closeModal}>
              Cerrar
            </button>
          </div>
        </AccessModal>
      )}

      {activeModal === 'edit' && selectedUser && (
        <AccessModal
          title="Editar usuario"
          subtitle={getFullName(selectedUser)}
          onClose={closeModal}
          saving={saving}
        >
          <form className="access-form" onSubmit={handleEditSubmit}>
            {modalError && (
              <div className="access-alert access-alert-error">{modalError}</div>
            )}
            <label>
              <span>Usuario</span>
              <input
                type="text"
                name="username"
                value={userForm.username}
                onChange={handleUserFieldChange}
                minLength={3}
                maxLength={50}
                required
              />
            </label>
            <div className="access-form-grid">
              <label>
                <span>Nombre</span>
                <input
                  type="text"
                  name="firstName"
                  value={userForm.firstName}
                  onChange={handleUserFieldChange}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                <span>Apellido</span>
                <input
                  type="text"
                  name="lastName"
                  value={userForm.lastName}
                  onChange={handleUserFieldChange}
                  maxLength={80}
                  required
                />
              </label>
            </div>
            <section className="access-password-section">
              <button
                type="button"
                className={`access-password-option${
                  passwordEditorOpen ? ' is-active' : ''
                }`}
                onClick={handlePasswordEditorToggle}
                aria-expanded={passwordEditorOpen}
                aria-controls="access-password-editor"
              >
                <span className="access-password-option-icon" aria-hidden="true">
                  <KeyIcon />
                </span>
                <span className="access-password-option-copy">
                  <strong>Actualizar contraseña</strong>
                  <small>Activa esta opción únicamente cuando necesites reemplazarla.</small>
                </span>
                <span className="access-password-option-state" aria-hidden="true">
                  {passwordEditorOpen ? '✓' : '+'}
                </span>
              </button>

              {passwordEditorOpen && (
                <label id="access-password-editor" className="access-password-field">
                  <span>Nueva contraseña</span>
                  <div className="access-password-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={userForm.password}
                      onChange={handleUserFieldChange}
                      minLength={8}
                      maxLength={72}
                      placeholder="Escribe la nueva contraseña"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="access-password-visibility"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                      title={
                        showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <small>Debe contener entre 8 y 72 caracteres.</small>
                </label>
              )}
            </section>
            <div className="access-modal-actions">
              <button type="button" className="access-cancel-button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="submit" className="access-save-button" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </AccessModal>
      )}

      {activeModal === 'access' && selectedUser && (
        <AccessModal
          title="Gestionar acceso"
          subtitle={getFullName(selectedUser)}
          onClose={closeModal}
          saving={saving}
          size="large"
        >
          <form className="access-form" onSubmit={handleAccessSubmit}>
            {modalError && (
              <div className="access-alert access-alert-error">{modalError}</div>
            )}

            <label>
              <span>Rol del usuario</span>
              <select value={userForm.roleId} onChange={handleRoleChange} required>
                <option value="">Selecciona un rol</option>
                {assignableRoles.map((role) => (
                  <option value={role.id} key={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <RoleAccessExplanation roleName={selectedRoleName} />

            {currentUserIsAdmin && selectedRoleName === 'MANAGER' && (
              <PermissionSelector
                permissions={permissions}
                selectedIds={userForm.permissionIds}
                onToggle={handlePermissionToggle}
              />
            )}

            <div className="access-modal-actions">
              <button type="button" className="access-cancel-button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="submit" className="access-save-button" disabled={saving}>
                {saving ? 'Actualizando...' : 'Actualizar acceso'}
              </button>
            </div>
          </form>
        </AccessModal>
      )}

      {activeModal === 'status' && selectedUser && (
        <AccessModal
          title={selectedUser.isActive ? 'Desactivar usuario' : 'Activar usuario'}
          subtitle={getFullName(selectedUser)}
          onClose={closeModal}
          saving={saving}
        >
          {modalError && (
            <div className="access-alert access-alert-error">{modalError}</div>
          )}
          <div className="access-confirmation">
            <span className={selectedUser.isActive ? 'is-danger' : 'is-success'}>
              {selectedUser.isActive ? '!' : '✓'}
            </span>
            <div>
              <strong>
                {selectedUser.isActive
                  ? `¿Desactivar a ${getFullName(selectedUser)}?`
                  : `¿Activar a ${getFullName(selectedUser)}?`}
              </strong>
              <p>
                {selectedUser.isActive
                  ? 'La persona no podrá iniciar sesión ni utilizar el sistema hasta que su cuenta vuelva a activarse.'
                  : 'La persona podrá volver a iniciar sesión y utilizar los módulos permitidos por su rol y sus permisos.'}
              </p>
            </div>
          </div>
          <div className="access-modal-actions">
            <button type="button" className="access-cancel-button" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="button"
              className={
                selectedUser.isActive
                  ? 'access-danger-button'
                  : 'access-save-button'
              }
              onClick={handleStatusSubmit}
              disabled={saving}
            >
              {saving
                ? 'Procesando...'
                : selectedUser.isActive
                  ? 'Desactivar usuario'
                  : 'Activar usuario'}
            </button>
          </div>
        </AccessModal>
      )}
    </main>
  )
}

function UserCreateForm({
  userForm,
  roles,
  permissions,
  selectedRoleName,
  isAdmin,
  saving,
  error,
  onFieldChange,
  onRoleChange,
  onPermissionToggle,
  onSubmit,
  onCancel,
}) {
  return (
    <form className="access-form" onSubmit={onSubmit}>
      {error && <div className="access-alert access-alert-error">{error}</div>}

      <div className="access-form-section">
        <div className="access-form-section-heading">
          <span>1</span>
          <div>
            <strong>Datos del usuario</strong>
            <small>Información utilizada para identificar e iniciar sesión.</small>
          </div>
        </div>

        <label>
          <span>Usuario</span>
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
            <span>Nombre</span>
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
            <span>Apellido</span>
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

        <label>
          <span>Contraseña inicial</span>
          <input
            type="password"
            name="password"
            value={userForm.password}
            onChange={onFieldChange}
            minLength={8}
            maxLength={72}
            required
          />
          <small>Debe contener al menos 8 caracteres.</small>
        </label>
      </div>

      <div className="access-form-section">
        <div className="access-form-section-heading">
          <span>2</span>
          <div>
            <strong>Acceso inicial</strong>
            <small>Define el rol y, cuando corresponda, sus permisos.</small>
          </div>
        </div>

        <label>
          <span>Rol</span>
          <select value={userForm.roleId} onChange={onRoleChange} required>
            <option value="">Selecciona un rol</option>
            {roles.map((role) => (
              <option value={role.id} key={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <RoleAccessExplanation roleName={selectedRoleName} />

        {isAdmin && selectedRoleName === 'MANAGER' && (
          <PermissionSelector
            permissions={permissions}
            selectedIds={userForm.permissionIds}
            onToggle={onPermissionToggle}
          />
        )}
      </div>

      <div className="access-modal-actions">
        <button type="button" className="access-cancel-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="access-save-button" disabled={saving}>
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}

function RoleAccessExplanation({ roleName }) {
  if (!roleName) return null

  const explanations = {
    ADMIN: {
      title: 'Acceso administrativo total',
      detail: 'ADMIN utiliza bypass y no necesita permisos individuales.',
      tone: 'total',
    },
    MANAGER: {
      title: 'Acceso administrativo personalizado',
      detail: 'Selecciona individualmente los módulos que podrá gestionar.',
      tone: 'custom',
    },
    MESERO: {
      title: 'Acceso definido por rol',
      detail: 'Podrá utilizar el flujo operativo de órdenes para meseros.',
      tone: 'role',
    },
    COCINA: {
      title: 'Acceso definido por rol',
      detail: 'Podrá utilizar el módulo operativo de cocina.',
      tone: 'role',
    },
    CAJA: {
      title: 'Acceso definido por rol',
      detail: 'Podrá utilizar el módulo operativo de facturación y caja.',
      tone: 'role',
    },
  }

  const explanation = explanations[roleName] ?? {
    title: 'Acceso definido por rol',
    detail: 'El acceso dependerá del rol seleccionado.',
    tone: 'role',
  }

  return (
    <div className={`access-role-explanation is-${explanation.tone}`}>
      <strong>{explanation.title}</strong>
      <p>{explanation.detail}</p>
    </div>
  )
}

function PermissionSelector({ permissions, selectedIds, onToggle }) {
  return (
    <fieldset className="access-permission-fieldset">
      <legend>Permisos individuales del MANAGER</legend>
      <p>
        Marca únicamente los módulos administrativos que esta persona necesita.
      </p>

      {permissions.length > 0 ? (
        <div className="access-permission-grid">
          {permissions.map((permission) => (
            <label className="access-permission-option" key={permission.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(permission.id)}
                onChange={() => onToggle(permission.id)}
              />
              <span>
                <strong>{getPermissionLabel(permission.code)}</strong>
                <small>{permission.description || permission.code}</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="access-empty-state">
          No hay permisos disponibles para asignar.
        </div>
      )}
    </fieldset>
  )
}

function UserDetail({ user }) {
  const accessSummary = getAccessSummary(user)

  return (
    <div className="access-detail-grid">
      <div>
        <span>Nombre completo</span>
        <strong>{getFullName(user)}</strong>
      </div>
      <div>
        <span>Usuario</span>
        <strong>@{user.username}</strong>
      </div>
      <div>
        <span>Estado</span>
        <strong>{user.isActive ? 'Activo' : 'Inactivo'}</strong>
      </div>
      <div>
        <span>Fecha de creación</span>
        <strong>{formatDate(user.createdAt)}</strong>
      </div>
      <div className="access-detail-wide">
        <span>Roles</span>
        <div className="access-badges">
          {getRoleNames(user).map((roleName) => (
            <span key={roleName}>{roleName}</span>
          ))}
        </div>
      </div>
      <div className="access-detail-wide">
        <span>Nivel de acceso</span>
        <strong>{accessSummary.title}</strong>
        <small>{accessSummary.detail}</small>
      </div>
      {hasRoleName(user, 'MANAGER') && (
        <div className="access-detail-wide">
          <span>Permisos individuales</span>
          {Array.isArray(user.permissions) && user.permissions.length > 0 ? (
            <div className="access-detail-permissions">
              {user.permissions.map((permission) => (
                <span key={permission.id || permission.code}>
                  {getPermissionLabel(permission.code)}
                </span>
              ))}
            </div>
          ) : (
            <small>Este MANAGER no tiene permisos administrativos asignados.</small>
          )}
        </div>
      )}
    </div>
  )
}

function AccessModal({
  title,
  subtitle,
  onClose,
  saving,
  size = 'normal',
  children,
}) {
  return (
    <div className="access-modal-backdrop" role="presentation">
      <section
        className={`access-modal access-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-modal-title"
      >
        <header className="access-modal-header">
          <div>
            <h2 id="access-modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="access-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </header>
        <div className="access-modal-body">{children}</div>
      </section>
    </div>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15.5 7.5a4.5 4.5 0 1 1-1.32 3.18L21 17.5V21h-3.5v-2.5H15V16h-2.5l-1.18-1.18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="7.5" r="0.9" fill="currentColor" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 3l18 18M10.6 6.15A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a15.5 15.5 0 0 1-2.15 2.85M6.05 6.05C3.72 7.72 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.15-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      ? item.permissions.map((permission) => ({
          ...permission,
          id: String(permission.id),
        }))
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

function getRoleIds(item) {
  if (!Array.isArray(item?.roles)) return []
  return item.roles.map((role) => String(role.id))
}

function getRoleNames(item) {
  if (!Array.isArray(item?.roles)) return []
  return item.roles.map((role) => role.name).filter(Boolean)
}

function getPermissionIds(item) {
  if (!Array.isArray(item?.permissions)) return []
  return item.permissions.map((permission) => String(permission.id))
}

function hasRoleName(item, roleName) {
  const normalizedTarget = normalizeRoleName(roleName)
  return getRoleNames(item).some(
    (currentRole) => normalizeRoleName(currentRole) === normalizedTarget,
  )
}

function isAdministrativeUser(item) {
  return hasRoleName(item, 'ADMIN') || hasRoleName(item, 'MANAGER')
}

function isCurrentSessionUser(currentUser, listedUser) {
  return String(currentUser?.id ?? '') === String(listedUser?.id ?? '')
}

function getAccessSummary(item) {
  if (hasRoleName(item, 'ADMIN')) {
    return {
      title: 'Acceso total',
      detail: 'Bypass administrativo',
    }
  }

  if (hasRoleName(item, 'MANAGER')) {
    const totalPermissions = Array.isArray(item?.permissions)
      ? item.permissions.length
      : 0

    return {
      title: 'Acceso personalizado',
      detail:
        totalPermissions === 1
          ? '1 permiso administrativo'
          : `${totalPermissions} permisos administrativos`,
    }
  }

  return {
    title: 'Acceso por rol',
    detail: getRoleNames(item).join(', ') || 'Sin rol asignado',
  }
}

function getFullName(item) {
  const fullName = String(item?.fullName ?? '').trim()
  if (fullName) return fullName

  const calculatedName = `${item?.firstName ?? ''} ${item?.lastName ?? ''}`.trim()
  return calculatedName || item?.username || 'Usuario sin nombre'
}

function getInitials(item) {
  const firstName = String(item?.firstName ?? '').trim()
  const lastName = String(item?.lastName ?? '').trim()
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  return initials || String(item?.username ?? 'U').charAt(0).toUpperCase()
}

function normalizeRoleName(roleName) {
  return String(roleName ?? '').trim().toUpperCase()
}

function toggleId(ids, id) {
  const normalizedId = String(id)

  return ids.includes(normalizedId)
    ? ids.filter((currentId) => currentId !== normalizedId)
    : [...ids, normalizedId]
}

function getPermissionLabel(code) {
  const labels = {
    ADMIN_USERS_MANAGE: 'Usuarios y accesos',
    ADMIN_ORDERS_MANAGE: 'Órdenes',
    ADMIN_KITCHEN_MANAGE: 'Cocina / KDS',
    ADMIN_TABLES_MANAGE: 'Mesas',
    'ADMIN_SHIFTS_&_STATIONS_MANAGE': 'Turnos y estaciones',
    ADMIN_MENU_MANAGE: 'Menú del restaurante',
    ADMIN_LODGING_MANAGE: 'Hospedaje',
    ADMIN_BILLING_MANAGE: 'Facturación',
  }

  return labels[code] || code
}

function formatDate(dateValue) {
  if (!dateValue) return 'No disponible'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'No disponible'

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}
