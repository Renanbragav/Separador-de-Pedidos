export type UserRole = 'vendedor' | 'estoque' | 'admin';

export const VENDEDORES = [
  'Elizangela',
  'Marinho',
  'Fransle',
  'Germana',
  'Zelia',
  'Caio',
  'Silvia',
  'Claudia',
] as const;

export type VendedorName = (typeof VENDEDORES)[number];

export const ESTOQUE_USERS = [
  'Fabio',
  'Gabriel',
  'Luan',
  'João',
] as const;

export type EstoqueName = (typeof ESTOQUE_USERS)[number];

export const ADMIN_USERS = ['Renan', 'Ilma'] as const;
export type AdminName = (typeof ADMIN_USERS)[number];

export type UserName = VendedorName | EstoqueName | AdminName;

export type UserProfile =
  | { role: 'vendedor'; name: VendedorName }
  | { role: 'estoque'; name: EstoqueName }
  | { role: 'admin'; name: AdminName };

export type OrderStatus =
  | 'Pendente'
  | 'Separando'
  | 'Conferido'
  | 'Com Pendências'
  | 'Faturado';

export interface OrderItem {
  id: string;
  code: string; // SKU
  description: string; // Produto
  presentation?: string;
  manufacturer?: string; // Fornecedor
  expirationDate?: string; // Validade (ex: 04/06/2027)
  quantityOrdered: number; // Quantidade
  quantitySeparated: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  location?: string;
  lotInfo?: string;
  checked: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  dateCad: string;
  clientCode?: string;
  clientName: string;
  clientFantasia?: string;
  clientAddress?: string;
  cnpj?: string;
  transport?: string;
  route?: string;
  sellerName: string;
  sellerNormalized: string; // e.g. "Zelia" matching vendor list
  status: OrderStatus;
  items: OrderItem[];
  totalItems: number;
  totalValue: number;
  fileDataUrl?: string; // image or pdf base64 preview
  fileType?: 'image' | 'pdf' | 'sample';
  fileName?: string;
  createdAt: number; // timestamp for queue order
  dateKey: string; // YYYY-MM-DD for daily archive
  notaFiscal?: string;
  volumes?: number;
  separador?: string;
  conferente?: string;
  signatureBase64?: string;
  pendenciesNotes?: string;
}

export interface OrderFilter {
  dateKey?: string;
  status?: OrderStatus | 'Todos';
  search?: string;
}
