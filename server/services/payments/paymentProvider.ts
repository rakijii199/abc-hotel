/**
 * PaymentProvider Interface
 * Provider-agnostic payment gateway abstraction for ABC Hotel
 */
import { PaymentGatewayStatus, PaymentMethod } from '../../types/index.ts';

export interface CreatePaymentOrderParams {
  orderId: string;
  orderNumber: string;
  amountInRupees: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface CreatePaymentOrderResult {
  providerOrderId: string;
  amount: number; // in minor units (paise) for INR
  currency: string;
  keyId: string;
  environment: 'test' | 'production';
}

export interface VerifyPaymentParams {
  orderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  providerPaymentId: string;
  providerOrderId: string;
  status: PaymentGatewayStatus;
  method?: PaymentMethod;
  failureCode?: string;
  failureMessage?: string;
}

export interface RefundParams {
  providerPaymentId: string;
  amountInRupees?: number;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  providerPaymentId: string;
  amount: number;
  status: 'PROCESSED' | 'PENDING' | 'FAILED';
}

export interface PaymentProvider {
  name: string;
  createPaymentOrder(params: CreatePaymentOrderParams): Promise<CreatePaymentOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentVerificationResult>;
  refundPayment(params: RefundParams): Promise<RefundResult>;
  verifyWebhookSignature(bodyRaw: string, signatureHeader: string): boolean;
}
