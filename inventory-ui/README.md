# Inventory Mobile App

A modern Next.js mobile application for managing Odoo 18 inventory operations including receipts, deliveries, and internal transfers.

## Features

- 🔐 **Secure Authentication** - Login with Odoo credentials
- 📦 **Receipt Management** - Process incoming shipments
- 🚚 **Delivery Management** - Handle outgoing shipments
- 🔄 **Internal Transfers** - Manage stock movements
- 📱 **Mobile-First Design** - Optimized for mobile devices
- 🎨 **Modern UI** - Built with shadcn/ui components
- ⚡ **Real-time Updates** - Live data from Odoo

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Backend**: Odoo 18 API

## Prerequisites

- Node.js 18+ installed
- Odoo 18 instance with `weha_inventory_controller` module installed
- npm or yarn package manager

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
│   ├── dashboard/          # Main dashboard
│   ├── receipts/           # Receipt list and detail pages
│   ├── deliveries/         # Delivery list and detail pages
│   ├── transfers/          # Transfer list and detail pages
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── api.ts              # Odoo API service
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Utility functions
├── public/                 # Static assets
├── .env.example            # Example environment variables
├── package.json            # Dependencies
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

### Managing Receipts

1. From the dashboard, click on "Receipts"
2. View the list of pending receipts
3. Click on a receipt to view details
4. Update quantities for each line item
5. Click "Validate" to complete the receipt

### Managing Deliveries

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
