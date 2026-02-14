# Weha Inventory Controller - Mobile API

## Overview
This Odoo 18 module provides REST API endpoints for mobile applications to handle inventory operations including:
- **Receipts** (Incoming Shipments)
- **Deliveries** (Outgoing Shipments)  
- **Internal Transfers**

## Installation

1. Copy the `weha_inventory_controller` folder to your Odoo addons directory
2. Update the addons list: Settings → Apps → Update Apps List
3. Search for "Weha Inventory Controller" and install it

## API Endpoints

All endpoints use JSON format. Set `Content-Type: application/json` header.

### Authentication

#### Login
```
POST /api/mobile/auth/login
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "db": "your_database",
        "login": "user@example.com",
        "password": "password"
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "user_id": 2,
        "session_id": "abc123...",
        "user_name": "John Doe",
        "company_id": 1,
        "company_name": "My Company"
    }
}
```

---

### Receipt Operations

#### List Receipts
```
POST /api/mobile/receipts/list
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "state": "assigned",
        "partner_id": 5,
        "date_from": "2026-01-01",
        "date_to": "2026-12-31"
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 10,
            "name": "WH/IN/00010",
            "partner_name": "Supplier ABC",
            "partner_id": 5,
            "scheduled_date": "2026-02-15T10:00:00",
            "origin": "PO00123",
            "state": "assigned",
            "location_dest_id": 8,
            "location_dest_name": "WH/Stock",
            "total_lines": 5
        }
    ],
    "count": 1
}
```

#### Get Receipt Details
```
POST /api/mobile/receipts/<picking_id>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 10,
        "name": "WH/IN/00010",
        "partner_name": "Supplier ABC",
        "state": "assigned",
        "lines": [
            {
                "id": 25,
                "product_id": 100,
                "product_name": "Product A",
                "product_code": "PROD-A",
                "product_barcode": "1234567890",
                "quantity_expected": 10.0,
                "quantity_done": 0.0,
                "uom": "Units",
                "location_dest_id": 8,
                "location_dest_name": "WH/Stock",
                "state": "assigned"
            }
        ]
    }
}
```

#### Update Receipt Line
```
POST /api/mobile/receipts/<picking_id>/update
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "move_id": 25,
        "quantity_done": 10.0
    }
}
```

#### Validate Receipt
```
POST /api/mobile/receipts/<picking_id>/validate
```

**Response:**
```json
{
    "success": true,
    "message": "Receipt validated successfully",
    "data": {
        "state": "done"
    }
}
```

---

### Delivery Operations

#### List Deliveries
```
POST /api/mobile/deliveries/list
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "state": "assigned",
        "partner_id": 7
    }
}
```

#### Get Delivery Details
```
POST /api/mobile/deliveries/<picking_id>
```

#### Update Delivery Line
```
POST /api/mobile/deliveries/<picking_id>/update
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "move_id": 30,
        "quantity_done": 5.0
    }
}
```

#### Validate Delivery
```
POST /api/mobile/deliveries/<picking_id>/validate
```

---

### Internal Transfer Operations

#### List Internal Transfers
```
POST /api/mobile/transfers/list
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "state": "assigned"
    }
}
```

#### Get Transfer Details
```
POST /api/mobile/transfers/<picking_id>
```

#### Update Transfer Line
```
POST /api/mobile/transfers/<picking_id>/update
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "move_id": 35,
        "quantity_done": 8.0
    }
}
```

#### Validate Transfer
```
POST /api/mobile/transfers/<picking_id>/validate
```

---

### Product Search & Information

#### Search Products
```
POST /api/mobile/products/search
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "query": "Product A",
        "limit": 20
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 100,
            "name": "Product A",
            "code": "PROD-A",
            "barcode": "1234567890",
            "uom": "Units",
            "qty_available": 50.0,
            "type": "product"
        }
    ],
    "count": 1
}
```

#### Get Product Stock
```
POST /api/mobile/products/<product_id>/stock
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "location_id": 8
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "product_id": 100,
        "product_name": "Product A",
        "product_code": "PROD-A",
        "total_available": 50.0,
        "locations": [
            {
                "location_id": 8,
                "location_name": "WH/Stock",
                "quantity": 50.0,
                "reserved_quantity": 10.0,
                "available_quantity": 40.0
            }
        ]
    }
}
```

---

### Location Management

#### List Locations
```
POST /api/mobile/locations/list
```

**Request Body:**
```json
{
    "jsonrpc": "2.0",
    "params": {
        "usage": "internal"
    }
}
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 8,
            "name": "Stock",
            "complete_name": "WH/Stock",
            "usage": "internal",
            "barcode": "LOC-STOCK"
        }
    ],
    "count": 1
}
```

---

## Testing with Postman/cURL

### Example cURL Request

```bash
curl -X POST http://localhost:8069/api/mobile/receipts/list \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "params": {
        "state": "assigned"
    }
  }'
```

### Authentication Flow

1. First, call `/api/mobile/auth/login` to get session_id
2. Use the session_id in subsequent requests via Cookie header
3. All other endpoints require `auth='user'` (authenticated session)

---

## Error Handling

All endpoints return a consistent error format:

```json
{
    "success": false,
    "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing parameters, validation error)
- `401`: Unauthorized (invalid session)
- `404`: Not Found
- `500`: Internal Server Error

---

## Module Structure

```
weha_inventory_controller/
├── __init__.py
├── __manifest__.py
├── controllers/
│   ├── __init__.py
│   └── mobile_inventory_controller.py
└── security/
    └── ir.model.access.csv
```

---

## Dependencies

- **base**: Odoo Base module
- **stock**: Inventory/Stock module  
- **product**: Product module

---

## License

LGPL-3

---

## Support

For issues or feature requests, please contact your system administrator.

---

## Mobile App Integration Tips

1. **Session Management**: Store the session_id securely after login
2. **Barcode Scanning**: Use the `/api/mobile/products/search` endpoint with barcode parameter
3. **Offline Mode**: Cache operation data and sync when connection is available
4. **Real-time Updates**: Poll list endpoints periodically to get updated operations
5. **Error Handling**: Always check the `success` field in responses

---

## API Best Practices

1. Always validate session before making requests
2. Handle backorder scenarios in validate endpoints
3. Check product availability before updating quantities
4. Use product barcode for faster scanning operations
5. Filter operations by date ranges for better performance
