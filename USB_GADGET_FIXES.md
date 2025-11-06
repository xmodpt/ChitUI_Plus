# USB Gadget Upload Improvements

## Summary
Enhanced USB gadget upload functionality to automatically notify the printer when new files are available and implement intelligent retry logic for file detection.

## Issues Fixed

### Issue 1: Printer Doesn't See New Files Without Unplugging/Replugging
**Problem:** After uploading a file to USB gadget mode, the printer doesn't detect the new file until USB is disconnected and reconnected.

**Root Cause:** When files are added to the USB gadget shared folder, the printer (USB host) caches the directory listing and doesn't automatically detect changes.

**Solution:**
- Added `trigger_usb_gadget_refresh()` function that attempts multiple methods to notify the printer:
  1. Syncs filesystem to ensure data is written
  2. Attempts to disconnect/reconnect USB gadget via configfs UDC paths
  3. Tries common Raspberry Pi USB gadget controller paths
  4. Provides helpful error messages if permissions are insufficient

**Files Modified:**
- `main.py` lines 102-159 (new USB gadget helper functions)
- `main.py` lines 608-629 (modified upload endpoint to trigger refresh)
- `main.py` lines 669-696 (new `/usb-gadget/refresh` endpoint)

### Issue 2: App Doesn't Show New Files Without Manual Refresh
**Problem:** After uploading to USB gadget, the web UI doesn't automatically show the new file.

**Root Cause:**
1. File list refresh happened immediately after upload, before printer detected the file
2. No retry logic to wait for printer to poll and detect the new file
3. Same refresh logic used for both network and USB gadget uploads

**Solution:**
- Differentiated upload responses to include `usb_gadget` flag
- Implemented intelligent retry logic specifically for USB gadget uploads:
  - Progressive delays: 2s, 3s, 5s, 7s, 10s (up to 5 attempts)
  - Checks if uploaded file appears in printer's file list
  - Stops retrying when file is detected
  - Shows appropriate user feedback at each stage
- Network uploads use simple single refresh (as before)

**Files Modified:**
- `main.py` lines 618-657 (enhanced upload response format)
- `chitui.js` lines 731-763 (smart upload success handling)
- `chitui.js` lines 832-919 (new retry logic functions)

## New Features

### 1. USB Gadget Auto-Refresh
When a file is uploaded to USB gadget mode, the system automatically attempts to trigger a USB reconnection to notify the printer:

```python
def trigger_usb_gadget_refresh():
    # Syncs filesystem
    os.sync()

    # Attempts to write to USB gadget UDC (USB Device Controller)
    # Disconnects and reconnects to trigger host refresh
```

**Paths Checked:**
- `/sys/kernel/config/usb_gadget/pi4/UDC`
- `/sys/kernel/config/usb_gadget/mass_storage/UDC`
- `/sys/devices/platform/soc/fe980000.usb/gadget/suspended`

**Permission Requirements:**
- Requires root/sudo for automatic refresh
- Falls back gracefully if permissions insufficient
- Provides helpful messages about running as root

### 2. Manual USB Gadget Refresh Endpoint
New API endpoint: `POST /usb-gadget/refresh`

**Response:**
```json
{
  "success": true/false,
  "message": "USB gadget reconnected successfully"
}
```

**Use Case:** Can be called from UI or scripts to manually trigger printer notification

### 3. Intelligent File List Retry Logic
Frontend now implements smart retry logic for USB gadget uploads:

**Retry Schedule:**
- Attempt 1: Wait 2 seconds
- Attempt 2: Wait 3 seconds
- Attempt 3: Wait 5 seconds
- Attempt 4: Wait 7 seconds
- Attempt 5: Wait 10 seconds

**Detection Logic:**
1. Clears cached file list
2. Requests fresh list from printer
3. Waits 1.5s for response
4. Checks if uploaded file appears
5. Retries if not found
6. Shows success message when detected
7. Shows warning if max attempts reached

### 4. Enhanced Upload Response Format
Upload responses now include detailed metadata:

```json
{
  "upload": "success",
  "msg": "File saved to USB gadget. Printer should detect it automatically.",
  "upload_id": "uuid",
  "usb_gadget": true,
  "filename": "model.ctb",
  "refresh_triggered": true
}
```

### 5. Contextual User Feedback
Toast notifications now provide specific guidance based on upload type and refresh status:

**USB Gadget - Refresh Succeeded:**
> ✓ File saved to USB gadget. Checking printer...

**USB Gadget - Refresh Failed:**
> ⚠ File saved. You may need to reconnect USB or refresh on printer.

**USB Gadget - File Detected:**
> ✓ File detected on printer!

**USB Gadget - Max Retries:**
> ⚠ File saved but not detected yet. Try refreshing the printer screen or reconnecting USB.

**Network Upload:**
> ✓ File uploaded successfully!

## User Guide

### For Automatic Detection (Recommended)
1. **Run ChitUI as root:**
   ```bash
   sudo python3 main.py
   ```
2. Upload files normally through the web UI
3. System will automatically trigger USB refresh
4. App will retry file detection and notify when successful

### For Manual Mode (Non-Root)
1. Run ChitUI normally (non-root)
2. Upload file through web UI
3. When prompted, manually:
   - Press refresh button on printer screen, OR
   - Unplug and replug the USB connection
4. App will detect the file and update the list

### Troubleshooting

**File not appearing after upload:**
1. Check if ChitUI is running as root: `ps aux | grep python3`
2. Try manual USB gadget refresh: `curl -X POST http://localhost:8080/usb-gadget/refresh`
3. Check USB gadget is properly configured: `ls /sys/kernel/config/usb_gadget/`
4. Verify USB cable is connected between Pi and printer
5. Try refreshing on printer's touchscreen
6. As last resort: disconnect and reconnect USB cable

**Permission errors:**
- Error message: "No permission to write to UDC path"
- Solution: Run as root with `sudo python3 main.py`

**USB gadget not detected:**
- Error message: "USB gadget not found at /mnt/usb_share"
- Solution:
  1. Set up USB gadget mode on Raspberry Pi
  2. Mount gadget at `/mnt/usb_share`
  3. Or set `USB_GADGET_PATH` environment variable

## Technical Details

### USB Gadget Refresh Mechanism
The USB gadget refresh works by writing to the UDC (USB Device Controller) sysfs file:

1. **Read current UDC value:**
   ```python
   with open(udc_path, 'r') as f:
       udc_value = f.read().strip()  # e.g., "fe980000.usb"
   ```

2. **Disconnect (write empty string):**
   ```python
   with open(udc_path, 'w') as f:
       f.write('')  # Disconnects USB gadget
   ```

3. **Wait 500ms** for disconnect to complete

4. **Reconnect (write original value):**
   ```python
   with open(udc_path, 'w') as f:
       f.write(udc_value)  # Reconnects USB gadget
   ```

This simulates unplugging and replugging the USB cable, causing the printer to re-enumerate the USB device and refresh its file list.

### Retry Logic Algorithm
```javascript
function refreshFileListWithRetry(filename, attemptNumber) {
  if (attemptNumber >= 5) {
    showWarning();
    return;
  }

  var delay = [2000, 3000, 5000, 7000, 10000][attemptNumber];

  setTimeout(() => {
    refreshFileList();

    setTimeout(() => {
      if (fileDetected(filename)) {
        showSuccess();
      } else {
        refreshFileListWithRetry(filename, attemptNumber + 1);
      }
    }, 1500);
  }, delay);
}
```

Total time: ~2s + 3s + 5s + 7s + 10s = **27 seconds max** before giving up

## Testing Checklist

### USB Gadget Mode (Run as Root)
- [ ] Upload file to USB gadget
- [ ] Verify "Checking printer..." message appears
- [ ] Verify file appears in UI within 30 seconds
- [ ] Verify "File detected on printer!" message appears
- [ ] Verify progress bar completes and resets
- [ ] Check console logs for successful UDC write

### USB Gadget Mode (Run as Non-Root)
- [ ] Upload file to USB gadget
- [ ] Verify warning message about manual refresh
- [ ] Manually refresh on printer screen
- [ ] Verify file appears in UI after refresh
- [ ] Check console logs for permission warnings

### Network Mode
- [ ] Upload file via network
- [ ] Verify "File uploaded successfully!" message
- [ ] Verify file appears in UI within 2 seconds
- [ ] Verify no retry logic is triggered

### Manual Refresh Endpoint
- [ ] Call `POST /usb-gadget/refresh`
- [ ] Verify response indicates success or failure
- [ ] Verify appropriate error messages if not in USB gadget mode

## Performance Impact

- **Minimal** - USB refresh takes ~500ms
- **Frontend retries** happen in background, don't block UI
- **Network uploads** unchanged - no performance impact
- **Memory usage** - no significant increase

## Compatibility

- Requires Linux with configfs support for automatic refresh
- Falls back gracefully on systems without USB gadget support
- Frontend retry logic works on all browsers
- Backend changes are backward compatible

## Future Improvements

1. **Configurable retry delays** - allow users to customize timing
2. **Real-time notifications** - use WebSocket to push file detection events
3. **Automatic UDC detection** - scan for available UDC paths dynamically
4. **File upload queue** - support multiple concurrent uploads
5. **Upload history** - track recent uploads and their detection status
