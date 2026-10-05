/**
 * Utility Formatters and Helpers
 * Standardized across Staff Workflow & Kitchen Workflow
 * 
 * 👨‍🍳 Staff Workflow:
 * - Order Placed: Order has been placed by the customer.
 * - Waiting to Serve: Order is ready and waiting to be served.
 * - Served: Order has been served to the customer.
 * - Payment Completed: Payment has been successfully completed.
 * 
 * 🍳 Kitchen Workflow:
 * - Order Received: Kitchen has received the order.
 * - Cooking Started: Kitchen has started preparing the order.
 * - Ready to Serve: Food preparation is completed and the order is ready.
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Handle YYYY-MM-DD
      const [year, month, day] = dateString.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatDDMMYY(dateString: string): string {
  if (!dateString) return '';
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const [year, month, day] = dateString.split('T')[0].split('-');
      const shortYear = year.slice(-2);
      return `${day}-${month}-${shortYear}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const shortYear = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${shortYear}`;
  } catch {
    return dateString;
  }
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes} ${ampm}`;
}

export function formatOrderDateTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const dateFormatted = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeFormatted = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateFormatted} • ${timeFormatted}`;
  } catch {
    return isoString;
  }
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  try {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    const formatted = d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (dateStr === today) {
      return `Today (${formatted})`;
    } else if (dateStr === yesterday) {
      return `Yesterday (${formatted})`;
    }
    return formatted;
  } catch {
    return dateStr;
  }
}

export function getPast30DaysRange(): { today: string; yesterday: string; minDate: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { today, yesterday, minDate };
}

export function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'PLACED':
      return { label: 'New Order', color: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' };
    case 'CONFIRMED':
    case 'PREPARING':
      return { label: 'Order Accepted', color: 'bg-orange-100 text-orange-900 border-orange-300 animate-pulse font-bold' };
    case 'READY':
      return { label: 'Order Ready', color: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' };
    case 'DELIVERY_ASSIGNED':
      return { label: 'Rider Notified', color: 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold' };
    case 'DELIVERY_ACCEPTED':
      return { label: 'Rider Accepted', color: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold' };
    case 'PICKED_UP':
      return { label: 'Picked Up', color: 'bg-purple-100 text-purple-900 border-purple-300 font-bold' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for Delivery', color: 'bg-purple-200 text-purple-950 border-purple-400 font-bold animate-pulse' };
    case 'DELIVERED':
      return { label: 'Delivered', color: 'bg-teal-100 text-teal-900 border-teal-300 font-bold' };
    case 'SERVED':
      return { label: 'Served', color: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold' };
    case 'WAITING_FOR_PAYMENT':
      return { label: 'Served (Payment Due)', color: 'bg-rose-100 text-rose-900 border-rose-300 font-bold' };
    case 'COMPLETED':
      return { label: 'Done', color: 'bg-teal-100 text-teal-900 border-teal-300 font-bold' };
    case 'CANCELLED':
      return { label: 'Cancelled', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    default:
      return { label: status, color: 'bg-stone-100 text-stone-700 border-stone-200' };
  }
}

export function getBookingStatusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return { label: 'New', color: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' };
    case 'CONFIRMED':
      return { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' };
    case 'SEATED':
      return { label: 'Seated', color: 'bg-blue-100 text-blue-900 border-blue-300 font-bold' };
    case 'COMPLETED':
      return { label: 'Completed', color: 'bg-stone-100 text-stone-700 border-stone-300 font-bold' };
    case 'CANCELLED':
      return { label: 'Cancelled', color: 'bg-rose-100 text-rose-800 border-rose-200 font-bold' };
    case 'REJECTED':
      return { label: 'Declined', color: 'bg-rose-100 text-rose-800 border-rose-200 font-bold' };
    case 'NO_SHOW':
      return { label: 'No Show', color: 'bg-stone-200 text-stone-600 border-stone-300 font-bold' };
    default:
      return { label: status, color: 'bg-stone-100 text-stone-700 border-stone-200 font-bold' };
  }
}

export function getStaffWorkflowBadge(status: string) {
  switch (status) {
    case 'PLACED':
      return { label: 'New Order', description: 'Order has been placed by the customer', color: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'CONFIRMED':
    case 'PREPARING':
      return { label: 'Order Accepted', description: 'Order accepted by staff or kitchen', color: 'bg-orange-100 text-orange-900 border-orange-300 animate-pulse' };
    case 'READY':
      return { label: 'Order Ready', description: 'Order is ready and waiting to be served or picked up', color: 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-1 ring-emerald-500/30' };
    case 'DELIVERY_ASSIGNED':
      return { label: 'Delivery Staff Notified', description: 'Rider has been assigned and notified of pickup', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    case 'DELIVERY_ACCEPTED':
      return { label: 'Delivery Staff Accepted', description: 'Rider accepted the delivery job', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'PICKED_UP':
      return { label: 'Picked Up by Rider', description: 'Order has been picked up from kitchen by delivery staff', color: 'bg-purple-100 text-purple-900 border-purple-300' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for Delivery', description: 'Rider is on the way to the customer address', color: 'bg-purple-200 text-purple-950 border-purple-400 animate-pulse' };
    case 'DELIVERED':
      return { label: 'Delivered', description: 'Rider has confirmed successful delivery to guest', color: 'bg-teal-100 text-teal-900 border-teal-300' };
    case 'SERVED':
      return { label: 'Served', description: 'Order has been served to the customer', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'WAITING_FOR_PAYMENT':
      return { label: 'Served (Payment Due)', description: 'Order served — awaiting payment settlement', color: 'bg-rose-100 text-rose-900 border-rose-300' };
    case 'COMPLETED':
      return { label: 'Done', description: 'Payment completed and order closed', color: 'bg-teal-100 text-teal-900 border-teal-300' };
    case 'CANCELLED':
      return { label: 'Cancelled', description: 'Order was cancelled', color: 'bg-stone-100 text-stone-600 border-stone-200' };
    default:
      return { label: status, description: '', color: 'bg-stone-100 text-stone-700 border-stone-200' };
  }
}

export function getKitchenWorkflowBadge(status: string) {
  switch (status) {
    case 'PLACED':
      return { label: 'New Order', description: 'Kitchen received new order ticket', color: 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-400/40 animate-pulse' };
    case 'CONFIRMED':
    case 'PREPARING':
      return { label: 'Order Accepted', description: 'Order accepted & cooking on stove', color: 'bg-orange-100 text-orange-950 border-orange-300 ring-1 ring-orange-400/40' };
    case 'READY':
    case 'DELIVERY_ASSIGNED':
    case 'DELIVERY_ACCEPTED':
    case 'PICKED_UP':
      return { label: 'Order Ready', description: 'Prepared & ready on pass for dispatch', color: 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-1 ring-emerald-500/40' };
    case 'SERVED':
    case 'OUT_FOR_DELIVERY':
    case 'DELIVERED':
    case 'COMPLETED':
      return { label: 'Dispatched', description: 'Dispatched to dining table or rider', color: 'bg-stone-100 text-stone-800 border-stone-300' };
    case 'CANCELLED':
      return { label: 'Cancelled', description: 'Order was cancelled', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    default:
      return { label: status, description: '', color: 'bg-stone-100 text-stone-700 border-stone-200' };
  }
}

