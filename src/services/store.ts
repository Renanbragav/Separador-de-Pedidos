import { Order, OrderStatus } from '../types';
import { SAMPLE_ORDER_160753 } from '../data/sampleOrder';
import { extractExpirationDate } from './orderMatrixParser';

const STORAGE_KEY = 'expedicao_pedidos_v2';
const EVENT_NAME = 'expedicao_orders_changed';
export const MAX_RETENTION_DAYS = 30;

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalDateKey(d);
}

/**
 * Automatically removes orders older than 30 days to free up storage space,
 * while preserving all orders from today and the previous 30 days.
 */
function pruneOrdersOlderThan30Days(orders: Order[]): Order[] {
  const cutoffDateKey = getDateKeyDaysAgo(MAX_RETENTION_DAYS);
  const cutoffTimestamp =
    Date.now() - (MAX_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;

  return orders.filter((order) => {
    const orderDateKey =
      order.dateKey ||
      (order.createdAt ? getLocalDateKey(new Date(order.createdAt)) : getLocalDateKey());
    if (orderDateKey >= cutoffDateKey) {
      return true;
    }
    if (order.createdAt && order.createdAt >= cutoffTimestamp) {
      return true;
    }
    return false;
  });
}

function normalizeOrderItems(orders: Order[]): Order[] {
  const pruned = pruneOrdersOlderThan30Days(orders);
  return pruned.map((order) => {
    const inferredDateKey =
      order.dateKey ||
      (order.createdAt
        ? getLocalDateKey(new Date(order.createdAt))
        : getLocalDateKey());
    return {
      ...order,
      dateKey: inferredDateKey,
      items: (order.items || []).map((item) => ({
        ...item,
        expirationDate:
          item.expirationDate || extractExpirationDate(item.lotInfo) || '-',
        manufacturer: item.manufacturer || 'MAX TITANIUM',
      })),
    };
  });
}

// Check local storage or initialize with sample orders across today and previous days
function getInitialOrders(): Order[] {
  const todayKey = getLocalDateKey();
  const yesterdayKey = getDateKeyDaysAgo(1);
  const twoDaysAgoKey = getDateKeyDaysAgo(2);

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = normalizeOrderItems(parsed);
        if (normalized.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }

  // Pre-populate with orders for Today and Previous Days so history is immediately available
  const initial: Order[] = [
    {
      ...SAMPLE_ORDER_160753,
      id: 'pedido-160753',
      createdAt: Date.now() - 3600000 * 2,
      dateKey: todayKey,
    },
    {
      id: 'pedido-160750',
      orderNumber: '160750',
      dateCad: 'Hoje - 15:30:00',
      clientName: 'SUPLEMENTOS & CIA',
      clientFantasia: 'SUPLE & CIA',
      clientAddress: 'RUA CORONEL ALEXANDRINO, 1200 - CENTRO - ARACATI-CE',
      sellerName: 'MARINHO',
      sellerNormalized: 'Marinho',
      status: 'Separando' as OrderStatus,
      totalItems: 2,
      totalValue: 828.5,
      createdAt: Date.now() - 3600000 * 4,
      dateKey: todayKey,
      items: [
        {
          id: 'item-m1',
          code: '5005',
          description: 'MAX 100% WHEY CHOCOLATE 900G',
          manufacturer: 'MAX TITANIUM',
          expirationDate: '16/11/2027',
          lotInfo: 'L->16/11/2027 Lt 2613802 Qt 5',
          quantityOrdered: 5,
          quantitySeparated: 5,
          unit: 'PT',
          unitPrice: 139.9,
          totalPrice: 699.5,
          location: 'ESTOQUE2-BLOCO-N',
          checked: true,
        },
        {
          id: 'item-m2',
          code: '4757',
          description: 'MAX CREATINE POTE 300G',
          manufacturer: 'MAX TITANIUM',
          expirationDate: '26/05/2028',
          lotInfo: 'L->26/05/2028 Lt 2614705 Qt 3',
          quantityOrdered: 3,
          quantitySeparated: 3,
          unit: 'UN',
          unitPrice: 43.0,
          totalPrice: 129.0,
          location: 'ESTOQUE1-BLOCO-F',
          checked: true,
        },
      ],
    },
    {
      id: 'pedido-160748',
      orderNumber: '160748',
      dateCad: 'Hoje - 14:15:00',
      clientName: 'FARMACIA NORDESTE',
      clientFantasia: 'DROGARIA NORDESTE',
      clientAddress: 'AV. DOM LUIS, 500 - ALDEOTA - FORTALEZA-CE',
      sellerName: 'ELIZANGELA',
      sellerNormalized: 'Elizangela',
      status: 'Faturado' as OrderStatus,
      totalItems: 1,
      totalValue: 877.0,
      createdAt: Date.now() - 3600000 * 6,
      dateKey: todayKey,
      items: [
        {
          id: 'item-e1',
          code: '8394',
          description: 'IM CRISP BAR OVOMALTINE 12X45G',
          manufacturer: 'INTEGRALMEDICA',
          expirationDate: '26/06/2027',
          lotInfo: 'L->26/06/2027 Lt 083686 Qt 10',
          quantityOrdered: 10,
          quantitySeparated: 10,
          unit: 'CX',
          unitPrice: 87.7,
          totalPrice: 877.0,
          location: 'ESTOQUE1-BLOCO-E',
          checked: true,
        },
      ],
    },
    {
      id: 'pedido-160712',
      orderNumber: '160712',
      dateCad: 'Ontem - 16:40:00',
      clientName: 'ACADEMIA IRON FIT LTDA',
      clientFantasia: 'IRON FIT',
      clientAddress: 'RUA PADRE VALDEVINO, 890 - CENTRO - FORTALEZA-CE',
      sellerName: 'CAIO',
      sellerNormalized: 'Caio',
      status: 'Faturado' as OrderStatus,
      totalItems: 2,
      totalValue: 1119.2,
      createdAt: Date.now() - 86400000,
      dateKey: yesterdayKey,
      items: [
        {
          id: 'item-c1',
          code: '6756',
          description: 'IM WHEY 100% BAUNILHA POUNCH 900G',
          manufacturer: 'INTEGRALMEDICA',
          expirationDate: '26/01/2028',
          lotInfo: 'L->26/01/2028 Lt 083938 Qt 8',
          quantityOrdered: 8,
          quantitySeparated: 8,
          unit: 'SCH',
          unitPrice: 139.9,
          totalPrice: 1119.2,
          location: 'ESTOQUE1-BLOCO-E',
          checked: true,
        },
      ],
    },
    {
      id: 'pedido-160695',
      orderNumber: '160695',
      dateCad: '2 dias atrás - 11:20:00',
      clientName: 'EMPÓRIO VIDA SAUDÁVEL',
      clientFantasia: 'VIDA SAUDÁVEL',
      clientAddress: 'AV. SANTOS DUMONT, 2400 - ALDEOTA - FORTALEZA-CE',
      sellerName: 'GERMANA',
      sellerNormalized: 'Germana',
      status: 'Faturado' as OrderStatus,
      totalItems: 1,
      totalValue: 376.0,
      createdAt: Date.now() - 86400000 * 2,
      dateKey: twoDaysAgoKey,
      items: [
        {
          id: 'item-g1',
          code: '8211',
          description: 'NUCLEAR RUSH GUARANA 300G',
          manufacturer: 'BODYACTION',
          expirationDate: '30/10/2026',
          lotInfo: 'L->30/10/2026 Lt 4070003/7601 Qt 4',
          quantityOrdered: 4,
          quantitySeparated: 4,
          unit: 'PT',
          unitPrice: 94.0,
          totalPrice: 376.0,
          location: 'ESTOQUE2-BLOCO-K',
          checked: true,
        },
      ],
    },
  ];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch (e) {
    console.error('Failed to save initial orders:', e);
  }

  return initial;
}

export class OrderStore {
  private static listeners: Array<(orders: Order[]) => void> = [];

  public static getOrders(): Order[] {
    return getInitialOrders();
  }

  public static saveOrders(orders: Order[]) {
    // Always prune orders older than 30 days before saving
    const prunedOrders = pruneOrdersOlderThan30Days(orders);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedOrders));
    } catch {
      // Step 1 fallback: strip base64 fileDataUrl from older days' orders
      try {
        const todayKey = getLocalDateKey();
        const compacted = prunedOrders.map((o, idx) =>
          o.dateKey !== todayKey || idx > 3 ? { ...o, fileDataUrl: undefined } : o
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
      } catch {
        // Step 2 fallback: strip fileDataUrl from all except the newest order so order data is always saved
        try {
          const ultraCompacted = prunedOrders.map((o, idx) =>
            idx === 0 ? o : { ...o, fileDataUrl: undefined }
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraCompacted));
        } catch (finalErr) {
          console.warn('Storage quota warning:', finalErr);
        }
      }
    }

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: prunedOrders })
    );
    this.notifyListeners(prunedOrders);
  }

  public static subscribe(listener: (orders: Order[]) => void) {
    this.listeners.push(listener);

    const handleCustomEvent = (e: any) => {
      listener(e.detail || this.getOrders());
    };

    window.addEventListener(EVENT_NAME, handleCustomEvent);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
      window.removeEventListener(EVENT_NAME, handleCustomEvent);
    };
  }

  private static notifyListeners(orders: Order[]) {
    this.listeners.forEach((l) => l(orders));
  }

  public static addOrder(newOrder: Order) {
    const orders = this.getOrders();
    const orderWithDate = {
      ...newOrder,
      dateKey: newOrder.dateKey || getLocalDateKey(),
    };
    const updated = [orderWithDate, ...orders];
    this.saveOrders(updated);
  }

  public static updateOrder(orderId: string, updates: Partial<Order>) {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      this.saveOrders([...orders]);
    }
  }

  public static deleteOrder(orderId: string) {
    const orders = this.getOrders();
    const updated = orders.filter((o) => o.id !== orderId);
    this.saveOrders(updated);
  }

  /**
   * Cleans up orders older than 30 days on demand and returns how many were removed.
   */
  public static cleanExpiredHistory(): number {
    const current = this.getOrders();
    const pruned = pruneOrdersOlderThan30Days(current);
    const removedCount = current.length - pruned.length;
    if (removedCount > 0) {
      this.saveOrders(pruned);
    }
    return removedCount;
  }

  /**
   * Calculates how many orders are ahead in queue for a seller's specific order.
   */
  public static getOrdersAhead(order: Order, allOrders: Order[]): number {
    const activeStatuses: OrderStatus[] = [
      'Pendente',
      'Separando',
      'Conferido',
      'Com Pendências',
    ];

    if (order.status === 'Faturado') return 0;

    const ahead = allOrders.filter((o) => {
      if (o.id === order.id) return false;
      if (!activeStatuses.includes(o.status)) return false;
      return o.createdAt < order.createdAt;
    });

    return ahead.length;
  }
}
