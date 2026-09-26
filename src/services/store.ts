import { Order, OrderStatus } from '../types';
import { SAMPLE_ORDER_160753 } from '../data/sampleOrder';
import { extractExpirationDate } from './orderMatrixParser';

const STORAGE_KEY = 'expedicao_pedidos_v2';
const EVENT_NAME = 'expedicao_orders_changed';

function normalizeOrderItems(orders: Order[]): Order[] {
  return orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item) => ({
      ...item,
      expirationDate:
        item.expirationDate || extractExpirationDate(item.lotInfo) || '-',
      manufacturer: item.manufacturer || 'MAX TITANIUM',
    })),
  }));
}

// Check local storage or initialize with sample order
function getInitialOrders(): Order[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeOrderItems(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }

  // Pre-populate with sample order for Zelia
  const initial: Order[] = [
    {
      ...SAMPLE_ORDER_160753,
      id: 'pedido-160753',
      createdAt: Date.now() - 3600000 * 2,
    },
    {
      id: 'pedido-160750',
      orderNumber: '160750',
      dateCad: '17/09/2026 - 15:30:00',
      clientName: 'SUPLEMENTOS & CIA',
      clientFantasia: 'SUPLE & CIA',
      clientAddress: 'RUA CORONEL ALEXANDRINO, 1200 - CENTRO - ARACATI-CE',
      sellerName: 'MARINHO',
      sellerNormalized: 'Marinho',
      status: 'Separando' as OrderStatus,
      totalItems: 2,
      totalValue: 828.5,
      createdAt: Date.now() - 3600000 * 4,
      dateKey: new Date().toISOString().split('T')[0],
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
      dateCad: '17/09/2026 - 14:15:00',
      clientName: 'FARMACIA NORDESTE',
      clientFantasia: 'DROGARIA NORDESTE',
      clientAddress: 'AV. DOM LUIS, 500 - ALDEOTA - FORTALEZA-CE',
      sellerName: 'ELIZANGELA',
      sellerNormalized: 'Elizangela',
      status: 'Conferido' as OrderStatus,
      totalItems: 1,
      totalValue: 877.0,
      createdAt: Date.now() - 3600000 * 6,
      dateKey: new Date().toISOString().split('T')[0],
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: orders }));
      this.notifyListeners(orders);
    } catch (e) {
      console.error('Error saving orders:', e);
    }
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
    const updated = [newOrder, ...orders];
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
   * Calculates how many orders are ahead in queue for a seller's specific order.
   * Active non-completed orders created before this order are counted.
   */
  public static getOrdersAhead(order: Order, allOrders: Order[]): number {
    const activeStatuses: OrderStatus[] = ['Pendente', 'Separando', 'Conferido', 'Com Pendências'];
    
    // If the order itself is already completed/faturado, queue position is 0
    if (order.status === 'Faturado') return 0;

    // Filter active orders created earlier than this order
    const ahead = allOrders.filter((o) => {
      if (o.id === order.id) return false;
      if (!activeStatuses.includes(o.status)) return false;
      return o.createdAt < order.createdAt;
    });

    return ahead.length;
  }
}
