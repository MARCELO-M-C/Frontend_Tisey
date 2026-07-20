import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { hasRole } from '../auth/authHelpers'
import { getOrdersRequest } from '../services/ordersService'
import { getStaysRequest } from '../services/lodgingService'
import {
  createInvoiceFromOrderRequest,
  createInvoiceFromStayRequest,
  createInvoicePaymentRequest,
  getInvoicesRequest,
  printInvoiceRequest,
  voidInvoiceRequest,
} from '../services/billingService'
import './BillingPage.css'

const workflowSteps = [
  'Seleccionar',
  'Revisar',
  'Emitir',
  'Pagar',
  'Finalizar',
]

const paymentMethods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'MIXED', label: 'Mixto' },
  { value: 'OTHER', label: 'Otro' },
]

function createInitialBillingForm() {
  return {
    sourceType: 'order',
    sourceId: '',
    includeRoomCharge: true,
    includeRestaurantCharges: true,
    taxRate: '0',
    notes: '',
  }
}

const initialExtraLine = {
  description: '',
  quantity: '1',
  unitPrice: '',
}

const initialPaymentForm = {
  method: 'CASH',
  amount: '',
  reference: '',
}

export default function BillingPage() {
  const { user, logout } = useAuth()

  const [mode, setMode] = useState('workflow')
  const [step, setStep] = useState(1)

  const [orders, setOrders] = useState([])
  const [stays, setStays] = useState([])
  const [invoices, setInvoices] = useState([])

  const [billingForm, setBillingForm] = useState(createInitialBillingForm)
  const [extraLine, setExtraLine] = useState(initialExtraLine)
  const [extraLines, setExtraLines] = useState([])
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm)
  const [currentInvoice, setCurrentInvoice] = useState(null)

  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState('all')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = hasRole(user, ['ADMIN', 'ADMINISTRADOR'])

  useEffect(() => {
    loadBillingData()
  }, [])

  const issuedOrderIds = useMemo(() => {
    return new Set(
      invoices
        .filter((invoice) => invoice.status === 'ISSUED' && invoice.order)
        .map((invoice) => String(invoice.order.id)),
    )
  }, [invoices])

  const invoicedOrderItemIds = useMemo(() => {
    return new Set(
      invoices
        .filter((invoice) => invoice.status === 'ISSUED')
        .flatMap((invoice) => invoice.lines ?? [])
        .filter((line) => line.orderItemId)
        .map((line) => String(line.orderItemId)),
    )
  }, [invoices])

  const issuedStayIds = useMemo(() => {
    return new Set(
      invoices
        .filter(
          (invoice) =>
            invoice.status === 'ISSUED' && invoice.stay && !invoice.order,
        )
        .map((invoice) => String(invoice.stay.id)),
    )
  }, [invoices])

  const billableOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        ['DELIVERED', 'CLOSED'].includes(order.status) &&
        !issuedOrderIds.has(String(order.id)) &&
        !(order.items ?? []).some((item) =>
          invoicedOrderItemIds.has(String(item.id)),
        ),
    )
  }, [orders, issuedOrderIds, invoicedOrderItemIds])

  const billableStays = useMemo(() => {
    return stays.filter(
      (stay) =>
        stay.status !== 'CANCELLED' &&
        !issuedStayIds.has(String(stay.id)),
    )
  }, [stays, issuedStayIds])

  const selectedOrder = useMemo(() => {
    return billableOrders.find(
      (order) => String(order.id) === String(billingForm.sourceId),
    )
  }, [billableOrders, billingForm.sourceId])

  const selectedStay = useMemo(() => {
    return billableStays.find(
      (stay) => String(stay.id) === String(billingForm.sourceId),
    )
  }, [billableStays, billingForm.sourceId])

  const selectedStayOrders = useMemo(() => {
    if (!selectedStay) return []

    return orders.filter(
      (order) =>
        String(order.stay?.id) === String(selectedStay.id) &&
        ['DELIVERED', 'CLOSED'].includes(order.status) &&
        !issuedOrderIds.has(String(order.id)) &&
        !(order.items ?? []).some((item) =>
          invoicedOrderItemIds.has(String(item.id)),
        ),
    )
  }, [
    orders,
    selectedStay,
    issuedOrderIds,
    invoicedOrderItemIds,
  ])

  const previewLines = useMemo(() => {
    const lines = []

    if (billingForm.sourceType === 'order' && selectedOrder) {
      for (const item of selectedOrder.items ?? []) {
        if (item.itemStatus === 'CANCELLED') continue

        lines.push({
          key: `order-${item.id}`,
          description: item.itemName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          source: 'Restaurante',
        })
      }
    }

    if (billingForm.sourceType === 'stay' && selectedStay) {
      if (billingForm.includeRoomCharge) {
        lines.push({
          key: `room-${selectedStay.id}`,
          description: `Hospedaje cabaña ${selectedStay.cabin?.cabinNumber}`,
          quantity: calculateNights(
            selectedStay.checkInDate,
            selectedStay.checkOutDate,
          ),
          unitPrice: Number(selectedStay.cabin?.basePricePerNight ?? 0),
          source: 'Hospedaje',
        })
      }

      if (billingForm.includeRestaurantCharges) {
        for (const order of selectedStayOrders) {
          for (const item of order.items ?? []) {
            if (item.itemStatus === 'CANCELLED') continue

            lines.push({
              key: `stay-order-${order.id}-${item.id}`,
              description: `${order.orderCode} - ${item.itemName}`,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              source: 'Restaurante',
            })
          }
        }
      }
    }

    for (const line of extraLines) {
      lines.push({
        key: line.localId,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        source: 'Extra',
      })
    }

    return lines
  }, [
    billingForm.sourceType,
    billingForm.includeRoomCharge,
    billingForm.includeRestaurantCharges,
    selectedOrder,
    selectedStay,
    selectedStayOrders,
    extraLines,
  ])

  const estimatedSubtotal = useMemo(() => {
    return previewLines.reduce(
      (total, line) => total + line.quantity * line.unitPrice,
      0,
    )
  }, [previewLines])

  const estimatedTax = useMemo(() => {
    const rate = Number(billingForm.taxRate)
    if (Number.isNaN(rate)) return 0
    return Number((estimatedSubtotal * rate / 100).toFixed(2))
  }, [estimatedSubtotal, billingForm.taxRate])

  const estimatedTotal = estimatedSubtotal + estimatedTax

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase()

    return invoices.filter((invoice) => {
      const sourceText = getInvoiceSourceText(invoice).toLowerCase()
      const code = String(invoice.invoiceCode ?? '').toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        code.includes(normalizedSearch) ||
        sourceText.includes(normalizedSearch)

      const matchesStatus =
        historyStatus === 'all' || invoice.status === historyStatus

      return matchesSearch && matchesStatus
    })
  }, [invoices, historySearch, historyStatus])

  const stats = useMemo(() => {
    return {
      pending: billableOrders.length + billableStays.length,
      issued: invoices.filter((invoice) => invoice.status === 'ISSUED').length,
      paid: invoices.filter(
        (invoice) => invoice.status === 'ISSUED' && invoice.isPaid,
      ).length,
      balance: invoices
        .filter((invoice) => invoice.status === 'ISSUED')
        .reduce((total, invoice) => total + Number(invoice.balanceDue), 0),
    }
  }, [billableOrders, billableStays, invoices])

  async function loadBillingData(showLoader = true) {
    try {
      if (showLoader) setLoading(true)
      setError('')

      const [ordersPayload, staysPayload, invoicesPayload] = await Promise.all([
        getOrdersRequest(),
        getStaysRequest(),
        getInvoicesRequest(),
      ])

      setOrders(normalizeList(ordersPayload, 'orders'))
      setStays(normalizeList(staysPayload, 'stays'))
      setInvoices(normalizeList(invoicesPayload, 'invoices'))
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cargar la información de caja.',
        ),
      )
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function handleModeChange(nextMode) {
    clearMessages()
    setMode(nextMode)
  }

  function handleSourceTypeChange(sourceType) {
    clearMessages()

    setBillingForm((current) => ({
      ...current,
      sourceType,
      sourceId: '',
    }))

    setStep(1)
  }

  function handleSelectSource(sourceId) {
    clearMessages()

    setBillingForm((current) => ({
      ...current,
      sourceId: String(sourceId),
    }))

    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBillingFieldChange(event) {
    const { name, value, type, checked } = event.target

    setBillingForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleExtraLineChange(event) {
    const { name, value } = event.target

    setExtraLine((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handlePaymentFieldChange(event) {
    const { name, value } = event.target

    setPaymentForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function addExtraLine() {
    clearMessages()

    const description = extraLine.description.trim()
    const quantity = Number(extraLine.quantity)
    const unitPrice = extraLine.unitPrice.trim()

    if (!description) {
      setError('La descripción del cargo adicional es obligatoria.')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setError('La cantidad debe ser un entero entre 1 y 999.')
      return
    }

    if (!/^\d+(\.\d{1,2})?$/.test(unitPrice) || Number(unitPrice) <= 0) {
      setError('El precio adicional debe ser mayor a cero.')
      return
    }

    setExtraLines((current) => [
      ...current,
      {
        localId: `${Date.now()}-${Math.random()}`,
        description,
        quantity,
        unitPrice,
      },
    ])

    setExtraLine(initialExtraLine)
  }

  function removeExtraLine(localId) {
    setExtraLines((current) =>
      current.filter((line) => line.localId !== localId),
    )
  }

  async function handleCreateInvoice() {
    clearMessages()

    const taxRate = billingForm.taxRate.trim()
    const normalizedTaxRate = Number(taxRate)

    if (!billingForm.sourceId) {
      setError('Selecciona una orden o estadía para facturar.')
      return
    }

    if (
      !/^\d+(\.\d{1,2})?$/.test(taxRate) ||
      normalizedTaxRate < 0 ||
      normalizedTaxRate > 100
    ) {
      setError('El porcentaje de impuesto debe estar entre 0 y 100.')
      return
    }

    if (billingForm.sourceType === 'stay') {
      const hasSelectedCharges =
        billingForm.includeRoomCharge ||
        billingForm.includeRestaurantCharges ||
        extraLines.length > 0

      if (!hasSelectedCharges) {
        setError('Selecciona al menos un cargo para la factura.')
        return
      }
    }

    const sharedPayload = {
      taxRate,
      notes: billingForm.notes.trim() || null,
      extraLines: extraLines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice,
      })),
    }

    try {
      setSaving(true)

      const invoice =
        billingForm.sourceType === 'order'
          ? await createInvoiceFromOrderRequest({
              ...sharedPayload,
              orderId: Number(billingForm.sourceId),
            })
          : await createInvoiceFromStayRequest({
              ...sharedPayload,
              stayId: Number(billingForm.sourceId),
              includeRoomCharge: billingForm.includeRoomCharge,
              includeRestaurantCharges:
                billingForm.includeRestaurantCharges,
            })

      setCurrentInvoice(invoice)
      setInvoices((current) => [invoice, ...current])
      setPaymentForm({
        ...initialPaymentForm,
        amount: invoice.balanceDue,
      })
      setStep(3)
      setSuccess('Factura emitida correctamente.')

      await loadBillingData(false)
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'No se pudo emitir la factura.'),
      )
    } finally {
      setSaving(false)
    }
  }

  function continueToPayment() {
    if (!currentInvoice) return

    setPaymentForm((current) => ({
      ...current,
      amount: currentInvoice.balanceDue,
    }))
    setStep(currentInvoice.isPaid ? 5 : 4)
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault()
    clearMessages()

    if (!currentInvoice) {
      setError('No hay una factura seleccionada.')
      return
    }

    const amount = paymentForm.amount.trim()
    const amountNumber = Number(amount)
    const balanceNumber = Number(currentInvoice.balanceDue)

    if (!/^\d+(\.\d{1,2})?$/.test(amount) || amountNumber <= 0) {
      setError('El monto del pago debe ser mayor a cero.')
      return
    }

    if (amountNumber > balanceNumber) {
      setError('El pago no puede superar el saldo pendiente.')
      return
    }

    try {
      setSaving(true)

      const updatedInvoice = await createInvoicePaymentRequest(
        currentInvoice.id,
        {
          method: paymentForm.method,
          amount,
          reference: paymentForm.reference.trim() || null,
        },
      )

      updateInvoiceInState(updatedInvoice)
      setCurrentInvoice(updatedInvoice)
      setPaymentForm({
        ...initialPaymentForm,
        amount: updatedInvoice.balanceDue,
      })

      if (updatedInvoice.isPaid) {
        setStep(5)
        setSuccess('Factura pagada completamente.')
      } else {
        setSuccess('Pago parcial registrado correctamente.')
      }
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'No se pudo registrar el pago.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handlePrintInvoice(invoice = currentInvoice) {
    clearMessages()

    if (!invoice) return

    try {
      setSaving(true)

      const updatedInvoice = await printInvoiceRequest(invoice.id)

      updateInvoiceInState(updatedInvoice)
      setCurrentInvoice(updatedInvoice)
      setMode('workflow')
      setStep(updatedInvoice.isPaid ? 5 : 4)
      setSuccess('Impresión registrada correctamente.')

      window.setTimeout(() => {
        window.print()
      }, 150)
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'No se pudo registrar la impresión.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleVoidInvoice(invoice = currentInvoice) {
    clearMessages()

    if (!invoice) return

    const reason = window.prompt(
      `Indica el motivo para anular ${invoice.invoiceCode}:`,
    )

    if (reason === null) return

    const normalizedReason = reason.trim()

    if (!normalizedReason) {
      setError('Debes indicar un motivo de anulación.')
      return
    }

    if (normalizedReason.length > 255) {
      setError('El motivo no puede superar 255 caracteres.')
      return
    }

    try {
      setSaving(true)

      const updatedInvoice = await voidInvoiceRequest(invoice.id, {
        reason: normalizedReason,
      })

      updateInvoiceInState(updatedInvoice)

      if (String(currentInvoice?.id) === String(invoice.id)) {
        setCurrentInvoice(updatedInvoice)
        setStep(5)
      }

      setSuccess('Factura anulada correctamente.')
      await loadBillingData(false)
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'No se pudo anular la factura.'),
      )
    } finally {
      setSaving(false)
    }
  }

  function openInvoice(invoice) {
    clearMessages()
    setCurrentInvoice(invoice)
    setMode('workflow')
    setPaymentForm({
      ...initialPaymentForm,
      amount: invoice.balanceDue,
    })

    if (invoice.status === 'VOID' || invoice.isPaid) {
      setStep(5)
    } else {
      setStep(4)
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startNewCharge() {
    clearMessages()
    setBillingForm(createInitialBillingForm())
    setExtraLine(initialExtraLine)
    setExtraLines([])
    setPaymentForm(initialPaymentForm)
    setCurrentInvoice(null)
    setMode('workflow')
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateInvoiceInState(updatedInvoice) {
    setInvoices((current) =>
      current.map((invoice) =>
        String(invoice.id) === String(updatedInvoice.id)
          ? updatedInvoice
          : invoice,
      ),
    )
  }

  return (
    <main
      className={`billing-page ${
        isAdmin ? 'billing-admin-view' : 'billing-cashier-view'
      }`}
    >
      <header className="billing-header">
        <div>
          <span className="billing-eyebrow">
            {isAdmin ? 'Facturación administrativa' : 'Caja'}
          </span>

          <h1>Facturación y Caja</h1>

          <p>
            Selecciona el consumo, emite la factura, registra el pago y
            finaliza el cobro.
          </p>

          <small>
            Sesión: {user?.fullName || user?.username || 'Usuario de caja'}
          </small>
        </div>

        <div className="billing-header-actions">
          {isAdmin && (
            <Link to="/dashboard" className="billing-secondary-button">
              Volver al dashboard
            </Link>
          )}

          <button
            type="button"
            className="billing-logout-button"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="billing-topbar">
        <div className="billing-mode-tabs">
          <button
            type="button"
            className={mode === 'workflow' ? 'is-active' : ''}
            onClick={() => handleModeChange('workflow')}
          >
            Cobrar
          </button>

          <button
            type="button"
            className={mode === 'history' ? 'is-active' : ''}
            onClick={() => handleModeChange('history')}
          >
            Historial
          </button>
        </div>

        <button
          type="button"
          className="billing-refresh-button"
          onClick={() => loadBillingData()}
          disabled={loading || saving}
        >
          Actualizar
        </button>
      </section>

      {error && (
        <section className="billing-alert billing-alert-error">
          {error}
        </section>
      )}

      {success && (
        <section className="billing-alert billing-alert-success">
          {success}
        </section>
      )}

      <section className="billing-stats-grid">
        <article>
          <span>Pendientes</span>
          <strong>{loading ? '...' : stats.pending}</strong>
          <small>Órdenes y estadías disponibles</small>
        </article>

        <article>
          <span>Facturas activas</span>
          <strong>{loading ? '...' : stats.issued}</strong>
          <small>Emitidas y no anuladas</small>
        </article>

        <article>
          <span>Pagadas</span>
          <strong>{loading ? '...' : stats.paid}</strong>
          <small>Saldo completado</small>
        </article>

        <article>
          <span>Saldo pendiente</span>
          <strong>{loading ? '...' : formatMoney(stats.balance)}</strong>
          <small>Por cobrar</small>
        </article>
      </section>

      {mode === 'workflow' ? (
        <>
          <section className="billing-progress-card">
            {workflowSteps.map((label, index) => {
              const stepNumber = index + 1

              return (
                <div
                  className={`billing-progress-step ${
                    stepNumber === step ? 'is-current' : ''
                  } ${stepNumber < step ? 'is-complete' : ''}`}
                  key={label}
                >
                  <span>{stepNumber}</span>
                  <small>{label}</small>
                </div>
              )
            })}
          </section>

          {step === 1 && (
            <section className="billing-workflow-card">
              <div className="billing-section-header">
                <div>
                  <h2>1. Selecciona qué deseas cobrar</h2>
                  <p>
                    Solo se muestran órdenes entregadas o cerradas y estadías
                    sin factura activa.
                  </p>
                </div>
              </div>

              <div className="billing-source-switch">
                <button
                  type="button"
                  className={
                    billingForm.sourceType === 'order' ? 'is-active' : ''
                  }
                  onClick={() => handleSourceTypeChange('order')}
                >
                  Órdenes del restaurante
                </button>

                <button
                  type="button"
                  className={
                    billingForm.sourceType === 'stay' ? 'is-active' : ''
                  }
                  onClick={() => handleSourceTypeChange('stay')}
                >
                  Estadías
                </button>
              </div>

              {loading ? (
                <div className="billing-empty-state">
                  Cargando pendientes de cobro...
                </div>
              ) : billingForm.sourceType === 'order' ? (
                billableOrders.length > 0 ? (
                  <div className="billing-source-grid">
                    {billableOrders.map((order) => (
                      <button
                        type="button"
                        className="billing-source-card"
                        key={order.id}
                        onClick={() => handleSelectSource(order.id)}
                      >
                        <span>{order.orderCode}</span>
                        <strong>{getOrderContext(order)}</strong>
                        <p>
                          {order.summary?.totalQuantity ?? 0} producto(s)
                          {' · '}
                          {formatMoney(order.summary?.subtotal ?? 0)}
                        </p>
                        <small>{getOrderChannelLabel(order.channel)}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="billing-empty-state">
                    No hay órdenes listas para facturar.
                  </div>
                )
              ) : billableStays.length > 0 ? (
                <div className="billing-source-grid">
                  {billableStays.map((stay) => (
                    <button
                      type="button"
                      className="billing-source-card"
                      key={stay.id}
                      onClick={() => handleSelectSource(stay.id)}
                    >
                      <span>Cabaña {stay.cabin?.cabinNumber}</span>
                      <strong>
                        {stay.primaryGuest?.fullName || 'Sin huésped principal'}
                      </strong>
                      <p>
                        {formatDateOnly(stay.checkInDate)}
                        {' → '}
                        {formatDateOnly(stay.checkOutDate)}
                      </p>
                      <small>{getStayStatusLabel(stay.status)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="billing-empty-state">
                  No hay estadías disponibles para facturar.
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="billing-review-grid">
              <article className="billing-workflow-card">
                <div className="billing-section-header">
                  <div>
                    <h2>2. Revisa los cargos</h2>
                    <p>
                      Confirma el consumo y configura los datos de la factura.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="billing-text-button"
                    onClick={() => setStep(1)}
                  >
                    Cambiar selección
                  </button>
                </div>

                <div className="billing-source-summary">
                  <span>
                    {billingForm.sourceType === 'order'
                      ? selectedOrder?.orderCode
                      : `Cabaña ${selectedStay?.cabin?.cabinNumber}`}
                  </span>

                  <strong>
                    {billingForm.sourceType === 'order'
                      ? getOrderContext(selectedOrder)
                      : selectedStay?.primaryGuest?.fullName}
                  </strong>
                </div>

                {billingForm.sourceType === 'stay' && (
                  <div className="billing-check-options">
                    <label>
                      <input
                        type="checkbox"
                        name="includeRoomCharge"
                        checked={billingForm.includeRoomCharge}
                        onChange={handleBillingFieldChange}
                      />
                      <span>
                        Incluir hospedaje
                        <small>
                          {calculateNights(
                            selectedStay?.checkInDate,
                            selectedStay?.checkOutDate,
                          )}{' '}
                          noche(s)
                        </small>
                      </span>
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        name="includeRestaurantCharges"
                        checked={billingForm.includeRestaurantCharges}
                        onChange={handleBillingFieldChange}
                      />
                      <span>
                        Incluir consumos del restaurante
                        <small>
                          {selectedStayOrders.length} orden(es) facturable(s)
                        </small>
                      </span>
                    </label>
                  </div>
                )}

                <div className="billing-lines-list">
                  {previewLines.length > 0 ? (
                    previewLines.map((line) => (
                      <div key={line.key}>
                        <div>
                          <strong>{line.description}</strong>
                          <small>{line.source}</small>
                        </div>

                        <span>
                          {line.quantity} × {formatMoney(line.unitPrice)}
                        </span>

                        <strong>
                          {formatMoney(line.quantity * line.unitPrice)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <div className="billing-empty-state">
                      La configuración actual no genera cargos.
                    </div>
                  )}
                </div>
              </article>

              <aside className="billing-review-sidebar">
                <section className="billing-workflow-card">
                  <div className="billing-section-header">
                    <div>
                      <h2>Cargo adicional</h2>
                      <p>Agrega transporte, daños u otro concepto.</p>
                    </div>
                  </div>

                  <div className="billing-form">
                    <label>
                      Descripción
                      <input
                        type="text"
                        name="description"
                        value={extraLine.description}
                        onChange={handleExtraLineChange}
                        maxLength={160}
                      />
                    </label>

                    <div className="billing-form-grid">
                      <label>
                        Cantidad
                        <input
                          type="number"
                          name="quantity"
                          value={extraLine.quantity}
                          onChange={handleExtraLineChange}
                          min="1"
                          max="999"
                        />
                      </label>

                      <label>
                        Precio
                        <input
                          type="text"
                          name="unitPrice"
                          value={extraLine.unitPrice}
                          onChange={handleExtraLineChange}
                          placeholder="0.00"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="billing-add-button"
                      onClick={addExtraLine}
                    >
                      Agregar cargo
                    </button>
                  </div>

                  {extraLines.length > 0 && (
                    <div className="billing-extra-lines">
                      {extraLines.map((line) => (
                        <div key={line.localId}>
                          <span>
                            {line.quantity} × {line.description}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeExtraLine(line.localId)}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="billing-workflow-card">
                  <div className="billing-form">
                    <label>
                      Impuesto (%)
                      <input
                        type="text"
                        name="taxRate"
                        value={billingForm.taxRate}
                        onChange={handleBillingFieldChange}
                      />
                    </label>

                    <label>
                      Notas
                      <textarea
                        name="notes"
                        value={billingForm.notes}
                        onChange={handleBillingFieldChange}
                        rows={3}
                        maxLength={255}
                      />
                    </label>
                  </div>

                  <div className="billing-total-box">
                    <div>
                      <span>Subtotal estimado</span>
                      <strong>{formatMoney(estimatedSubtotal)}</strong>
                    </div>

                    <div>
                      <span>Impuesto</span>
                      <strong>{formatMoney(estimatedTax)}</strong>
                    </div>

                    <div className="billing-grand-total">
                      <span>Total estimado</span>
                      <strong>{formatMoney(estimatedTotal)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="billing-primary-button"
                    onClick={handleCreateInvoice}
                    disabled={saving || previewLines.length === 0}
                  >
                    {saving ? 'Emitiendo...' : 'Emitir factura'}
                  </button>
                </section>
              </aside>
            </section>
          )}

          {step === 3 && currentInvoice && (
            <section className="billing-workflow-card billing-confirmation-card">
              <span className="billing-success-icon">✓</span>
              <h2>3. Factura emitida</h2>
              <p>
                Se creó la factura <strong>{currentInvoice.invoiceCode}</strong>{' '}
                por {formatMoney(currentInvoice.total)}.
              </p>

              <button
                type="button"
                className="billing-primary-button"
                onClick={continueToPayment}
              >
                Continuar al pago
              </button>
            </section>
          )}

          {step === 4 && currentInvoice && (
            <section className="billing-payment-grid">
              <InvoiceReceipt invoice={currentInvoice} />

              <article className="billing-workflow-card">
                <div className="billing-section-header">
                  <div>
                    <h2>4. Registrar pago</h2>
                    <p>
                      Puedes registrar el pago completo o abonos parciales.
                    </p>
                  </div>
                </div>

                <div className="billing-balance-box">
                  <span>Saldo pendiente</span>
                  <strong>{formatMoney(currentInvoice.balanceDue)}</strong>
                </div>

                <form className="billing-form" onSubmit={handlePaymentSubmit}>
                  <label>
                    Método de pago
                    <select
                      name="method"
                      value={paymentForm.method}
                      onChange={handlePaymentFieldChange}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Monto
                    <input
                      type="text"
                      name="amount"
                      value={paymentForm.amount}
                      onChange={handlePaymentFieldChange}
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label>
                    Referencia
                    <input
                      type="text"
                      name="reference"
                      value={paymentForm.reference}
                      onChange={handlePaymentFieldChange}
                      placeholder="Voucher, transferencia u observación"
                      maxLength={80}
                    />
                  </label>

                  <button
                    type="submit"
                    className="billing-primary-button"
                    disabled={saving}
                  >
                    {saving ? 'Registrando...' : 'Registrar pago'}
                  </button>
                </form>

                {Number(currentInvoice.amountPaid) === 0 && (
                  <button
                    type="button"
                    className="billing-danger-button"
                    onClick={() => handleVoidInvoice(currentInvoice)}
                    disabled={saving}
                  >
                    Anular factura
                  </button>
                )}
              </article>
            </section>
          )}

          {step === 5 && currentInvoice && (
            <section className="billing-final-grid">
              <InvoiceReceipt invoice={currentInvoice} />

              <article className="billing-workflow-card billing-final-card">
                <span
                  className={`billing-final-icon ${
                    currentInvoice.status === 'VOID' ? 'is-void' : ''
                  }`}
                >
                  {currentInvoice.status === 'VOID' ? '×' : '✓'}
                </span>

                <h2>
                  {currentInvoice.status === 'VOID'
                    ? 'Factura anulada'
                    : currentInvoice.isPaid
                      ? 'Cobro completado'
                      : 'Factura con saldo pendiente'}
                </h2>

                <p>
                  {currentInvoice.invoiceCode}
                  {' · '}
                  Saldo: {formatMoney(currentInvoice.balanceDue)}
                </p>

                <div className="billing-final-actions">
                  {currentInvoice.status === 'ISSUED' && (
                    <button
                      type="button"
                      className="billing-primary-button"
                      onClick={() => handlePrintInvoice(currentInvoice)}
                      disabled={saving}
                    >
                      Imprimir comprobante
                    </button>
                  )}

                  {!currentInvoice.isPaid &&
                    currentInvoice.status === 'ISSUED' && (
                      <button
                        type="button"
                        className="billing-secondary-action"
                        onClick={() => setStep(4)}
                      >
                        Registrar otro pago
                      </button>
                    )}

                  <button
                    type="button"
                    className="billing-secondary-action"
                    onClick={startNewCharge}
                  >
                    Nuevo cobro
                  </button>
                </div>
              </article>
            </section>
          )}
        </>
      ) : (
        <section className="billing-history-card">
          <div className="billing-section-header">
            <div>
              <h2>Historial de facturas</h2>
              <p>Consulta pagos, saldos, impresiones y anulaciones.</p>
            </div>
          </div>

          <div className="billing-history-filters">
            <label>
              Buscar
              <input
                type="search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Código, orden, huésped o cabaña"
              />
            </label>

            <label>
              Estado
              <select
                value={historyStatus}
                onChange={(event) => setHistoryStatus(event.target.value)}
              >
                <option value="all">Todas</option>
                <option value="ISSUED">Emitidas</option>
                <option value="VOID">Anuladas</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="billing-empty-state">Cargando facturas...</div>
          ) : filteredInvoices.length > 0 ? (
            <div className="billing-history-list">
              {filteredInvoices.map((invoice) => (
                <article key={invoice.id}>
                  <div>
                    <strong>{invoice.invoiceCode}</strong>
                    <p>{getInvoiceSourceText(invoice)}</p>
                    <small>{formatDateTime(invoice.issuedAt)}</small>
                  </div>

                  <div className="billing-history-amounts">
                    <span>Total: {formatMoney(invoice.total)}</span>
                    <strong>Saldo: {formatMoney(invoice.balanceDue)}</strong>
                  </div>

                  <div className="billing-history-badges">
                    <span
                      className={
                        invoice.status === 'VOID'
                          ? 'is-void'
                          : invoice.isPaid
                            ? 'is-paid'
                            : 'is-pending'
                      }
                    >
                      {invoice.status === 'VOID'
                        ? 'Anulada'
                        : invoice.isPaid
                          ? 'Pagada'
                          : 'Pendiente'}
                    </span>

                    <small>{invoice.printCount} impresión(es)</small>
                  </div>

                  <div className="billing-history-actions">
                    <button
                      type="button"
                      onClick={() => openInvoice(invoice)}
                    >
                      Ver factura
                    </button>

                    {invoice.status === 'ISSUED' && (
                      <button
                        type="button"
                        onClick={() => handlePrintInvoice(invoice)}
                        disabled={saving}
                      >
                        Imprimir
                      </button>
                    )}

                    {invoice.status === 'ISSUED' &&
                      Number(invoice.amountPaid) === 0 && (
                        <button
                          type="button"
                          className="danger-action"
                          onClick={() => handleVoidInvoice(invoice)}
                          disabled={saving}
                        >
                          Anular
                        </button>
                      )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="billing-empty-state">
              No hay facturas que coincidan con los filtros.
            </div>
          )}
        </section>
      )}
    </main>
  )
}

function InvoiceReceipt({ invoice }) {
  return (
    <article className="billing-receipt billing-print-area">
      <header>
        <div>
          <span>EcoPosada Tisey</span>
          <h2>{invoice.invoiceCode}</h2>
        </div>

        <strong className={invoice.status === 'VOID' ? 'is-void' : ''}>
          {invoice.status === 'VOID'
            ? 'ANULADA'
            : invoice.isPaid
              ? 'PAGADA'
              : 'EMITIDA'}
        </strong>
      </header>

      <section className="billing-receipt-meta">
        <p>
          <span>Fecha</span>
          <strong>{formatDateTime(invoice.issuedAt)}</strong>
        </p>

        <p>
          <span>Origen</span>
          <strong>{getInvoiceSourceText(invoice)}</strong>
        </p>

        <p>
          <span>Emitida por</span>
          <strong>{invoice.issuedByUser?.fullName}</strong>
        </p>
      </section>

      <section className="billing-receipt-lines">
        {(invoice.lines ?? []).map((line) => (
          <div key={line.id}>
            <div>
              <strong>{line.description}</strong>
              <small>{getLineSourceLabel(line.source)}</small>
            </div>

            <span>
              {line.quantity} × {formatMoney(line.unitPrice)}
            </span>

            <strong>{formatMoney(line.lineTotal)}</strong>
          </div>
        ))}
      </section>

      <section className="billing-receipt-totals">
        <p>
          <span>Subtotal</span>
          <strong>{formatMoney(invoice.subtotal)}</strong>
        </p>

        <p>
          <span>Impuesto</span>
          <strong>{formatMoney(invoice.tax)}</strong>
        </p>

        <p className="is-total">
          <span>Total</span>
          <strong>{formatMoney(invoice.total)}</strong>
        </p>

        <p>
          <span>Pagado</span>
          <strong>{formatMoney(invoice.amountPaid)}</strong>
        </p>

        <p>
          <span>Saldo</span>
          <strong>{formatMoney(invoice.balanceDue)}</strong>
        </p>
      </section>

      {(invoice.payments ?? []).length > 0 && (
        <section className="billing-receipt-payments">
          <h3>Pagos</h3>

          {invoice.payments.map((payment) => (
            <p key={payment.id}>
              <span>
                {getPaymentMethodLabel(payment.method)}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </span>

              <strong>{formatMoney(payment.amount)}</strong>
            </p>
          ))}
        </section>
      )}

      {invoice.notes && <footer>{invoice.notes}</footer>}
    </article>
  )
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function getOrderContext(order) {
  if (!order) return 'Orden sin contexto'

  if (order.table) {
    return `Mesa ${order.table.code}`
  }

  if (order.stay) {
    return `Cabaña ${order.stay.cabin?.cabinNumber} · ${
      order.stay.primaryGuest?.fullName
    }`
  }

  return 'Para llevar'
}

function getOrderChannelLabel(channel) {
  const labels = {
    DINE_IN: 'Servicio en mesa',
    TAKE_AWAY: 'Para llevar',
    ROOM_CHARGE: 'Cargo a habitación',
  }

  return labels[channel] || channel
}

function getStayStatusLabel(status) {
  const labels = {
    BOOKED: 'Reservada',
    CHECKED_IN: 'Hospedada',
    CHECKED_OUT: 'Finalizada',
    CANCELLED: 'Cancelada',
  }

  return labels[status] || status
}

function getInvoiceSourceText(invoice) {
  if (invoice.order) {
    return `Orden ${invoice.order.orderCode}`
  }

  if (invoice.stay) {
    return `Cabaña ${invoice.stay.cabin?.cabinNumber} · ${
      invoice.stay.primaryGuest?.fullName
    }`
  }

  return 'Factura sin origen'
}

function getLineSourceLabel(source) {
  const labels = {
    RESTAURANT: 'Restaurante',
    ROOM: 'Hospedaje',
    EXTRA: 'Cargo adicional',
  }

  return labels[source] || source
}

function getPaymentMethodLabel(method) {
  return (
    paymentMethods.find((current) => current.value === method)?.label || method
  )
}

function calculateNights(checkInDate, checkOutDate) {
  if (!checkInDate || !checkOutDate) return 0

  const start = new Date(checkInDate)
  const end = new Date(checkOutDate)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return 0
  }

  return Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
  )
}

function formatMoney(value) {
  const amount = Number(value)

  if (Number.isNaN(amount)) return `C$ ${value}`

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
  }).format(amount)
}

function formatDateOnly(value) {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

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
