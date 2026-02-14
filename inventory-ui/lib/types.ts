export interface LoginCredentials {
  serverUrl: string;
  db: string;
  login: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user_id: number;
    token: string;
    user_name: string;
    login: string;
    company_id: number;
    company_name: string;
  };
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

export interface Receipt {
  id: number;
  name: string;
  partner_name: string;
  partner_id: number | false;
  scheduled_date: string;
  origin: string;
  state: string;
  location_dest_id: number;
  location_dest_name: string;
  total_lines: number;
}

export interface ReceiptLine {
  id: number;
  product_id: number;
  product_name: string;
  product_code: string;
  product_barcode: string;
  quantity_expected: number;
  quantity_done: number;
  uom: string;
  location_dest_id: number;
  location_dest_name: string;
  state: string;
}

export interface ReceiptDetail {
  id: number;
  name: string;
  partner_name: string;
  partner_id: number | false;
  scheduled_date: string;
  origin: string;
  state: string;
  location_id: number;
  location_name: string;
  location_dest_id: number;
  location_dest_name: string;
  lines: ReceiptLine[];
}

export interface Delivery {
  id: number;
  name: string;
  partner_name: string;
  partner_id: number | false;
  scheduled_date: string;
  origin: string;
  state: string;
  location_id: number;
  location_name: string;
  total_lines: number;
}

export interface Transfer {
  id: number;
  name: string;
  scheduled_date: string;
  origin: string;
  state: string;
  location_id: number;
  location_name: string;
  location_dest_id: number;
  location_dest_name: string;
  total_lines: number;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  barcode: string;
  uom: string;
  qty_available: number;
  type: string;
}

export interface StockLocation {
  location_id: number;
  location_name: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
}

export interface ProductStock {
  product_id: number;
  product_name: string;
  product_code: string;
  total_available: number;
  locations: StockLocation[];
}

export interface Location {
  id: number;
  name: string;
  complete_name: string;
  usage: string;
  barcode: string;
}
