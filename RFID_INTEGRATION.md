# RFID Integration for Chainway C72

## Overview
This document describes the RFID integration for the Weha Inventory mobile app on Chainway C72 devices. RFID tags contain lot numbers (EPC = lot number), where each lot refers to exactly one product in Odoo.

## Architecture

### Frontend (Capacitor/Next.js)
- **TypeScript Interface**: `lib/rfid.ts`
  - Defines `RFIDReaderPlugin`, `RFIDTag`, and `RFIDReadResult` types
  - Web fallback for development on non-native platforms

- **UI Component**: `app/pickings/detail/page.tsx`
  - Three input modes: Manual, Barcode, RFID
  - RFID mode supports single or batch tag scanning
  - Real-time tag display with EPC, RSSI, and count
  - Batch processing of multiple tags

- **API Client**: `lib/api.ts`
  - `scanRFIDTags(pickingId, rfidTags[])` method sends RFID EPCs to backend

### Backend (Odoo)
- **Endpoint**: `/api/mobile/pickings/<id>/scan-rfid`
- **Logic**:
  1. Receives array of RFID tag EPCs
  2. For each EPC, searches `stock.lot` by name (EPC = lot name)
  3. Gets product from lot's `product_id`
  4. Finds matching `stock.move` in picking for that product
  5. Creates `stock.move.line` with lot and quantity=1
  6. Returns success/error for each tag

### Native Android (Capacitor Plugin)
- **Plugin**: `RFIDReaderPlugin.java`
  - Capacitor plugin with `@CapacitorPlugin` annotation
  - Methods: `startScan()`, `stopScan()`, `getScanResults()`
  - Tag aggregation with deduplication and count tracking
  - Event listeners for real-time tag notifications

- **SDK Wrapper**: `RFIDManager.java`
  - Wrapper for Chainway SDK (placeholder, needs implementation)
  - Callback interface for tag read events
  - Lifecycle management: initialize, start, stop, cleanup

## Chainway SDK Integration

### Step 1: Obtain Chainway SDK ✅
- **SDK File**: `DeviceAPI_ver20251103_release.aar`
- Version: November 3, 2025 Release
- This is the Chainway Device API for UHF RFID operations

### Step 2: Add SDK to Android Project ✅
```bash
# Copy the SDK file to the libs directory
cd inventory-ui
# Copy DeviceAPI_ver20251103_release.aar to android/app/libs/
```

The SDK dependency has been added to `android/app/build.gradle`:
```gradle
dependencies {
    // ... other dependencies ...
    implementation files('libs/DeviceAPI_ver20251103_release.aar')
}
```

### Step 3: Implement RFIDManager.java ⏳
Replace the TODO sections in `RFIDManager.java` with actual Chainway SDK calls.

**Common Chainway SDK Pattern**:
```java
// Initialize
UHFReader reader = UHFReader.getInstance();
reader.open("/dev/ttyMT1", 115200); // Serial port

// Start scanning
reader.startInventory();

// Read tag callback
reader.setOnTagReadListener(new OnTagReadListener() {
    @Override
    public void onTagRead(String epc, int rssi) {
        callback.onTagRead(epc, rssi);
    }
});

// Stop scanning
reader.stopInventory();

// Cleanup
reader.close();
```

**Update RFIDManager.java**:
```java
import com.chainway.uhf.UHFReader; // Example import
import com.chainway.uhf.OnTagReadListener; // Example import

public class RFIDManager {
    private UHFReader reader;
    
    public boolean initialize(Context context) {
        try {
            reader = UHFReader.getInstance();
            boolean success = reader.open("/dev/ttyMT1", 115200);
            if (success) {
                reader.setOnTagReadListener(new OnTagReadListener() {
                    @Override
                    public void onTagRead(String epc, int rssi) {
                        if (callback != null) {
                            callback.onTagRead(epc, rssi);
                        }
                    }
                    
                    @Override
                    public void onError(String error) {
                        if (callback != null) {
                            callback.onError(error);
                        }
                    }
                });
            }
            return success;
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize RFID reader", e);
            return false;
        }
    }
    
    public boolean startScan() {
        try {
            return reader != null && reader.startInventory();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start scan", e);
            return false;
        }
    }
    
    public void stopScan() {
        try {
            if (reader != null) {
                reader.stopInventory();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop scan", e);
        }
    }
    
    public void cleanup() {
        try {
            if (reader != null) {
                reader.stopInventory();
                reader.close();
                reader = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Cleanup failed", e);
        }
    }
}
```

### Step 4: Add Android Permissions
Update `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<!-- Chainway RFID may need serial port access -->
```

### Step 5: Register Plugin
Update `android/app/src/main/java/com/weha/inventory/MainActivity.java`:
```java
import com.weha.inventory.rfid.RFIDReaderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(RFIDReaderPlugin.class); // Add this line
    }
}
```

### Step 6: Build and Test
```bash
cd inventory-ui
npm run build
npx cap sync
npx cap open android
```

In Android Studio:
1. Build the APK
2. Install on Chainway C72 device
3. Test RFID scanning functionality

## Usage Flow

1. **Navigate to Picking**:
   - Select operation type (Receipt/Delivery/Transfer)
   - Choose a picking in "Ready" state
   - Click to open detail page

2. **Switch to RFID Mode**:
   - Click RFID button in header
   - UI shows RFID scanning panel

3. **Scan Tags**:
   - Click "Start RFID Scan"
   - Hold device near RFID tags
   - Tags appear in real-time list with EPC, RSSI, count

4. **Process Tags**:
   - Click "Stop Scanning" when done
   - Click "Process X Tags" button
   - Backend creates move lines for each valid tag
   - Results show success/error for each tag

5. **Complete Picking**:
   - Review all scanned lines
   - Click "Validate" to complete operation

## Data Flow

```
RFID Tag (EPC: "LOT123")
    ↓
Chainway SDK reads tag
    ↓
RFIDManager.onTagRead("LOT123", -45)
    ↓
RFIDReaderPlugin aggregates tags
    ↓
Frontend displays tag in list
    ↓
User clicks "Process Tags"
    ↓
POST /api/mobile/pickings/123/scan-rfid
    { rfid_tags: ["LOT123", "LOT456", ...] }
    ↓
Backend searches stock.lot by name="LOT123"
    ↓
Gets product from lot.product_id
    ↓
Finds stock.move for that product
    ↓
Creates stock.move.line with lot_id and quantity=1
    ↓
Returns results array
    ↓
Frontend refreshes picking data
```

## Business Logic

- **RFID Tag = Lot Number**: Each RFID EPC is a lot name in Odoo
- **1 Lot = 1 Product**: Each lot references exactly one product
- **Quantity = 1**: Each RFID tag represents 1 unit (no quantity input needed)
- **No Lot Creation**: System only searches existing lots, never creates new ones
- **Duplicate Prevention**: Backend checks if lot already has a move line in the picking
- **Batch Processing**: Multiple tags can be scanned and processed together

## Troubleshooting

### RFID Plugin Not Found
- Ensure `RFIDReaderPlugin.java` is in correct package
- Check plugin registration in MainActivity
- Run `npx cap sync` after adding plugin

### SDK Initialization Failed
- Verify SDK library is in `libs/` folder
- Check serial port path (may differ per device)
- Ensure permissions are granted
- Check Chainway SDK documentation for device-specific setup

### Tags Not Reading
- Verify RFID reader is powered on
- Check antenna connection
- Ensure tags are compatible (UHF EPC Gen2)
- Try different power settings in SDK
- Check read range (typically 0-5 meters)

### Lot Not Found Errors
- Verify lot exists in Odoo with exact EPC as name
- Check product is associated with lot
- Ensure product is in the picking's move list

## Development Notes

- **Web Development**: RFID plugin returns errors on non-native platforms (browser)
- **Testing**: Use Chrome DevTools for frontend debugging
- **Odoo Logs**: Check `/var/log/odoo/odoo.log` for backend errors
- **Android Logs**: Use `adb logcat` or Android Studio Logcat for native debugging
- **SDK Documentation**: Refer to Chainway's official SDK docs for device-specific APIs

## Future Enhancements

- [ ] Power level adjustment in UI
- [ ] Filter tags by RSSI threshold
- [ ] Sound feedback on tag read
- [ ] Vibration feedback
- [ ] Tag write functionality
- [ ] Inventory counting mode
- [ ] Export scanned tags to CSV
- [ ] Offline caching of tag reads
