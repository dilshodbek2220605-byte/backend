/**
 * Prisma Decimal -> oddiy JavaScript number.
 * Bazada pul Decimal(14,2) turida saqlanadi (aniqlik uchun),
 * lekin API javobida har doim raqam qaytaramiz.
 */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const n = Number((value as { toString(): string }).toString());
  return Number.isNaN(n) ? 0 : n;
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return num(value);
}

export function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

type StoreLike = {
  id: string;
  name: string;
  phone: string | null;
  address?: string | null;
  currency: string;
  lowStockThreshold: number;
};

export function serializeStore(store: StoreLike) {
  return {
    id: store.id,
    name: store.name,
    phone: store.phone,
    address: store.address ?? null,
    currency: store.currency,
    lowStockThreshold: store.lowStockThreshold,
  };
}

type UserLike = {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  store?: StoreLike | null;
};

export function serializeUser(user: UserLike) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    ...(user.store ? { store: serializeStore(user.store) } : {}),
  };
}

type ProductLike = {
  id: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  price: unknown;
  costPrice: unknown;
  stock: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

export function serializeProduct(p: ProductLike) {
  return {
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    category: p.category,
    unit: p.unit,
    price: num(p.price),
    costPrice: numOrNull(p.costPrice),
    stock: num(p.stock),
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt ?? p.createdAt,
  };
}

type SaleItemLike = {
  id: string;
  productId: string | null;
  productName: string;
  barcode: string | null;
  unit: string;
  quantity: unknown;
  price: unknown;
  unitCost: unknown;
};

export function serializeSaleItem(i: SaleItemLike) {
  const quantity = num(i.quantity);
  const price = num(i.price);
  const unitCost = num(i.unitCost);
  return {
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    barcode: i.barcode,
    unit: i.unit,
    quantity,
    price,
    unitCost,
    lineTotal: round2(quantity * price),
    lineProfit: round2(quantity * (price - unitCost)),
  };
}

type SaleLike = {
  id: string;
  totalAmount: unknown;
  profitAmount: unknown;
  itemCount: unknown;
  paymentMethod: string;
  amountPaid: unknown;
  changeAmount: unknown;
  note: string | null;
  clientRef: string | null;
  createdAt: Date;
  cashier?: { id: string; name: string; username: string } | null;
  items?: SaleItemLike[];
};

export function serializeSale(sale: SaleLike) {
  return {
    id: sale.id,
    totalAmount: num(sale.totalAmount),
    profitAmount: num(sale.profitAmount),
    itemCount: num(sale.itemCount),
    paymentMethod: sale.paymentMethod,
    amountPaid: numOrNull(sale.amountPaid),
    changeAmount: numOrNull(sale.changeAmount),
    note: sale.note,
    clientRef: sale.clientRef,
    createdAt: sale.createdAt,
    cashier: sale.cashier
      ? { id: sale.cashier.id, name: sale.cashier.name, username: sale.cashier.username }
      : null,
    ...(sale.items ? { items: sale.items.map(serializeSaleItem) } : {}),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
