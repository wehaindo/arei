# Inventory Mobile App

A modern Next.js mobile application for managing Odoo 18 inventory operations including receipts, deliveries, and internal transfers with barcode and RFID scanning support.

## Features

- 🔐 **Secure Authentication** - Login with Odoo credentials
- 📦 **Unified Picking System** - Process all operation types (Receipt/Delivery/Transfer) in one interface
- 📱 **Mobile-First Design** - Optimized for handheld devices
- 📊 **Lot/Serial Tracking** - Full support for product tracking
- 📷 **Barcode Scanning** - Fast product scanning with camera
- 📡 **RFID Support** - Batch scanning with Chainway C72 UHF RFID reader
- 🎨 **Modern UI** - Built with shadcn/ui components
- ⚡ **Real-time Updates** - Live data from Odoo
- 📴 **Static Export** - Build as static site for offline deployment
- 🤖 **Android App** - Deploy as native Android app with Capacitor

## Tech Stack

- **Framework**: Next.js 14.1.0 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Mobile**: Capacitor 8.1.0
- **Platform**: Android
- **Backend**: Odoo 18 API

## Hardware Support

### Chainway C72
- **Barcode**: 1D/2D barcode scanner
- **RFID**: UHF RFID reader (EPC Gen2)
- **OS**: Android
- **RFID Range**: 0-5 meters
- **Use Case**: Batch receiving/shipping with RFID tags

## Prerequisites

- Node.js 18+ installed
- Odoo 18 instance with `weha_inventory_controller` module installed
- npm or yarn package manager
- (Optional) Android Studio for building APK
- (Optional) Chainway C72 device for RFID features

## Installation

1. **Navigate to the project directory**:
   ```bash
   cd inventory-ui
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_ODOO_URL=http://localhost:8069
   NEXT_PUBLIC_ODOO_DB=your_database_name
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
inventory-ui/
├── app/
│   ├── login/              # Login page
│   ├── dashboard/          # Dashboard with operation type selection
│   ├── pickings/           # Unified picking system
│   │   ├── page.tsx        # Picking list
│   │   └── detail/         # Picking detail with scanning
│   │       └── page.tsx    # Detail page (manual/barcode/RFID)
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page redirect
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── api.ts              # Odoo API service
│   ├── types.ts            # TypeScript type definitions
│   ├── utils.ts            # Utility functions
│   └── rfid.ts             # RFID plugin interface
├── android/                # Capacitor Android platform
│   └── app/src/main/java/com/weha/inventory/rfid/
│       ├── RFIDReaderPlugin.java   # Capacitor RFID plugin
│       └── RFIDManager.java        # Chainway SDK wrapper
├── capacitor-rfid/         # RFID plugin package
│   └── package.json
├── public/                 # Static assets
├── .env.example            # Example environment variables
├── package.json            # Dependencies
├── capacitor.config.ts     # Capacitor configuration
├── next.config.js          # Next.js configuration (static export)
├── tailwind.config.ts      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

## Usage

### Login

1. Open the app at `http://localhost:3000`
2. Enter your Odoo credentials:
   - Database name
   - Username/email
   - Password
3. Click "Sign In"

### Processing Pickings

1. **Select Operation Type**:
   - From dashboard, choose Receipt, Delivery, or Internal Transfer
   - View list of pickings in Ready state

2. **Open Picking Detail**:
   - Click on a picking to view details
   - See all products and required quantities

3. **Choose Input Mode**:
   - **Manual**: Enter quantity and lot number by hand
   - **Barcode**: Scan product/lot barcodes with camera
   - **RFID** (Chainway C72 only): Batch scan RFID tags

4. **Manual Mode**:
   - Select product from dropdown
   - Enter quantity
   - Enter lot/serial number (if required)
   - Click "Add Line"

5. **Barcode Mode**:
   - Click barcode icon to activate scanner
   - Scan product barcode or lot barcode
   - Enter lot number if needed
   - Click "Process Scan"
   - Repeat for each item

6. **RFID Mode** (Chainway C72):
   - Click RFID icon to activate
   - Click "Start RFID Scan"
   - Hold device near RFID tags (batch scanning)
   - Tags appear in real-time list
   - Click "Stop Scanning"
   - Review scanned tags
   - Click "Process X Tags"
   - System creates move lines for all valid tags

7. **Complete Operation**:
   - Review all scanned/entered lines
   - Click "Validate" to complete
   - Picking status changes to Done

### RFID Scanning Details

- **RFID Tag = Lot Number**: Each tag's EPC is a lot name in Odoo
- **1 Lot = 1 Product**: System finds product from lot
- **Quantity = 1**: Each tag represents 1 unit
- **Batch Processing**: Scan multiple tags at once
- **Duplicate Prevention**: System checks for already-scanned lots
- **Error Handling**: Shows success/failure for each tag

## Building for Android

### Web Build (Static Export)

```bash
npm run build
```

Output: `out/` directory

### Android Build

1. **Sync Capacitor**:
   ```bash
   npm run cap:sync
   ```

2. **Open Android Studio**:
   ```bash
   npx cap open android
   ```

3. **Build APK**:
   - Click Build > Build Bundle(s) / APK(s) > Build APK(s)
   - Find APK in `android/app/build/outputs/apk/debug/`

4. **Install on Device**:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### RFID Setup (Chainway C72)

See [RFID_INTEGRATION.md](../RFID_INTEGRATION.md) for complete setup instructions.

**Quick Steps**:
1. Obtain Chainway UHF RFID SDK
2. Add SDK to `android/app/libs/`
3. Update `RFIDManager.java` with actual SDK calls
4. Register plugin in `MainActivity.java`
5. Build and test on device

## Managing Receipts

**Note**: Receipts are now part of the unified picking system.

1. From the dashboard, click on "Receipts"
2. View the list of pending receipts (operation type = incoming)
3. Click on a receipt to view details
4. Use Manual, Barcode, or RFID mode to scan products
5. Click "Validate" to complete the receipt

### Managing Deliveries

**Note**: Deliveries are now part of the unified picking system.

1. From the dashboard, click on "Deliveries"
2. View the list of pending deliveries
3. Click on a delivery to view details
4. Update quantities for each line item
5. Click "Validate" to complete the delivery

### Managing Transfers

1. From the dashboard, click on "Transfers"
2. View the list of pending internal transfers
3. Click on a transfer to view details
4. Update quantities for each line item
5. Click "Validate" to complete the transfer

## API Integration

The app communicates with your Odoo instance through the REST API endpoints provided by the `weha_inventory_controller` module.

### Key API Endpoints

- `POST /api/mobile/auth/login` - User authentication
- `POST /api/mobile/receipts/list` - List receipts
- `POST /api/mobile/receipts/<id>` - Get receipt details
- `POST /api/mobile/receipts/<id>/update` - Update line quantity
- `POST /api/mobile/receipts/<id>/validate` - Validate receipt
- Similar endpoints for deliveries and transfers

## Building for Production

```bash
npm run build
npm start
```

## Development

```bash
# Run development server
npm run dev

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

## Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure your Odoo instance is configured to allow requests from your Next.js app domain.

### Authentication Failures

- Verify your Odoo URL is correct in `.env.local`
- Check database name matches your Odoo instance
- Ensure credentials are correct
- Verify the `weha_inventory_controller` module is installed and activated

### API Connection Issues

- Confirm Odoo server is running
- Check network connectivity
- Verify API endpoints are accessible
- Review browser console for error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please contact your system administrator or open an issue in the repository.

## Roadmap

- [ ] Barcode scanning integration
- [ ] Offline mode support
- [ ] Push notifications
- [ ] Product search functionality
- [ ] Location management
- [ ] Stock level views
- [ ] Report generation
- [ ] Multi-language support

---

Built with ❤️ using Next.js and shadcn/ui
