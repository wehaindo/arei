# POS Inventory Receiving

## Overview
This module allows POS administrators to create and validate inventory receiving orders directly from the POS interface.

## Features
- **POS Manager Only**: Receiving button only visible to POS administrators
- **Store-Based Receiving**: Creates receiving orders based on POS store location
- **Product Selection**: Select products and quantities to receive
- **Lot/Serial Support**: Enter lot or serial numbers for tracked products
- **Server Validation**: Validate receiving orders on the server
- **Real-time Updates**: Stock quantities updated immediately after validation

## Configuration
1. Go to **Point of Sale > Configuration > Point of Sale**
2. Select your POS configuration
3. In the **Inventory Receiving** section:
   - Enable **Enable Inventory Receiving**
   - Set **Receiving Location** (default destination for received goods)

## Usage
1. **Open POS** as a POS administrator (manager role)
2. **Click "Receiving"** button in the navbar (top right)
3. **Add Products**:
   - Select product from dropdown
   - Enter quantity
   - Enter lot/serial number (if product is tracked)
   - Click "Add Line"
4. **Create Receiving**:
   - Review the list of products
   - Click "Create Receiving"
   - System creates a draft receiving order
5. **Validate Receiving**:
   - Click "Validate" button
   - Stock is updated immediately
   - Products are now available for sale

## Technical Details

### Models
- **pos.config**: Added `enable_inventory_receiving` and `receiving_location_id` fields
- **stock.picking**: Added `pos_session_id` and `created_from_pos` fields

### Server Methods
- `create_pos_receiving(vals)`: Creates a receiving order from POS
- `validate_pos_receiving(picking_id)`: Validates a receiving order

### Frontend Services
- **inventory_receiving**: Manages receiving operations
  - `createReceiving(lines)`: Create receiving order
  - `validateReceiving(pickingId)`: Validate receiving
  - `isPosManager()`: Check if user is manager
  - `isEnabled()`: Check if feature is enabled

### Security
- Only POS administrators (group_pos_manager) can:
  - See the receiving button
  - Create receiving orders
  - Validate receiving orders
- POS users (group_pos_user) have read-only access to stock.picking

## Dependencies
- point_of_sale
- stock
