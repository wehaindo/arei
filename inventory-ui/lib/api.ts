import { LoginCredentials, LoginResponse, ApiResponse } from "./types";

class OdooApiService {
  private sessionId: string | null = null;
  private serverUrl: string = "http://localhost:8069";

  constructor() {
    // Load session and server config from localStorage on client side
    if (typeof window !== "undefined") {
      this.sessionId = localStorage.getItem("odoo_session_id");
      this.serverUrl = localStorage.getItem("odoo_server_url") || "http://localhost:8069";
    }
  }

  private getServerUrl(): string {
    if (typeof window !== "undefined") {
      return localStorage.getItem("odoo_server_url") || this.serverUrl;
    }
    return this.serverUrl;
  }

  private async makeRequest<T>(
    endpoint: string,
    params: any = {}
  ): Promise<ApiResponse<T>> {
    try {
      const serverUrl = this.getServerUrl();
      const response = await fetch(`${serverUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          jsonrpc: "2.0",
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle Odoo JSON-RPC response format
      if (data.result) {
        return data.result;
      }

      if (data.error) {
        return {
          success: false,
          error: data.error.data?.message || data.error.message || "Unknown error",
        };
      }

      return data;
    } catch (error: any) {
      console.error("API request failed:", error);
      return {
        success: false,
        error: error.message || "Network error occurred",
      };
    }
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // Save server URL and database first
    if (typeof window !== "undefined") {
      localStorage.setItem("odoo_server_url", credentials.serverUrl);
      localStorage.setItem("odoo_database", credentials.db);
      this.serverUrl = credentials.serverUrl;
    }

    const response = await this.makeRequest<LoginResponse["data"]>(
      "/api/mobile/auth/login",
      {
        db: credentials.db,
        login: credentials.login,
        password: credentials.password
      }
    );

    if (response.success && response.data) {
      this.sessionId = response.data.session_id;
      if (typeof window !== "undefined") {
        localStorage.setItem("odoo_session_id", response.data.session_id);
        localStorage.setItem("odoo_user", JSON.stringify(response.data));
      }
    }

    return response as LoginResponse;
  }

  logout() {
    this.sessionId = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("odoo_session_id");
      localStorage.removeItem("odoo_user");
      localStorage.removeItem("odoo_server_url");
      localStorage.removeItem("odoo_database");
    }
  }

  getUser() {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("odoo_user");
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.sessionId;
  }

  // Receipt operations
  async listReceipts(params: {
    state?: string;
    partner_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}) {
    return this.makeRequest("/api/mobile/receipts/list", params);
  }

  async getReceiptDetail(pickingId: number) {
    return this.makeRequest(`/api/mobile/receipts/${pickingId}`, {});
  }

  async updateReceiptLine(
    pickingId: number,
    moveId: number,
    quantityDone: number
  ) {
    return this.makeRequest(`/api/mobile/receipts/${pickingId}/update`, {
      move_id: moveId,
      quantity_done: quantityDone,
    });
  }

  async validateReceipt(pickingId: number) {
    return this.makeRequest(`/api/mobile/receipts/${pickingId}/validate`, {});
  }

  // Delivery operations
  async listDeliveries(params: {
    state?: string;
    partner_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}) {
    return this.makeRequest("/api/mobile/deliveries/list", params);
  }

  async getDeliveryDetail(pickingId: number) {
    return this.makeRequest(`/api/mobile/deliveries/${pickingId}`, {});
  }

  async updateDeliveryLine(
    pickingId: number,
    moveId: number,
    quantityDone: number
  ) {
    return this.makeRequest(`/api/mobile/deliveries/${pickingId}/update`, {
      move_id: moveId,
      quantity_done: quantityDone,
    });
  }

  async validateDelivery(pickingId: number) {
    return this.makeRequest(`/api/mobile/deliveries/${pickingId}/validate`, {});
  }

  // Internal transfer operations
  async listTransfers(params: {
    state?: string;
    date_from?: string;
    date_to?: string;
  } = {}) {
    return this.makeRequest("/api/mobile/transfers/list", params);
  }

  async getTransferDetail(pickingId: number) {
    return this.makeRequest(`/api/mobile/transfers/${pickingId}`, {});
  }

  async updateTransferLine(
    pickingId: number,
    moveId: number,
    quantityDone: number
  ) {
    return this.makeRequest(`/api/mobile/transfers/${pickingId}/update`, {
      move_id: moveId,
      quantity_done: quantityDone,
    });
  }

  async validateTransfer(pickingId: number) {
    return this.makeRequest(`/api/mobile/transfers/${pickingId}/validate`, {});
  }

  // Product operations
  async searchProducts(query: string, limit: number = 20) {
    return this.makeRequest("/api/mobile/products/search", { query, limit });
  }

  async getProductStock(productId: number, locationId?: number) {
    return this.makeRequest(`/api/mobile/products/${productId}/stock`, {
      location_id: locationId,
    });
  }

  // Location operations
  async listLocations(usage: string = "internal") {
    return this.makeRequest("/api/mobile/locations/list", { usage });
  }
}

export const odooApi = new OdooApiService();
