import { request } from './client.ts';
import { Invoice, BillingSettings, Order, BillingAuditLog, PaymentMethod } from '../types/index.ts';

export class BillingApi {
  /**
   * Customer Action: "Done / Request Bill"
   */
  public static async requestBill(orderId: string): Promise<{ success: boolean; order: Order; message: string }> {
    return request<{ success: boolean; order: Order; message: string }>(`/orders/${orderId}/request-bill`, {
      method: 'POST'
    });
  }

  /**
   * Staff Action: "Proceed to Billing" -> Generate / Retrieve Invoice
   */
  public static async generateInvoice(orderId: string): Promise<{ success: boolean; invoice: Invoice; isReprint?: boolean; message: string }> {
    return request<{ success: boolean; invoice: Invoice; isReprint?: boolean; message: string }>(`/billing/generate/${orderId}`, {
      method: 'POST'
    });
  }

  /**
   * Get Invoice by ID or Order ID
   */
  public static async getInvoice(id: string): Promise<Invoice> {
    const res = await request<Invoice>(`/billing/invoice/${id}`);
    return res;
  }

  /**
   * Public Secure Token Lookup for Invoice View
   */
  public static async getPublicInvoice(token: string): Promise<Invoice> {
    const res = await request<Invoice>(`/billing/public/${token}`);
    return res;
  }

  /**
   * Staff Action: Collect Payment & Mark Paid
   */
  public static async payInvoice(
    invoiceId: string,
    paymentMethod: PaymentMethod,
    paymentDetails?: { reference?: string; notes?: string }
  ): Promise<{ success: boolean; invoice: Invoice; order: Order; message: string }> {
    return request<{ success: boolean; invoice: Invoice; order: Order; message: string }>(`/billing/invoice/${invoiceId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, ...paymentDetails })
    });
  }

  /**
   * Void / Cancel Invoice
   */
  public static async voidInvoice(
    invoiceId: string,
    reason: string
  ): Promise<{ success: boolean; invoice: Invoice; message: string }> {
    return request<{ success: boolean; invoice: Invoice; message: string }>(`/billing/invoice/${invoiceId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  /**
   * Staff Dashboard: Get Pending Billing Requests
   */
  public static async getBillingRequests(): Promise<Order[]> {
    return request<Order[]>('/billing/requests');
  }

  /**
   * Staff/Admin: Get Billing History (Invoices)
   */
  public static async getBillingHistory(): Promise<Invoice[]> {
    return request<Invoice[]>('/billing/history');
  }

  /**
   * Admin: Get Billing & Hotel Settings
   */
  public static async getSettings(): Promise<BillingSettings> {
    return request<BillingSettings>('/billing/settings');
  }

  /**
   * Admin: Update Billing & Hotel Settings
   */
  public static async updateSettings(settings: Partial<BillingSettings>): Promise<BillingSettings> {
    return request<BillingSettings>('/billing/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  /**
   * Admin: Get Billing Sales Reports
   */
  public static async getReports(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<any>(`/billing/reports${queryString}`);
  }

  /**
   * Billing Audit Trail
   */
  public static async getAuditLogs(orderId?: string, invoiceId?: string): Promise<BillingAuditLog[]> {
    const query = new URLSearchParams();
    if (orderId) query.append('orderId', orderId);
    if (invoiceId) query.append('invoiceId', invoiceId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<BillingAuditLog[]>(`/billing/audits${queryString}`);
  }
}
