![Descrição da imagem](screen1.png)
# ChitUI v4
 

A modern web-based control interface for **Elegoo** resin 3D printers, designed to run on Raspberry Pi with advanced USB gadget support for seamless file management.


![Python](https://img.shields.io/badge/python-3.7+-blue.svg)
![Flask](https://img.shields.io/badge/flask-3.0+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)


## ✨ Features
 

### 🖨️ Printer Management

- **Auto-discovery** of Elegoo printers on your network
- **Manual printer configuration** with IP address
- **Real-time status monitoring** via WebSocket connection
- Support for multiple printers simultaneously
- Persistent printer configurations
 

### 📁 File Upload & Management

- **USB Gadget Mode** - Raspberry Pi appears as USB flash drive to printer
- **Network Transfer Mode** - Upload files directly to printer via network
- **Automatic USB gadget refresh** - No more manual unplugging! (NEW)
- **Intelligent file detection** - Automatic retry until printer sees new files
- **Thread-safe uploads** - Concurrent upload protection
- Support for `.ctb`, `.goo`, and `.prz` file formats
- Real-time upload progress tracking


### 📹 Camera Integration

- **Live RTSP streaming** from printer camera
- **MJPEG stream conversion** for browser compatibility
- Start/stop camera controls
- Compatible with Elegoo printer built-in cameras


### ⚙️ Advanced Features

- **Responsive web UI** - Works on desktop and mobile
- **Dark/Light themes** - Bootstrap 5 with theme switcher
- **Real-time notifications** - Toast messages for upload status
- **WebSocket communication** - Low-latency printer control
- **Settings persistence** - Auto-load saved printers on startup
- **Status endpoint** - `/status` API for debugging
 

## 🚀 USB Gadget Auto-Refresh (NEW!)

One of ChitUI's standout features is **automatic USB gadget refresh**. When you upload a file to your Raspberry Pi configured as a USB drive, ChitUI automatically:


1. Saves the file to the USB gadget folder
2. Detects your USB gadget configuration (legacy or configfs)
3. Triggers a USB reconnection to notify the printer
4. Retries checking until the file appears on the printer
5. Shows success notification when detected


**No more manually unplugging and replugging USB!** 🎉

### Supported USB Gadget Modes

- ✅ **Legacy g_mass_storage module** - Automatic module reload
- ✅ **Modern configfs** - UDC disconnect/reconnect
- ✅ **Automatic detection** - Works with your existing setup


## 📋 Requirements


### Hardware

- **Raspberry Pi** (Zero W, 3, 4, or 5 recommended)
- **Elegoo resin printer** (Saturn, Mars, etc.)
- **Network connection** - WiFi or Ethernet
- **USB cable** (for USB gadget mode)
 

### Software

- **Python 3.7+**
- **Raspberry Pi OS** (Bullseye or newer recommended)
- **USB gadget configured** (optional, for USB mode)

### Python Dependencies

```

flask>=3.0.0

flask-socketio>=5.3.0

werkzeug>=3.0.0

loguru>=0.7.0

requests>=2.31.0

websocket-client>=1.6.0

opencv-python>=4.8.0 (optional, for camera support)

```

 

## 🔧 Installation

 

### Quick Install

 

```bash

# Clone the repository

git clone https://github.com/xmodpt/ChitUI_v4.git

cd ChitUI_v4

 

# Install dependencies

pip3 install flask flask-socketio werkzeug loguru requests websocket-client


# Optional: Install camera support

pip3 install opencv-python


# Run ChitUI

sudo python3 main.py

```

 

### USB Gadget Setup (Optional)


If you want to use your Raspberry Pi as a USB flash drive for the printer:


1. **Run the USB gadget setup script:**

   ```bash

   sudo bash virtual_usb_gadget_fixed.sh

   ```


2. **Follow the prompts** to configure size and settings

 

3. **Connect Pi to printer** via USB data port

 

4. **Start ChitUI as root** for auto-refresh:

   ```bash

   sudo python3 main.py

   ```

 

**Diagnostic tool:**

```bash

bash check_usb_gadget.sh

```

 

## 🎮 Usage

 

### Starting ChitUI

 
```bash

sudo python3 main.py

```
 

The web interface will be available at:

- `http://localhost:8080` (on the Pi)

- `http://<pi-ip-address>:8080` (from other devices)

 

### Connecting Printers


1. **Auto-discovery (recommended):**

   - Click the cloud icon in the top-right corner

   - ChitUI will scan your network for Elegoo printers

   - Discovered printers are automatically saved

 

2. **Manual configuration:**

   - Open Settings (gear icon)

   - Enter printer IP address and details

   - Click "Add Printer"

 

### Uploading Files

 

1. Select your printer from the dropdown

2. Click "Choose File" or drag-and-drop a `.ctb`/`.goo`/`.prz` file

3. Click "Upload"

4. Watch the progress bar

5. Wait for confirmation (USB mode: automatic retry until file appears!)

 

### Camera Streaming

 

1. Select a printer

2. Click "Start Camera" button

3. View live stream in the browser

4. Click "Stop Camera" when done



## 🔍 Troubleshooting

 

### USB Gadget Issues

 

**File not appearing on printer after upload:**

 

1. **Check if running as root:**

   ```bash

   ps aux | grep python3

   ```

   Should show `root` as the user

 

2. **Run diagnostic tool:**

   ```bash

   bash check_usb_gadget.sh

   ```

 

3. **Check USB gadget status:**

   ```bash

   curl http://localhost:8080/status

   ```

 

4. **Manual USB refresh:**

   ```bash

   curl -X POST http://localhost:8080/usb-gadget/refresh

   ```

 

5. **View logs:**

   ChitUI shows detailed logs including USB gadget refresh attempts

 

**Common solutions:**

- Run ChitUI as root: `sudo python3 main.py`

- Check USB cable is in DATA port (not PWR)

- Verify `/mnt/usb_share` is writable

- Restart USB gadget service (see `check_usb_gadget.sh`)

 

### Printer Connection Issues

 

**Printer not discovered:**

- Ensure printer and Pi are on the same network

- Check printer is powered on

- Manually add printer by IP address

 

**WebSocket connection fails:**

- Verify printer IP address is correct

- Check firewall settings on Pi

- Ensure port 3030 is accessible on printer

 

### Camera Issues

 

**Camera stream not working:**

- Install OpenCV: `pip3 install opencv-python`

- Check printer supports RTSP streaming

- Verify RTSP URL: `rtsp://<printer-ip>:554/video`

 

## 📚 Documentation

 

- **[UPLOAD_FIXES.md](UPLOAD_FIXES.md)** - Thread safety and error handling details

- **[USB_GADGET_FIXES.md](USB_GADGET_FIXES.md)** - Complete USB gadget auto-refresh documentation

- **[check_usb_gadget.sh](check_usb_gadget.sh)** - Diagnostic script with troubleshooting guide

 

## 🤝 Contributing

 

Contributions are welcome! Please feel free to submit issues and pull requests.

 

## 📝 Changelog

 

### v4.0 (Latest)

- ✨ Added automatic USB gadget refresh (no more manual unplugging!)

- ✨ Intelligent file detection with retry logic

- 🔒 Thread-safe upload system

- 🐛 Fixed concurrent upload race conditions

- 📊 Enhanced error handling and user feedback

- 🔧 Added diagnostic tools for USB gadget troubleshooting

- 📚 Comprehensive documentation

 

### Previous Versions

- v3.x - Camera streaming support

- v2.x - WebSocket communication

- v1.x - Initial release

 

## 🙏 Acknowledgments

 

- **Elegoo** - For creating excellent resin printers with network APIs

- **Flask & Flask-SocketIO** - For the web framework

- **Bootstrap** - For the UI framework

- **Raspberry Pi Foundation** - For the amazing single-board computers

 

## 📄 License

 

This project is licensed under the MIT License - see the LICENSE file for details.

 

## 💬 Support

 

- **Issues:** [GitHub Issues](https://github.com/xmodpt/ChitUI_v4/issues)

- **Discussions:** [GitHub Discussions](https://github.com/xmodpt/ChitUI_v4/discussions)

 

## ⭐ Star History

 

If you find ChitUI useful, please consider giving it a star on GitHub!

 

---

 

**Made with ❤️ for the 3D printing community**
