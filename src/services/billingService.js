import api from '../api/axios'

export async function getInvoicesRequest(params = {}) {
  const { data } = await api.get('/invoices', { params })
  return data
}

export async function getInvoiceByIdRequest(invoiceId) {
  const { data } = await api.get(`/invoices/${invoiceId}`)
  return data
}

export async function createInvoiceFromOrderRequest(payload) {
  const { data } = await api.post('/invoices/from-order', payload)
  return data
}

export async function createInvoiceFromStayRequest(payload) {
  const { data } = await api.post('/invoices/from-stay', payload)
  return data
}

export async function voidInvoiceRequest(invoiceId, payload = {}) {
  const { data } = await api.patch(`/invoices/${invoiceId}/void`, payload)
  return data
}

export async function printInvoiceRequest(invoiceId) {
  const { data } = await api.patch(`/invoices/${invoiceId}/print`, {})
  return data
}

export async function getInvoicePaymentsRequest(invoiceId) {
  const { data } = await api.get(`/invoices/${invoiceId}/payments`)
  return data
}

export async function createInvoicePaymentRequest(invoiceId, payload) {
  const { data } = await api.post(`/invoices/${invoiceId}/payments`, payload)
  return data
}
