# 🚀 NEXT STEPS: Integrating DeviceAPI_ver20251103_release.aar

## ✅ What's Already Done

1. ✅ Created `android/app/libs/` directory
2. ✅ Updated `android/app/build.gradle` to include SDK
3. ✅ Registered RFID plugin in `MainActivity.java`
4. ✅ Added required Android permissions to `AndroidManifest.xml`
5. ✅ RFID UI is complete and ready
6. ✅ Backend endpoint `/api/mobile/pickings/<id>/scan-rfid` is ready

## 📋 What You Need To Do Now

### Step 1: Copy SDK File (REQUIRED)

Copy your `DeviceAPI_ver20251103_release.aar` file to:
```
c:\Users\wehac\Projects\Arei\inventory-ui\android\app\libs\DeviceAPI_ver20251103_release.aar
```

**PowerShell command:**
```powershell
Copy-Item "C:\path\to\your\DeviceAPI_ver20251103_release.aar" "c:\Users\wehac\Projects\Arei\inventory-ui\android\app\libs\"
```

### Step 2: Explore SDK Structure

To know what classes and methods are available, you need to inspect the SDK.

**Option A: Extract and Inspect (Quick)**
```powershell
cd c:\Users\wehac\Projects\Arei\inventory-ui\android\app\libs

# AAR files are ZIP files, so we can extract them
Expand-Archive -Path "DeviceAPI_ver20251103_release.aar" -DestinationPath "DeviceAPI_extracted" -Force

# Look inside
ls DeviceAPI_extracted
```

You should see:
- `classes.jar` - Contains the Java classes
- `AndroidManifest.xml` - May show required permissions
- `res/` - Resources (if any)

**Option B: Check Documentation**
- Look for any PDF or documentation that came with the SDK
- Check for sample code or demo apps from Chainway
- Common documentation files: `README.txt`, `API_Guide.pdf`, etc.

### Step 3: Find the Main Classes

Common Chainway SDK patterns - look for these in the extracted JAR:

**Likely package names:**
- `com.chainway.deviceapi.*`
- `com.chainway.uhf.*`
- `com.rscja.deviceapi.*`

**Likely class names:**
- `UHFManager` or `RFIDManager`
- `Device` or `DeviceManager`
- `RFIDReader` or `UHFReader`
- `TagInfo` or `UHFTagInfo`

**To see class names (optional - requires JD-GUI or similar):**
1. Download JD-GUI: http://java-decompiler.github.io/
2. Open `classes.jar` from the extracted folder
3. Browse the package structure

### Step 4: Update RFIDManager.java

Once you know the class names, update this file:
```
c:\Users\wehac\Projects\Arei\inventory-ui\android\app\src\main\java\com\weha\inventory\rfid\RFIDManager.java
```

**Replace the TODO sections with actual SDK calls.**

**Example (adjust based on your actual SDK):**
```java
// Add imports at the top
import com.chainway.deviceapi.UHFManager; // Replace with actual package
import com.chainway.deviceapi.entity.TagInfo; // Replace with actual package
import com.chainway.deviceapi.interfaces.OnInventoryListener; // Replace with actual package

// In initialize() method:
uhfManager = UHFManager.getInstance();
boolean result = uhfManager.init(context);

if (result) {
    uhfManager.setOnInventoryListener(new OnInventoryListener() {
        @Override
        public void onInventoryTag(TagInfo tag) {
            if (callback != null) {
                callback.onTagRead(tag.getEpc(), tag.getRssi());
            }
        }
    });
    return true;
}

// In startScan() method:
return uhfManager.startInventory();

// In stopScan() method:
uhfManager.stopInventory();

// In cleanup() method:
uhfManager.stopInventory();
uhfManager.release();
```

### Step 5: Build and Sync

```powershell
cd c:\Users\wehac\Projects\Arei\inventory-ui

# Sync Capacitor (this copies web assets and updates Android project)
npm run cap:sync
```

### Step 6: Open in Android Studio

```powershell
npx cap open android
```

In Android Studio:
1. Wait for Gradle to sync (check bottom status bar)
2. If there are import errors in `RFIDManager.java`, that means:
   - Either SDK not copied to `libs/` folder
   - Or wrong class names used in imports
3. Fix any errors by adjusting the import statements to match your SDK

### Step 7: Build APK

In Android Studio:
1. Build → Clean Project
2. Build → Rebuild Project
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 8: Install on Chainway C72

**Via USB:**
```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

**Via File Transfer:**
1. Copy APK to device
2. Open file manager on device
3. Install APK (may need to allow unknown sources)

### Step 9: Test RFID Scanning

1. Open the app on Chainway C72
2. Login to Odoo
3. Select Receipt/Delivery/Transfer
4. Open a picking in "Ready" state
5. Click the RFID button (📡 icon)
6. Click "Start RFID Scan"
7. Hold device near RFID tags
8. Tags should appear in the list
9. Click "Stop Scanning"
10. Click "Process X Tags"
11. Check if move lines are created

## 🔍 Troubleshooting

### SDK Not Found Error
**Problem:** `ClassNotFoundException` or import errors in Android Studio

**Solutions:**
1. Verify `DeviceAPI_ver20251103_release.aar` is in `android/app/libs/` folder
2. Check `build.gradle` has: `implementation files('libs/DeviceAPI_ver20251103_release.aar')`
3. Clean and rebuild in Android Studio
4. Sync Gradle: File → Sync Project with Gradle Files

### Wrong Class Names
**Problem:** Cannot import `com.chainway.deviceapi.UHFManager`

**Solutions:**
1. Extract the .aar file and inspect `classes.jar`
2. Use JD-GUI to see actual package and class names
3. Update imports in `RFIDManager.java` to match actual names

### RFID Not Starting
**Problem:** App runs but RFID scan doesn't start

**Solutions:**
1. Check Android logs: `adb logcat | Select-String "RFIDManager"`
2. Look for error messages in logs
3. Verify device has RFID hardware (Chainway C72 should have it)
4. Check if SDK initialization returned false
5. Try rebooting the device

### Tags Not Showing
**Problem:** RFID scan starts but no tags detected

**Solutions:**
1. Verify RFID tags are compatible (UHF EPC Gen2)
2. Check antenna connection (if external antenna)
3. Try adjusting power level in SDK (if supported)
4. Test with known-good tags
5. Check read range (typically 0-5 meters for UHF)

### Callback Not Firing
**Problem:** SDK works but `onTagRead()` never called

**Solutions:**
1. Verify listener is set correctly in `initialize()`
2. Check if you need to set a callback on the reader object
3. Look at Chainway sample code for the correct listener pattern
4. Try different tag reading modes (if SDK supports multiple modes)

## 📚 Helpful Resources

- **See detailed guide:** [CHAINWAY_SDK_SETUP.md](CHAINWAY_SDK_SETUP.md)
- **Full integration docs:** [RFID_INTEGRATION.md](RFID_INTEGRATION.md)
- **Implementation summary:** [RFID_IMPLEMENTATION_SUMMARY.md](RFID_IMPLEMENTATION_SUMMARY.md)

## 💡 Need More Help?

If you can provide:
1. Any documentation that came with `DeviceAPI_ver20251103_release.aar`
2. Sample code or demo apps from Chainway
3. The class structure (by extracting the .aar)
4. Error messages from Android Studio or logcat

I can give you the exact code to use in `RFIDManager.java`!

## 📞 Quick Reference

**Key Files:**
- SDK Location: `android/app/libs/DeviceAPI_ver20251103_release.aar`
- Implementation: `android/app/src/main/java/com/weha/inventory/rfid/RFIDManager.java`
- Gradle: `android/app/build.gradle`
- Manifest: `android/app/src/main/AndroidManifest.xml`

**Commands:**
```powershell
# Copy SDK
Copy-Item "path\to\DeviceAPI_ver20251103_release.aar" "android\app\libs\"

# Extract to inspect
Expand-Archive "android\app\libs\DeviceAPI_ver20251103_release.aar" "android\app\libs\DeviceAPI_extracted"

# Sync
npm run cap:sync

# Open Android Studio
npx cap open android

# View logs
adb logcat | Select-String "RFID"
```

---

**Current Status:** ⏳ Waiting for SDK file to be copied and implementation of `RFIDManager.java`

Once these steps are done, your RFID scanning will be fully functional! 🎉
