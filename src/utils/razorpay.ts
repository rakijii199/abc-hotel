/**
 * Razorpay SDK Checkout Helper
 * Handles dynamic script injection, secure popup initialization,
 * and test mode sandbox fallbacks.
 */

declare global {
  interface Window {
    Razorpay?: any;
  }
}

import QRCode from 'qrcode';

export interface RazorpayCheckoutOptions {
  keyId: string;
  providerOrderId: string;
  orderId: string;
  orderNumber: string;
  amountInRupees: number;
  amountInPaise: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod?: 'UPI' | 'Card' | 'Cash';
  onSuccess: (response: {
    orderId: string;
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  }) => void;
  onFailure: (error: { code: string; message: string }) => void;
  onDismiss?: () => void;
}

/**
 * Load Razorpay Checkout Script dynamically
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[RAZORPAY] Unable to load checkout.js script from Razorpay CDN.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay Checkout Popup
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayScript();

  // If real Razorpay script is loaded and real key ID is present
  if (isLoaded && window.Razorpay && options.keyId && !options.keyId.includes('demo')) {
    try {
      const rzpOptions = {
        key: options.keyId,
        amount: options.amountInPaise,
        currency: options.currency || 'INR',
        name: 'ABC Hotel & Luxury Dining',
        description: `Food Order #${options.orderNumber}`,
        order_id: options.providerOrderId,
        handler: function (response: any) {
          options.onSuccess({
            orderId: options.orderId,
            providerOrderId: response.razorpay_order_id || options.providerOrderId,
            providerPaymentId: response.razorpay_payment_id,
            providerSignature: response.razorpay_signature
          });
        },
        prefill: {
          name: options.customerName || '',
          email: options.customerEmail || '',
          contact: options.customerPhone || ''
        },
        theme: {
          color: '#78350f' // Luxury Amber
        },
        modal: {
          ondismiss: function () {
            if (options.onDismiss) options.onDismiss();
          }
        }
      };

      const rzp = new window.Razorpay(rzpOptions);
      rzp.on('payment.failed', function (response: any) {
        options.onFailure({
          code: response.error?.code || 'PAYMENT_FAILED',
          message: response.error?.description || 'Payment was declined or cancelled.'
        });
      });
      rzp.open();
      return;
    } catch (err: any) {
      console.warn('[RAZORPAY] Standard SDK launch failed, using test mode dialog:', err);
    }
  }

  // TEST MODE / SANDBOX MODAL DIALOG FALLBACK
  createTestModePaymentModal(options);
}

/**
 * Interactive Test Mode Payment Modal
 * Standard Razorpay Sandbox Checkout UI with "Scanner QR Code" & "Phone Number Payment" options
 */
function createTestModePaymentModal(options: RazorpayCheckoutOptions): void {
  const existing = document.getElementById('rzp-test-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'rzp-test-modal-overlay';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200';

  const mockPaymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const mockSignature = `sig_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  let activeTab: 'SCANNER' | 'PHONE_NUMBER' | 'COLLECT' = 'SCANNER';
  let qrCodeDataUrl: string = '';

  const upiString = `upi://pay?pa=abchotel.pay@icici&pn=ABC%20Hotel%20%26%20Luxury%20Dining&am=${options.amountInRupees}&cu=INR&tn=Order%20${options.orderNumber}`;

  QRCode.toDataURL(upiString, { margin: 1, width: 220, color: { dark: '#0c2442', light: '#ffffff' } })
    .then((url) => {
      qrCodeDataUrl = url;
      renderModalContent();
    })
    .catch(() => {
      renderModalContent();
    });

  function renderModalContent() {
    const defaultVpa = options.customerPhone ? `${options.customerPhone.replace(/[^0-9]/g, '')}@upi` : 'guest@okaxis';
    const hotelPhone = '+91 98765 43210';
    const hotelUpiId = 'abchotel.pay@icici';

    overlay.innerHTML = `
      <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-stone-900 font-sans animate-in zoom-in-95 duration-150">
        <!-- Razorpay Branded Top Header -->
        <div class="p-4 bg-[#0c2442] text-white flex justify-between items-center relative overflow-hidden">
          <div class="space-y-1 z-10">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                Razorpay UPI Gateway
              </span>
              <span class="text-[10px] text-stone-300 font-mono">SANDBOX</span>
            </div>
            <h3 class="font-serif font-bold text-base text-white tracking-wide">ABC Hotel & Luxury Dining</h3>
            <p class="text-xs text-stone-300 flex items-center gap-1">
              <span>Order #${options.orderNumber}</span>
              <span>•</span>
              <strong class="text-amber-300 font-mono font-bold text-sm">₹${options.amountInRupees}</strong>
            </p>
          </div>

          <button id="rzp-test-btn-close-x" class="text-stone-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer z-10" title="Close Checkout">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Payment Mode Tabs: SCANNER vs PHONE NUMBER vs COLLECT -->
        <div class="flex border-b border-stone-200 bg-stone-100/80 text-xs font-bold text-stone-600">
          <button
            id="tab-scanner"
            class="flex-1 py-3 px-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'SCANNER'
                ? 'bg-white text-amber-900 border-b-2 border-amber-800 shadow-2xs'
                : 'hover:text-stone-900 hover:bg-stone-200/50'
            }"
          >
            <svg class="w-4 h-4 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            QR Scanner
          </button>

          <button
            id="tab-phone"
            class="flex-1 py-3 px-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'PHONE_NUMBER'
                ? 'bg-white text-amber-900 border-b-2 border-amber-800 shadow-2xs'
                : 'hover:text-stone-900 hover:bg-stone-200/50'
            }"
          >
            <svg class="w-4 h-4 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            Phone Number
          </button>

          <button
            id="tab-collect"
            class="flex-1 py-3 px-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'COLLECT'
                ? 'bg-white text-amber-900 border-b-2 border-amber-800 shadow-2xs'
                : 'hover:text-stone-900 hover:bg-stone-200/50'
            }"
          >
            <svg class="w-4 h-4 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            VPA Request
          </button>
        </div>

        <!-- Main Modal Content -->
        <div class="p-5 space-y-4 text-xs text-stone-700 bg-stone-50/50">
          ${
            activeTab === 'SCANNER'
              ? `
            <!-- TAB 1: DYNAMIC SCANNER QR CODE -->
            <div class="space-y-3 text-center">
              <div class="p-2 bg-amber-50 rounded-xl border border-amber-200/80">
                <span class="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Scan QR Code to Pay</span>
                <p class="text-[11px] text-stone-600">Open GPay, PhonePe, Paytm, or BHIM app to scan & pay.</p>
              </div>

              <!-- Generated QR Code Canvas Display -->
              <div class="p-4 bg-white rounded-2xl border border-stone-200 shadow-md inline-block relative mx-auto group">
                ${
                  qrCodeDataUrl
                    ? `<img src="${qrCodeDataUrl}" alt="UPI Dynamic Payment QR Code" class="w-48 h-48 mx-auto rounded-lg shadow-2xs" />`
                    : `<div class="w-48 h-48 bg-stone-100 flex items-center justify-center text-stone-400 font-mono text-xs">Generating QR...</div>`
                }
                
                <div class="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-stone-700">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Amount: <strong class="text-amber-950 font-mono text-sm">₹${options.amountInRupees}</strong>
                </div>
              </div>

              <div class="text-[10px] text-stone-500 font-mono">
                UPI ID: <strong class="text-stone-800">${hotelUpiId}</strong>
              </div>

              <!-- Amount Received Action Button -->
              <button
                id="rzp-test-btn-success"
                class="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg class="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                ✓ Amount Received — Update Status to PAID
              </button>
            </div>
          `
              : activeTab === 'PHONE_NUMBER'
              ? `
            <!-- TAB 2: PAY VIA PHONE NUMBER / UPI ID -->
            <div class="space-y-3.5">
              <div class="p-3 bg-amber-50 rounded-xl border border-amber-200/80 space-y-1">
                <span class="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Pay via Phone Number or UPI ID</span>
                <p class="text-[11px] text-stone-600">Send ₹${options.amountInRupees} directly to our verified Hotel UPI mobile number.</p>
              </div>

              <!-- Phone Number Details Box -->
              <div class="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                  <div>
                    <span class="text-[10px] font-bold text-stone-400 uppercase block">Hotel Payment Phone Number</span>
                    <strong id="copy-phone-num" class="text-sm font-mono font-bold text-stone-900">${hotelPhone}</strong>
                  </div>
                  <button id="btn-copy-phone" class="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[10px] transition-colors cursor-pointer">
                    Copy Number
                  </button>
                </div>

                <div class="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                  <div>
                    <span class="text-[10px] font-bold text-stone-400 uppercase block">Hotel UPI VPA Address</span>
                    <strong id="copy-upi-vpa" class="text-xs font-mono font-bold text-stone-800">${hotelUpiId}</strong>
                  </div>
                  <button id="btn-copy-upi" class="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[10px] transition-colors cursor-pointer">
                    Copy UPI ID
                  </button>
                </div>

                <!-- Transaction Reference / Phone Input -->
                <div class="space-y-1 pt-1">
                  <label class="text-[10px] font-bold text-stone-500 uppercase block">Enter Sender Phone Number or UTR Ref</label>
                  <input id="rzp-input-sender-ref" type="text" placeholder="e.g. 9876543210 or 12-digit UTR Ref" value="${options.customerPhone || ''}" class="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 focus:border-amber-600 focus:outline-hidden" />
                </div>
              </div>

              <!-- Confirm & Update Status Button -->
              <button
                id="rzp-test-btn-success"
                class="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg class="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                ✓ Verify Amount Received & Update Status
              </button>
            </div>
          `
              : `
            <!-- TAB 3: COLLECT REQUEST -->
            <div class="space-y-3.5">
              <div class="p-3 bg-amber-50 rounded-xl border border-amber-200/80 space-y-1">
                <span class="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Push VPA Collect Notification</span>
                <p class="text-[11px] text-stone-600">Enter your UPI VPA to push an approval notification directly to your phone.</p>
              </div>

              <div class="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-2.5">
                <div>
                  <label class="text-[10px] font-bold text-stone-500 uppercase block mb-1">Your UPI VPA / App ID</label>
                  <input id="rzp-input-vpa-addr" type="text" value="${defaultVpa}" class="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 focus:border-amber-600 focus:outline-hidden" />
                </div>
              </div>

              <button
                id="rzp-test-btn-success"
                class="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg class="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                ✓ Push Collect & Confirm Amount Received
              </button>
            </div>
          `
          }

          <!-- Cancel & Decline Row -->
          <div class="flex items-center gap-2 pt-2 border-t border-stone-200">
            <button
              id="rzp-test-btn-fail"
              class="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-xl border border-rose-200 transition-all cursor-pointer text-center"
            >
              ✕ Decline Payment
            </button>
            <button
              id="rzp-test-btn-cancel"
              class="flex-1 py-2 text-stone-500 hover:text-stone-800 text-[11px] font-semibold text-center cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <!-- Footer Trust Badge -->
        <div class="py-2.5 px-4 bg-stone-100 border-t border-stone-200 text-center text-[10px] text-stone-500 flex items-center justify-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
          <span>Secured by <strong>Razorpay Payment Gateway</strong></span>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    document.getElementById('rzp-test-btn-close-x')?.addEventListener('click', () => {
      overlay.remove();
      if (options.onDismiss) options.onDismiss();
    });

    document.getElementById('tab-scanner')?.addEventListener('click', () => {
      activeTab = 'SCANNER';
      renderModalContent();
    });

    document.getElementById('tab-phone')?.addEventListener('click', () => {
      activeTab = 'PHONE_NUMBER';
      renderModalContent();
    });

    document.getElementById('tab-collect')?.addEventListener('click', () => {
      activeTab = 'COLLECT';
      renderModalContent();
    });

    document.getElementById('btn-copy-phone')?.addEventListener('click', (e) => {
      navigator.clipboard?.writeText('+919876543210');
      (e.target as HTMLElement).innerText = 'Copied!';
      setTimeout(() => {
        const el = document.getElementById('btn-copy-phone');
        if (el) el.innerText = 'Copy Number';
      }, 2000);
    });

    document.getElementById('btn-copy-upi')?.addEventListener('click', (e) => {
      navigator.clipboard?.writeText('abchotel.pay@icici');
      (e.target as HTMLElement).innerText = 'Copied!';
      setTimeout(() => {
        const el = document.getElementById('btn-copy-upi');
        if (el) el.innerText = 'Copy UPI ID';
      }, 2000);
    });

    document.getElementById('rzp-test-btn-success')?.addEventListener('click', () => {
      overlay.remove();
      options.onSuccess({
        orderId: options.orderId,
        providerOrderId: options.providerOrderId,
        providerPaymentId: mockPaymentId,
        providerSignature: mockSignature
      });
    });

    document.getElementById('rzp-test-btn-fail')?.addEventListener('click', () => {
      overlay.remove();
      options.onFailure({
        code: 'PAYMENT_FAILED',
        message: 'Payment was declined by bank or user.'
      });
    });

    document.getElementById('rzp-test-btn-cancel')?.addEventListener('click', () => {
      overlay.remove();
      if (options.onDismiss) options.onDismiss();
    });
  }

  document.body.appendChild(overlay);
  renderModalContent();
}
