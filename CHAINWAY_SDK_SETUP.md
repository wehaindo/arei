# Chainway SDK Integration Steps

## SDK File: DeviceAPI_ver20251103_release.aar

### Step 1: Copy SDK to Project ✅

Copy `DeviceAPI_ver20251103_release.aar` to:
```
inventory-ui/android/app/libs/DeviceAPI_ver20251103_release.aar
```

**Command:**
```powershell
Copy-Item "path\to\DeviceAPI_ver20251103_release.aar" "c:\Users\wehac\Projects\Arei\inventory-ui\android\app\libs\"
```

### Step 2: Gradle Configuration ✅

The `android/app/build.gradle` has been updated with:
```gradle
dependencies {
    // ... other dependencies ...
    
    // Chainway SDK
    implementation files('libs/DeviceAPI_ver20251103_release.aar')
}
```

### Step 3: Plugin Registration ✅

The `MainActivity.java` has been updated to register the RFID plugin:
```java
package com.weha.inventory;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.weha.inventory.rfid.RFIDReaderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(RFIDReaderPlugin.class);
    }
}
```

### Step 4: Explore SDK Structure

First, let's see what's inside the `.aar` file to understand the API:

**Option 1: Android Studio**
1. Open Android Studio
2. File → Project Structure → Dependencies
3. Add the .aar file
4. Android Studio will show available classes

**Option 2: Extract AAR (it's a ZIP file)**
```powershell
# Rename to .zip
Copy-Item "android\app\libs\DeviceAPI_ver20251103_release.aar" "android\app\libs\DeviceAPI.zip"

# Extract
Expand-Archive "android\app\libs\DeviceAPI.zip" "android\app\libs\DeviceAPI_extracted"

# Look at classes.jar
# You can use a Java decompiler like JD-GUI to see the classes
```

**Option 3: Check Chainway Documentation**
- Look for PDF documentation that came with the SDK
- Check for sample code or demo apps
- Common package names:
  - `com.chainway.deviceapi.*`
  - `com.chainway.uhf.*`
  - `com.rscja.deviceapi.*`

### Step 5: Update RFIDManager.java

Once you know the SDK structure, update `RFIDManager.java`.

**Common Chainway Patterns to Look For:**

#### Pattern 1: Singleton Manager
```java
import com.chainway.deviceapi.UHFManager; // Adjust package

UHFManager manager = UHFManager.getInstance();
manager.init(context);
manager.startInventory();
manager.setOnInventoryListener(new OnInventoryListener() {
    @Override
    public void onInventoryTag(TagInfo tag) {
        // tag.getEpc(), tag.getRssi()
    }
});
```

#### Pattern 2: Reader Instance
```java
import com.chainway.deviceapi.Device;
import com.chainway.deviceapi.RFIDReader;

Device device = Device.getInstance();
RFIDReader reader = device.getRFIDReader();
reader.open();
reader.startScan();
```

#### Pattern 3: Serial Port Based
```java
import com.rscja.deviceapi.RFIDWithUHF;

RFIDWithUHF uhf = RFIDWithUHF.getInstance();
uhf.init(); // or uhf.init("/dev/ttyMT1", 115200)
uhf.startInventoryTag();
```

### Step 6: Common Implementation Template

Based on typical Chainway SDKs, update your `RFIDManager.java`:

```java
package com.weha.inventory.rfid;

import android.content.Context;
import android.util.Log;

// TODO: Import actual Chainway classes from DeviceAPI
// Example (adjust based on actual package):
// import com.chainway.deviceapi.UHFManager;
// import com.chainway.deviceapi.entity.TagInfo;
// import com.chainway.deviceapi.interfaces.OnInventoryListener;

public class RFIDManager {
    private static final String TAG = "RFIDManager";
    private RFIDCallback callback;
    // private UHFManager uhfManager; // Uncomment with correct type
    
    public interface RFIDCallback {
        void onTagRead(String epc, int rssi);
        void onError(String error);
    }
    
    public boolean initialize(Context context) {
        try {
            // TODO: Replace with actual initialization
            // Example:
            // uhfManager = UHFManager.getInstance();
            // boolean result = uhfManager.init(context);
            // uhfManager.setOnInventoryListener(new OnInventoryListener() {
            //     @Override
            //     public void onInventoryTag(TagInfo tag) {
            //         if (callback != null) {
            //             callback.onTagRead(tag.getEpc(), tag.getRssi());
            //         }
            //     }
            // });
            // return result;
            
            return false; // Remove when implemented
        } catch (Exception e) {
            Log.e(TAG, "Init failed", e);
            return false;
        }
    }
    
    public boolean startScan() {
        try {
            // TODO: uhfManager.startInventory();
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Start failed", e);
            return false;
        }
    }
    
    public void stopScan() {
        try {
            // TODO: uhfManager.stopInventory();
        } catch (Exception e) {
            Log.e(TAG, "Stop failed", e);
        }
    }
    
    public void setCallback(RFIDCallback callback) {
        this.callback = callback;
    }
    
    public void cleanup() {
        try {
            stopScan();
            // TODO: uhfManager.release();
        } catch (Exception e) {
            Log.e(TAG, "Cleanup failed", e);
        }
    }
}
```

### Step 7: Check for Required Permissions

Chainway devices may need specific permissions. Add to `AndroidManifest.xml` if needed:

```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
```

Location: `inventory-ui/android/app/src/main/AndroidManifest.xml`

### Step 8: Build and Test

```powershell
cd c:\Users\wehac\Projects\Arei\inventory-ui

# Sync Capacitor
npm run cap:sync

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Check if SDK is recognized (no import errors)
3. Build → Build APK
4. Install on Chainway C72
5. Test RFID scanning

### Step 9: Debugging Tips

**If you get ClassNotFoundException:**
- Check that .aar file is in `libs/` folder
- Verify `build.gradle` has the implementation line
- Clean and rebuild: Build → Clean Project → Rebuild Project

**If SDK methods are not found:**
- Extract the .aar and inspect `classes.jar` with JD-GUI
- Check Chainway documentation for correct class names
- Look for sample code in Chainway developer resources

**To see available classes:**
```powershell
# In Android Studio terminal
cd android\app\libs
jar -tf DeviceAPI_ver20251103_release.aar
```

### Step 10: Quick Test

Add this to `RFIDReaderPlugin.java` to test if SDK loads:

```java
@PluginMethod
public void testSDK(PluginCall call) {
    try {
        // Try to load a class from the SDK
        Class.forName("com.chainway.deviceapi.UHFManager"); // Adjust package
        call.resolve(new JSObject().put("success", true).put("message", "SDK loaded"));
    } catch (ClassNotFoundException e) {
        call.reject("SDK not found: " + e.getMessage());
    }
}
```

Then test from the web app to verify SDK is loaded before implementing full functionality.

## Next Steps

1. ✅ SDK file copied to `libs/` folder
2. ✅ Gradle configured
3. ✅ Plugin registered in MainActivity
4. ⏳ **YOU ARE HERE**: Explore SDK structure
5. ⏳ Update RFIDManager.java with actual API calls
6. ⏳ Build and test on device

## Need Help?

If you can share:
- Any documentation that came with the SDK
- Sample code or demo apps
- The package structure (from extracting the .aar)

I can provide more specific implementation code for your exact SDK version.
