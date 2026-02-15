# POS RFID Integration for Odoo 18

## Overview
This module integrates RFID reader functionality into Odoo Point of Sale, allowing automatic product addition by scanning RFID tags.

## Features
- **WebSocket Connection**: Connects to desktop RFID reader application via WebSocket
- **Automatic Product Addition**: Finds products by lot/serial number and adds to POS order
- **Real-time Feedback**: Visual status indicator in POS interface
- **Configurable Settings**: Enable/disable RFID per POS configuration

## Installation

1. Copy the `weha_pos_rfid` folder to your Odoo addons directory
2. Update the addons list: Go to Apps → Update Apps List
3. Search for "POS RFID Integration"
4. Click Install

## Configuration

### 1. POS Configuration
Go to **Point of Sale → Configuration → Point of Sale**

Select your POS and enable:
- **Enable RFID Reader**: Check this option
- **RFID WebSocket URL**: Set to `ws://localhost:8081` (default)
- **Auto Add Products**: Enable to automatically add products to order

### 2. RFID Reader Application
Start the Java RFID reader application (RFIDDesktopApp):
```bash
cd C:\Users\wehac\Projects\Arei\RFIDDesktopApp
run.bat
```

The application will:
- Connect to Chainway R3 RFID reader
- Start WebSocket server on `ws://localhost:8081`
- Broadcast unique RFID tags via WebSocket

## Usage

1. **Open POS Session**
   - Start a POS session as usual
   - The RFID service will auto-connect if enabled

2. **Check Connection Status**
   - Look for the RFID button in the POS interface
   - **Green "RFID Connected"**: Ready to scan
   - **Yellow "RFID Connecting..."**: Attempting connection
   - **Gray "RFID Disabled"**: Not enabled in config

3. **Scan Products**
   - Scan RFID tags with the physical reader
   - Products are automatically found by lot/serial number
   - Products are added to the current order (quantity 1 each)

4. **Clear RFID Cache**
   - Click the RFID button to clear seen tags on the reader
   - This allows re-scanning the same tags

## How It Works

### Flow:
1. RFID reader scans tag → Sends EPC via WebSocket
2. POS receives tag → Searches `stock.lot` by EPC
3. Finds product associated with lot/serial
4. Adds product to current POS order

### Message Format:
The WebSocket server sends messages in this format:
```json
{
  "type": "tag",
  "epc": "E2000017221405181810B241",
  "rssi": "-45",
  "timestamp": 1704067200000,
  "firstSeen": true
}
```

## Requirements

- Odoo 18.0
- `point_of_sale` module
- `stock` module
- RFID Desktop App running on `localhost:8081`
- Products must have lot/serial numbers that match RFID tag EPCs

## Technical Details

### Files Structure:
```
weha_pos_rfid/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   └── pos_config.py          # POS configuration extension
├── views/
│   └── pos_config_views.xml   # Settings UI
└── static/src/
    ├── js/
    │   ├── rfid_service.js    # WebSocket service
    │   └── rfid_button.js     # UI component
    └── xml/
        └── rfid_button.xml    # Button template
```

### Key Components:

**RFID Service** (`rfid_service.js`):
- Manages WebSocket connection
- Handles automatic reconnection
- Processes incoming RFID tags
- Searches products by lot/serial
- Adds products to POS order

**RFID Button** (`rfid_button.js`):
- Visual connection status indicator
- Manual reconnection trigger
- Clear seen tags functionality

## Troubleshooting

### RFID Not Connecting
1. Check RFID Desktop App is running
2. Verify WebSocket URL in POS config
3. Check browser console for errors
4. Ensure firewall allows WebSocket connection

### Products Not Adding
1. Verify lot/serial numbers exist in Odoo
2. Check lot names match RFID tag EPCs exactly
3. Ensure products are available in POS
4. Check "Auto Add Products" is enabled

### Connection Keeps Dropping
- The service automatically reconnects every 3 seconds
- Check RFID Desktop App is stable
- Verify network connectivity

## License
LGPL-3
