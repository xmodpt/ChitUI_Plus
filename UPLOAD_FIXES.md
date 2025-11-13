# File Upload Fixes - ChitUI v4

## Summary
Fixed critical issues with the file upload functionality in ChitUI v4, improving thread safety, error handling, and progress tracking.

## Issues Fixed

### 1. Thread-Safety Issue ✓
**Problem:** Global `uploadProgress` variable caused race conditions when multiple users uploaded files simultaneously.

**Solution:**
- Changed `uploadProgress` from a single integer to a dictionary tracking progress per upload session
- Added `uploadProgressLock` (threading.Lock) to protect concurrent access
- Each upload now has a unique upload ID for independent progress tracking

**Files Modified:**
- `main.py` lines 585-588, 449-480, 548-613

### 2. Upload Locking Mechanism ✓
**Problem:** Multiple simultaneous uploads could interfere with each other or overload the server.

**Solution:**
- Added `uploadLock` to prevent concurrent uploads
- Returns HTTP 429 (Too Many Requests) if an upload is already in progress
- Lock is properly released in a `finally` block to prevent deadlocks

**Files Modified:**
- `main.py` lines 493-550

### 3. Frontend Error Handling ✓
**Problem:** Frontend assumed `data.responseJSON.msg` always exists, causing JavaScript errors on network failures.

**Solution:**
- Improved error handling with multiple fallback checks:
  1. Check `xhr.responseJSON.msg`
  2. Try parsing `xhr.responseText`
  3. Fall back to error object or generic message
- Added progress cleanup on error
- Better user-facing error messages

**Files Modified:**
- `chitui.js` lines 761-786

### 4. Progress Tracking Race Condition ✓
**Problem:** EventSource connection established AFTER client-to-server upload completed, potentially missing the start of server-to-printer transfer.

**Solution:**
- Generate unique upload ID on client before starting upload
- Pass upload ID to server in FormData
- Establish EventSource connection at 50% of client upload (before server-to-printer transfer begins)
- EventSource URL includes upload ID: `/progress?upload_id={id}`
- Added error handler to EventSource
- Return EventSource object for proper cleanup

**Files Modified:**
- `chitui.js` lines 692-826

### 5. USB Gadget Error Messages ✓
**Problem:** Generic error messages didn't help users diagnose USB gadget permission issues.

**Solution:**
- Added `USB_GADGET_ERROR` variable to store detailed error information
- Separate error messages for:
  - Permission errors (with chmod command suggestion)
  - General OS errors
  - Missing USB gadget folder (with setup instructions)
- Better logging with visual indicators (✓, ✗, ⚠, ℹ)
- Added `/status` endpoint to check USB gadget status programmatically

**Files Modified:**
- `main.py` lines 50-78, 342-354

## New Features

### Status Endpoint
Added `GET /status` endpoint that returns:
```json
{
  "usb_gadget": {
    "enabled": true/false,
    "path": "/mnt/usb_share",
    "error": "detailed error message or null"
  },
  "upload_folder": "/path/to/uploads",
  "data_folder": "/path/to/.chitui",
  "camera_support": true/false
}
```

### UUID Generation
Added client-side UUID generation for upload tracking:
```javascript
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

## Testing Recommendations

1. **Thread Safety Test:**
   - Open multiple browser tabs
   - Try uploading files from different tabs simultaneously
   - Verify only one upload proceeds at a time
   - Verify progress tracking doesn't mix between uploads

2. **Error Handling Test:**
   - Disconnect network during upload
   - Stop Flask server during upload
   - Verify user sees meaningful error messages
   - Verify progress bar resets properly

3. **USB Gadget Test:**
   - Test with `/mnt/usb_share` not existing
   - Test with read-only permissions on USB gadget folder
   - Verify error messages are clear and actionable
   - Check `/status` endpoint returns correct information

4. **Progress Tracking Test:**
   - Upload a large file (>10MB)
   - Verify "Upload to ChitUI" phase shows correctly
   - Verify "Upload to printer" phase shows correctly
   - Verify progress reaches 100% and resets
   - Check browser console for EventSource errors

## Known Limitations

1. Upload lock is global - only one upload allowed at a time across all users
2. Progress cleanup happens after 100 seconds if upload hangs (prevents memory leaks)
3. Temporary files are deleted after successful upload (no retry mechanism)

## Compatibility

- All changes are backward compatible
- Existing uploads will use default upload_id if not provided
- Frontend gracefully handles missing upload_id in responses
