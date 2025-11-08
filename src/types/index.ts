// Product/Inventory types
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stock: number;
  hasWarranty: boolean;
  warrantyMonths?: number;
  warrantyYears?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stock: number;
  hasWarranty?: boolean;
  warrantyMonths?: number;
  warrantyYears?: number;
}

export interface StockHistory {
  id: string;
  productId: string;
  quantityChange: number;
  reason: string;
  createdAt: string;
}
