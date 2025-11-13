from flask import Flask, Response, request, stream_with_context, jsonify, send_file, render_template_string
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO
from threading import Thread
from loguru import logger
import socket
import json
import os
import websocket
import time
import sys
import requests
import hashlib
import uuid
import threading
import subprocess

# Plugin system imports
from plugins import PluginManager

# Camera imports
try:
    import cv2
    CAMERA_SUPPORT = True
except ImportError:
    CAMERA_SUPPORT = False
    logger.warning("Camera support not available - install opencv-python")

debug = False
log_level = "INFO"
if os.environ.get("DEBUG"):
    debug = True
    log_level = "DEBUG"

logger.remove()
logger.add(sys.stdout, colorize=debug, level=log_level)

port = 8080
if os.environ.get("PORT") is not None:
    port = int(os.environ.get("PORT"))

discovery_timeout = 1
app = Flask(__name__,
            static_url_path='',
            static_folder='web')
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*")
websockets = {}
printers = {}

# ===== Plugin System =====
plugin_manager = PluginManager(os.path.join(os.path.dirname(__file__), 'plugins'))

# ===== Storage Configuration =====
# USB Gadget folder - where files are saved so printer can access them as USB storage
USB_GADGET_FOLDER = os.environ.get('USB_GADGET_PATH', '/mnt/usb_share')

# Check if USB gadget is available and writable
USE_USB_GADGET = False
USB_GADGET_ERROR = None

if os.path.exists(USB_GADGET_FOLDER):
    # Test if writable
    test_file = os.path.join(USB_GADGET_FOLDER, '.write_test')
    try:
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        logger.info(f"✓ USB gadget found and writable at {USB_GADGET_FOLDER}")
        UPLOAD_FOLDER = USB_GADGET_FOLDER
        USE_USB_GADGET = True
    except PermissionError as e:
        USB_GADGET_ERROR = f"Permission denied - USB gadget folder is not writable. Check permissions: sudo chmod 777 {USB_GADGET_FOLDER}"
        logger.error(f"✗ {USB_GADGET_ERROR}")
        logger.warning("⚠ Files will be uploaded directly to printer via network instead")
        USE_USB_GADGET = False
    except OSError as e:
        USB_GADGET_ERROR = f"USB gadget folder exists but cannot be used: {e}"
        logger.error(f"✗ {USB_GADGET_ERROR}")
        logger.warning("⚠ Files will be uploaded directly to printer via network instead")
        USE_USB_GADGET = False
else:
    USB_GADGET_ERROR = f"USB gadget not found at {USB_GADGET_FOLDER}. To enable USB gadget mode, create this folder and mount your USB gadget device there."
    logger.warning(f"⚠ {USB_GADGET_ERROR}")
    logger.info("ℹ Files will be uploaded directly to printer via network")
    USE_USB_GADGET = False

# Data folder for settings
DATA_FOLDER = os.path.expanduser('~/.chitui')
if not USE_USB_GADGET:
    UPLOAD_FOLDER = os.path.join(DATA_FOLDER, 'uploads')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'ctb', 'goo', 'prz'}
SETTINGS_FILE = os.path.join(DATA_FOLDER, 'chitui_settings.json')

# Create directories if they don't exist
os.makedirs(DATA_FOLDER, exist_ok=True)

logger.info(f"Data folder: {DATA_FOLDER}")
logger.info(f"Upload folder: {UPLOAD_FOLDER}")
logger.info(f"Settings file: {SETTINGS_FILE}")
# ===== END CONFIG =====

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# ===== USB GADGET HELPER FUNCTIONS =====

def trigger_usb_gadget_refresh():
    """
    Trigger USB gadget to refresh/reconnect so the printer detects new files.
    This attempts multiple methods to signal the host that the storage has changed.
    """
    if not USE_USB_GADGET:
        logger.warning("USB gadget is not enabled, skipping refresh")
        return False

    try:
        # Method 1: Ensure all data is written to disk
        os.sync()
        logger.debug("Synced filesystem")

        # Method 2: Try to find and use configfs UDC paths
        configfs_gadget_dirs = []
        configfs_base = '/sys/kernel/config/usb_gadget'

        if os.path.exists(configfs_base):
            try:
                configfs_gadget_dirs = [os.path.join(configfs_base, d) for d in os.listdir(configfs_base)]
            except:
                pass

        # Add known UDC paths
        gadget_paths = []
        for gadget_dir in configfs_gadget_dirs:
            udc_path = os.path.join(gadget_dir, 'UDC')
            if os.path.exists(udc_path):
                gadget_paths.append(udc_path)

        # Also try common hardcoded paths
        gadget_paths.extend([
            '/sys/kernel/config/usb_gadget/pi4/UDC',
            '/sys/kernel/config/usb_gadget/mass_storage/UDC',
            '/sys/kernel/config/usb_gadget/g1/UDC',
        ])

        for udc_path in gadget_paths:
            if os.path.exists(udc_path):
                try:
                    # Read current UDC value
                    with open(udc_path, 'r') as f:
                        udc_value = f.read().strip()

                    if udc_value and udc_value != '' and udc_value != 'none':
                        # Disconnect and reconnect
                        logger.info(f"Attempting USB gadget reconnect via {udc_path}")

                        # Disconnect
                        with open(udc_path, 'w') as f:
                            f.write('')
                        time.sleep(0.5)

                        # Reconnect
                        with open(udc_path, 'w') as f:
                            f.write(udc_value)

                        logger.info("✓ USB gadget reconnected successfully")
                        return True
                except PermissionError:
                    logger.warning(f"No permission to write to {udc_path}")
                    logger.info("💡 Run ChitUI as root: sudo python3 main.py")
                except Exception as e:
                    logger.debug(f"Could not use {udc_path}: {e}")

        # Method 3: Try to find UDC via /sys/class/udc
        udc_class_dir = '/sys/class/udc'
        if os.path.exists(udc_class_dir):
            try:
                udcs = os.listdir(udc_class_dir)
                if udcs:
                    logger.info(f"Found UDC controllers: {udcs}")
                    logger.info("⚠ UDC found but cannot trigger refresh without configfs access")
            except:
                pass

        # Method 4: Try legacy g_mass_storage module reload
        mass_storage_params = '/sys/module/g_mass_storage/parameters'
        if os.path.exists(mass_storage_params):
            logger.info("Detected legacy g_mass_storage module - attempting reload...")
            try:
                # Read the current module parameters
                file_param = os.path.join(mass_storage_params, 'file')
                if os.path.exists(file_param):
                    with open(file_param, 'r') as f:
                        usb_file = f.read().strip()

                    logger.info(f"USB file: {usb_file}")

                    # Reload the module to trigger reconnection
                    logger.info("Unloading g_mass_storage module...")
                    subprocess.run(['modprobe', '-r', 'g_mass_storage'], check=False, capture_output=True)
                    time.sleep(1)

                    logger.info("Reloading g_mass_storage module...")
                    # Use the parameters from your virtual_usb_gadget_fixed.sh
                    result = subprocess.run([
                        'modprobe', 'g_mass_storage',
                        f'file={usb_file}',
                        'stall=0',
                        'ro=0',
                        'removable=1',
                        'idVendor=0x0951',
                        'idProduct=0x1666',
                        'iManufacturer=Kingston',
                        'iProduct=DataTraveler',
                        'iSerialNumber=74A53CDF'
                    ], check=False, capture_output=True)

                    if result.returncode == 0:
                        logger.info("✓ USB gadget module reloaded successfully")
                        return True
                    else:
                        logger.warning(f"Failed to reload module: {result.stderr.decode()}")
                        return False

            except PermissionError:
                logger.warning("No permission to reload g_mass_storage module")
                logger.info("💡 Run ChitUI as root: sudo python3 main.py")
                return False
            except Exception as e:
                logger.error(f"Error reloading g_mass_storage: {e}")
                return False

        # No method worked
        logger.info("⚠ Could not trigger USB gadget reconnect - printer will need to poll for changes")
        logger.info("💡 Options:")
        logger.info("   1. Run ChitUI as root: sudo python3 main.py")
        logger.info("   2. Manually refresh on printer screen")
        logger.info("   3. Reconnect USB cable between Pi and printer")
        return False

    except Exception as e:
        logger.error(f"Error triggering USB gadget refresh: {e}")
        return False

# ===== END USB GADGET HELPERS =====


# Camera globals
camera_stream_active = False
camera_latest_frame = None
camera_frame_lock = threading.Lock()
camera_instance = None
camera_printer_ip = None


# ============ CAMERA CLASSES ============

class RTSPCamera:
    def __init__(self, printer_ip):
        self.rtsp_url = f"rtsp://{printer_ip}:554/video"
        self.cap = None
        self.running = False
        
    def start(self):
        self.running = True
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;udp'
        
        logger.info(f"Connecting to camera: {self.rtsp_url}")
        
        try:
            self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
            
            if not self.cap.isOpened():
                logger.error("Failed to open camera stream")
                return False
            
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Try to read first frame
            for i in range(10):
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    logger.info(f"Camera connected: {frame.shape}")
                    return True
                time.sleep(0.5)
            
            logger.error("No frames received from camera")
            return False
            
        except Exception as e:
            logger.error(f"Camera error: {e}")
            return False
    
    def read(self):
        if not self.cap or not self.running:
            return False, None
        
        # Skip frames to reduce latency
        for _ in range(3):
            self.cap.grab()
        
        ret, frame = self.cap.retrieve()
        return ret, frame
    
    def stop(self):
        self.running = False
        try:
            if self.cap:
                self.cap.release()
                self.cap = None
        except Exception as e:
            logger.error(f"Error releasing camera: {e}")


def camera_capture_frames():
    global camera_latest_frame, camera_stream_active, camera_instance
    
    logger.info("Camera capture thread started")
    frame_count = 0
    
    while camera_stream_active and camera_instance:
        try:
            ret, frame = camera_instance.read()
            
            if ret and frame is not None:
                # Resize for web streaming
                frame = cv2.resize(frame, (640, 480))
                ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                
                if ret:
                    with camera_frame_lock:
                        camera_latest_frame = buffer.tobytes()
                    frame_count += 1
                    
        except Exception as e:
            logger.error(f"Camera capture error: {e}")
            break
    
    logger.info(f"Camera capture stopped. Total frames: {frame_count}")


def camera_generate():
    global camera_latest_frame, camera_stream_active
    
    last_frame = None
    
    while camera_stream_active:
        with camera_frame_lock:
            frame = camera_latest_frame
        
        if frame and frame != last_frame:
            last_frame = frame
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        else:
            time.sleep(0.01)


# ============ CAMERA ROUTES ============

@app.route('/camera/start', methods=['POST'])
def camera_start():
    global camera_stream_active, camera_instance, camera_latest_frame, camera_printer_ip
    
    if not CAMERA_SUPPORT:
        return jsonify({'ok': False, 'msg': 'Camera support not installed. Run: pip install opencv-python'})
    
    if camera_stream_active:
        return jsonify({'ok': False, 'msg': 'Camera already running'})
    
    try:
        # Get printer IP from first available printer or use saved printer
        if not printers:
            return jsonify({'ok': False, 'msg': 'No printers connected'})
        
        # Use the first printer's IP
        first_printer = next(iter(printers.values()))
        camera_printer_ip = first_printer['ip']
        
        logger.info(f"Starting camera for printer: {camera_printer_ip}")
        
        camera_latest_frame = None
        camera_instance = RTSPCamera(camera_printer_ip)
        
        if camera_instance.start():
            camera_stream_active = True
            Thread(target=camera_capture_frames, daemon=True).start()
            time.sleep(1)  # Give it a moment to capture first frame
            return jsonify({'ok': True})
        else:
            camera_stream_active = False
            camera_instance = None
            return jsonify({'ok': False, 'msg': 'Could not connect to camera. Is the printer printing?'})
            
    except Exception as e:
        logger.error(f"Error starting camera: {e}")
        camera_stream_active = False
        camera_instance = None
        return jsonify({'ok': False, 'msg': str(e)})


@app.route('/camera/stop', methods=['POST'])
def camera_stop():
    global camera_stream_active, camera_instance, camera_latest_frame
    
    try:
        # Stop the stream first
        camera_stream_active = False
        
        # Give the camera thread a moment to stop
        time.sleep(0.2)
        
        camera_latest_frame = None
        
        if camera_instance:
            try:
                camera_instance.stop()
            except Exception as e:
                logger.error(f"Error stopping camera instance: {e}")
            camera_instance = None
        
        logger.info("Camera stopped")
        return jsonify({'ok': True})
    except Exception as e:
        logger.error(f"Error in camera_stop: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/camera/video')
def camera_video():
    if not camera_stream_active:
        return Response('Camera not active', status=404)
    return Response(camera_generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/thumbnail/<printer_id>')
def proxy_thumbnail(printer_id):
    """Proxy thumbnail images from printer to avoid CORS issues"""
    try:
        thumbnail_url = request.args.get('url')
        if not thumbnail_url:
            return Response('No thumbnail URL provided', status=400)

        # Fetch the thumbnail from the printer
        import requests
        response = requests.get(thumbnail_url, timeout=10)

        if response.status_code == 200:
            # Return the image with appropriate content type
            content_type = response.headers.get('Content-Type', 'image/bmp')
            return Response(response.content, mimetype=content_type)
        else:
            logger.error(f"Failed to fetch thumbnail: {response.status_code}")
            return Response('Failed to fetch thumbnail', status=response.status_code)
    except Exception as e:
        logger.error(f"Error proxying thumbnail: {e}")
        return Response(f'Error: {str(e)}', status=500)


# ============ SETTINGS FUNCTIONS ============

def load_settings():
    """Load settings from persistent storage"""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                settings = json.load(f)
                logger.info(f"Loaded settings: {len(settings.get('printers', {}))} printers configured")
                return settings
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
    return {"printers": {}, "auto_discover": False}


def save_settings(settings):
    """Save settings to persistent storage"""
    try:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
        logger.info(f"Settings saved successfully to {SETTINGS_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        return False


# ============ WEB ROUTES ============

@app.after_request
def add_no_cache_headers(response):
    """Add no-cache headers to JavaScript and CSS files to prevent caching issues"""
    if request.path.endswith(('.js', '.css', '.html')):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route("/")
def web_index():
    return app.send_static_file('index.html')


@app.route('/settings', methods=['GET'])
def get_settings():
    """Get current settings"""
    settings = load_settings()
    return jsonify(settings)


@app.route('/settings', methods=['POST'])
def update_settings():
    """Update settings"""
    try:
        settings = request.json
        if save_settings(settings):
            return jsonify({"success": True, "message": "Settings saved successfully"})
        else:
            return jsonify({"success": False, "message": "Failed to save settings"}), 500
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/status', methods=['GET'])
def get_status():
    """Get application status including USB gadget info"""
    return jsonify({
        "usb_gadget": {
            "enabled": USE_USB_GADGET,
            "path": USB_GADGET_FOLDER if USE_USB_GADGET else None,
            "error": USB_GADGET_ERROR
        },
        "upload_folder": UPLOAD_FOLDER,
        "data_folder": DATA_FOLDER,
        "camera_support": CAMERA_SUPPORT
    })


@app.route('/python-packages', methods=['GET'])
def get_python_packages():
    """Get list of installed Python packages with versions"""
    try:
        # Run pip list to get installed packages
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'list', '--format=json'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            logger.error(f"Error getting packages: {result.stderr}")
            return jsonify({
                "success": False,
                "error": "Failed to retrieve packages",
                "stderr": result.stderr
            }), 500

        packages = json.loads(result.stdout)

        # Sort packages by name
        packages_sorted = sorted(packages, key=lambda x: x['name'].lower())

        return jsonify({
            "success": True,
            "packages": packages_sorted,
            "count": len(packages_sorted)
        })

    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "error": "Timeout while retrieving packages"
        }), 500
    except Exception as e:
        logger.error(f"Error getting Python packages: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ===== Maintenance API =====

@app.route('/maintenance/restart', methods=['POST'])
def restart_application():
    """Restart the ChitUI application"""
    try:
        logger.warning("Application restart requested by user")

        def do_restart():
            """Exit with code 42 to signal restart to wrapper script"""
            import time

            # Give time for the HTTP response to be sent
            time.sleep(2)

            logger.info("Exiting for restart (exit code 42)...")
            logger.info("If using run.sh, the application will restart automatically")

            # Exit with code 42 - the run.sh wrapper will catch this and restart
            os._exit(42)

        # Start the restart in a background thread
        Thread(target=do_restart, daemon=True).start()

        return jsonify({
            "success": True,
            "message": "Application is restarting..."
        })
    except Exception as e:
        logger.error(f"Error restarting application: {e}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


@app.route('/maintenance/reboot', methods=['POST'])
def reboot_system():
    """Reboot the Raspberry Pi system"""
    try:
        logger.warning("System reboot requested by user")

        def do_reboot():
            """Reboot the system after a short delay"""
            import time
            time.sleep(2)
            logger.info("Rebooting system...")
            subprocess.run(['sudo', 'reboot'], check=False)

        # Start the reboot in a background thread
        Thread(target=do_reboot, daemon=True).start()

        return jsonify({
            "success": True,
            "message": "System is rebooting..."
        })
    except Exception as e:
        logger.error(f"Error rebooting system: {e}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


# ===== Plugin Management API =====

@app.route('/plugins', methods=['GET'])
def get_plugins():
    """Get list of all plugins"""
    return jsonify(plugin_manager.get_plugin_info())


@app.route('/plugins/<plugin_id>/enable', methods=['POST'])
def enable_plugin(plugin_id):
    """Enable a plugin"""
    try:
        plugin_manager.enable_plugin(plugin_id)
        # Load the plugin if not already loaded
        if plugin_id not in plugin_manager.get_all_plugins():
            plugin_manager.load_plugin(plugin_id, app, socketio)
        return jsonify({"success": True, "message": f"Plugin {plugin_id} enabled"})
    except Exception as e:
        logger.error(f"Error enabling plugin {plugin_id}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/plugins/<plugin_id>/disable', methods=['POST'])
def disable_plugin(plugin_id):
    """Disable a plugin"""
    try:
        plugin_manager.disable_plugin(plugin_id)
        return jsonify({"success": True, "message": f"Plugin {plugin_id} disabled"})
    except Exception as e:
        logger.error(f"Error disabling plugin {plugin_id}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/plugins/<plugin_id>/delete', methods=['POST'])
def delete_plugin(plugin_id):
    """Delete a plugin"""
    try:
        import shutil
        plugin_path = os.path.join(plugin_manager.plugins_dir, plugin_id)
        if os.path.exists(plugin_path):
            # Disable first
            plugin_manager.disable_plugin(plugin_id)
            # Delete directory
            shutil.rmtree(plugin_path)
            return jsonify({"success": True, "message": f"Plugin {plugin_id} deleted"})
        else:
            return jsonify({"success": False, "message": "Plugin not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting plugin {plugin_id}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/plugins/upload', methods=['POST'])
def upload_plugin():
    """Upload and install a plugin from ZIP file"""
    import zipfile
    import tempfile

    try:
        if 'plugin' not in request.files:
            return jsonify({"success": False, "message": "No plugin file provided"}), 400

        plugin_file = request.files['plugin']

        if plugin_file.filename == '':
            return jsonify({"success": False, "message": "No file selected"}), 400

        if not plugin_file.filename.endswith('.zip'):
            return jsonify({"success": False, "message": "Plugin must be a ZIP file"}), 400

        # Create temp directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, 'plugin.zip')
            plugin_file.save(zip_path)

            # Extract ZIP
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # Find the plugin directory (should be the only directory in temp_dir)
            extracted_items = [item for item in os.listdir(temp_dir) if item != 'plugin.zip']

            if len(extracted_items) != 1 or not os.path.isdir(os.path.join(temp_dir, extracted_items[0])):
                return jsonify({
                    "success": False,
                    "message": "Invalid plugin structure. ZIP must contain a single directory."
                }), 400

            plugin_dir_name = extracted_items[0]
            extracted_plugin_path = os.path.join(temp_dir, plugin_dir_name)

            # Validate plugin structure
            manifest_path = os.path.join(extracted_plugin_path, 'plugin.json')
            init_path = os.path.join(extracted_plugin_path, '__init__.py')

            if not os.path.exists(manifest_path):
                return jsonify({
                    "success": False,
                    "message": "Invalid plugin: missing plugin.json"
                }), 400

            if not os.path.exists(init_path):
                return jsonify({
                    "success": False,
                    "message": "Invalid plugin: missing __init__.py"
                }), 400

            # Read and validate manifest
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)

            required_fields = ['name', 'version', 'author']
            for field in required_fields:
                if field not in manifest:
                    return jsonify({
                        "success": False,
                        "message": f"Invalid plugin.json: missing '{field}' field"
                    }), 400

            # Check if plugin already exists
            target_path = os.path.join(plugin_manager.plugins_dir, plugin_dir_name)
            if os.path.exists(target_path):
                return jsonify({
                    "success": False,
                    "message": f"Plugin '{plugin_dir_name}' already exists. Delete it first to reinstall."
                }), 409

            # Copy plugin to plugins directory
            import shutil
            shutil.copytree(extracted_plugin_path, target_path)

            logger.info(f"Plugin {plugin_dir_name} installed successfully")

            return jsonify({
                "success": True,
                "message": f"Plugin '{manifest['name']}' installed successfully. Reload the page to use it.",
                "plugin_id": plugin_dir_name,
                "plugin_name": manifest['name']
            })

    except zipfile.BadZipFile:
        return jsonify({"success": False, "message": "Invalid ZIP file"}), 400
    except json.JSONDecodeError:
        return jsonify({"success": False, "message": "Invalid plugin.json format"}), 400
    except Exception as e:
        logger.error(f"Error uploading plugin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/plugins/ui', methods=['GET'])
def get_plugin_ui():
    """Get UI integration for all loaded plugins"""
    ui_elements = []
    for plugin_name, plugin in plugin_manager.get_all_plugins().items():
        ui_config = plugin.get_ui_integration()
        if ui_config:
            template_file = ui_config.get('template')
            if template_file:
                template_path = os.path.join(plugin.get_template_folder(), template_file)
                if os.path.exists(template_path):
                    with open(template_path, 'r') as f:
                        ui_config['html'] = f.read()

            ui_config['plugin_id'] = plugin_name
            ui_elements.append(ui_config)

    return jsonify(ui_elements)


@app.route('/discover', methods=['POST'])
def manual_discover():
    """Manually trigger printer discovery"""
    try:
        discovered = discover_printers()
        if discovered and len(discovered) > 0:
            settings = load_settings()
            for printer_id, printer in discovered.items():
                settings["printers"][printer_id] = {
                    "ip": printer["ip"],
                    "name": printer["name"],
                    "model": printer.get("model", "Unknown"),
                    "brand": printer.get("brand", "Unknown"),
                    "enabled": settings["printers"].get(printer_id, {}).get("enabled", True),
                    "manual": False
                }
            save_settings(settings)
            
            connect_printers(discovered)
            socketio.emit('printers', printers)
            
            return jsonify({"success": True, "printers": discovered, "count": len(discovered)})
        else:
            return jsonify({"success": False, "message": "No printers discovered"}), 404
    except Exception as e:
        logger.error(f"Error during discovery: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/printer/manual', methods=['POST'])
def add_manual_printer():
    """Add a printer manually by IP"""
    try:
        data = request.json
        printer_ip = data.get('ip')
        printer_name = data.get('name', f'Printer-{printer_ip}')
        
        if not printer_ip:
            return jsonify({"success": False, "message": "IP address required"}), 400
        
        printer_id = hashlib.md5(printer_ip.encode()).hexdigest()
        
        settings = load_settings()
        if printer_id in settings.get("printers", {}):
            return jsonify({"success": False, "message": "Printer already exists"}), 400
        
        printer = {
            'connection': printer_id,
            'name': printer_name,
            'model': 'Manual',
            'brand': 'Unknown',
            'ip': printer_ip,
            'protocol': 'Unknown',
            'firmware': 'Unknown'
        }
        
        printers[printer_id] = printer
        
        settings["printers"][printer_id] = {
            "ip": printer_ip,
            "name": printer_name,
            "model": "Manual",
            "brand": "Unknown",
            "enabled": True,
            "manual": True
        }
        save_settings(settings)
        
        url = f"ws://{printer_ip}:3030/websocket"
        logger.info(f"Attempting to connect to printer at {url}")
        
        websocket.setdefaulttimeout(2)
        ws = websocket.WebSocketApp(url,
                                    on_message=ws_msg_handler,
                                    on_open=lambda _: ws_connected_handler(printer['name']),
                                    on_close=lambda _, s, m: logger.info(
                                        "Connection to '{n}' closed: {m} ({s})".format(n=printer['name'], m=m, s=s)),
                                    on_error=lambda _, e: logger.warning(
                                        "Connection to '{n}' error: {e}".format(n=printer['name'], e=e))
                                    )
        websockets[printer_id] = ws
        Thread(target=lambda: ws.run_forever(reconnect=1), daemon=True).start()
        
        time.sleep(0.5)
        
        socketio.emit('printers', printers)
        return jsonify({"success": True, "printer": printer, "printer_id": printer_id})
    except Exception as e:
        logger.error(f"Error adding manual printer: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/printer/<printer_id>', methods=['DELETE'])
def remove_printer(printer_id):
    """Remove a printer"""
    try:
        if printer_id in websockets:
            websockets[printer_id].close()
            del websockets[printer_id]
        
        if printer_id in printers:
            del printers[printer_id]
        
        settings = load_settings()
        if printer_id in settings["printers"]:
            del settings["printers"][printer_id]
            save_settings(settings)
        
        socketio.emit('printers', printers)
        return jsonify({"success": True, "message": "Printer removed"})
    except Exception as e:
        logger.error(f"Error removing printer: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ============ FILE UPLOAD ROUTES ============

@app.route('/progress')
def progress():
    """Server-sent events for upload progress"""
    upload_id = request.args.get('upload_id', 'default')

    def publish_progress():
        max_iterations = 200  # Prevent infinite loop (100 seconds max)
        iterations = 0

        while iterations < max_iterations:
            with uploadProgressLock:
                current_progress = uploadProgress.get(upload_id, 0)

            yield "data:{p}\n\n".format(p=current_progress)

            if current_progress >= 100:
                # Clean up this upload's progress after sending 100%
                time.sleep(1)
                with uploadProgressLock:
                    if upload_id in uploadProgress:
                        del uploadProgress[upload_id]
                break

            time.sleep(0.5)
            iterations += 1

        # Final cleanup in case loop exited due to timeout
        with uploadProgressLock:
            if upload_id in uploadProgress:
                del uploadProgress[upload_id]

    return Response(publish_progress(), mimetype="text/event-stream")


@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        # Check if another upload is in progress
        if not uploadLock.acquire(blocking=False):
            logger.warning("Upload already in progress")
            return Response('{"upload": "error", "msg": "Another upload is already in progress. Please wait."}', status=429, mimetype="application/json")

        try:
            if 'file' not in request.files:
                logger.error("No 'file' parameter in request.")
                return Response('{"upload": "error", "msg": "Malformed request - no file."}', status=400, mimetype="application/json")
            file = request.files['file']
            if file.filename == '':
                logger.error('No file selected to be uploaded.')
                return Response('{"upload": "error", "msg": "No file selected."}', status=400, mimetype="application/json")
            form_data = request.form.to_dict()
            if 'printer' not in form_data or form_data['printer'] == "":
                logger.error("No 'printer' parameter in request.")
                return Response('{"upload": "error", "msg": "Malformed request - no printer."}', status=400, mimetype="application/json")
            printer = printers[form_data['printer']]
            if file and not allowed_file(file.filename):
                logger.error("Invalid filetype.")
                return Response('{"upload": "error", "msg": "Invalid filetype."}', status=400, mimetype="application/json")

            # Generate unique upload ID for progress tracking
            upload_id = form_data.get('upload_id', str(uuid.uuid4()))

            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            logger.info(f"Saving '{filename}' to {filepath} (upload_id: {upload_id})")
            try:
                file.save(filepath)
                logger.info(f"✓ File '{filename}' saved successfully!")

                if USE_USB_GADGET:
                    # File saved to USB gadget - trigger refresh to notify printer
                    logger.info("Triggering USB gadget refresh to notify printer...")
                    refresh_success = trigger_usb_gadget_refresh()

                    if refresh_success:
                        msg = "File saved to USB gadget. Printer should detect it automatically."
                    else:
                        msg = "File saved to USB gadget. You may need to refresh on the printer or reconnect USB."

                    return Response(
                        json.dumps({
                            "upload": "success",
                            "msg": msg,
                            "upload_id": upload_id,
                            "usb_gadget": True,
                            "filename": filename,
                            "refresh_triggered": refresh_success
                        }),
                        status=200,
                        mimetype="application/json"
                    )
                else:
                    # Upload to printer via network
                    logger.info(f"Uploading to printer '{printer['name']}'...")
                    success = upload_file_to_printer(printer['ip'], filepath, upload_id)

                    if success:
                        return Response(
                            json.dumps({
                                "upload": "success",
                                "msg": "File uploaded to printer",
                                "upload_id": upload_id,
                                "usb_gadget": False,
                                "filename": filename
                            }),
                            status=200,
                            mimetype="application/json"
                        )
                    else:
                        return Response(
                            json.dumps({
                                "upload": "error",
                                "msg": "Failed to upload to printer",
                                "upload_id": upload_id,
                                "usb_gadget": False
                            }),
                            status=500,
                            mimetype="application/json"
                        )

            except Exception as e:
                logger.error(f"Upload failed: {e}")
                return Response(f'{{"upload": "error", "msg": "Upload failed: {str(e)}", "upload_id": "{upload_id}"}}', status=500, mimetype="application/json")
        finally:
            # Always release the lock
            uploadLock.release()
    else:
        return Response("u r doin it rong", status=405, mimetype='text/plain')


@app.route('/usb-gadget/refresh', methods=['POST'])
def refresh_usb_gadget():
    """Manually trigger USB gadget refresh to notify printer of file changes"""
    if not USE_USB_GADGET:
        return jsonify({
            "success": False,
            "message": "USB gadget is not enabled",
            "error": USB_GADGET_ERROR
        }), 400

    try:
        success = trigger_usb_gadget_refresh()
        if success:
            return jsonify({
                "success": True,
                "message": "USB gadget reconnected successfully. Printer should detect new files."
            })
        else:
            return jsonify({
                "success": False,
                "message": "Could not trigger automatic refresh. You may need to reconnect USB manually or run ChitUI as root."
            }), 500
    except Exception as e:
        logger.error(f"Error in USB gadget refresh endpoint: {e}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def upload_file_to_printer(printer_ip, filepath, upload_id):
    """Upload file to printer in chunks via HTTP API"""
    part_size = 1048576  # 1MB chunks
    filename = os.path.basename(filepath)

    # Initialize progress for this upload
    with uploadProgressLock:
        uploadProgress[upload_id] = 0

    # Calculate MD5 hash
    md5_hash = hashlib.md5()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            md5_hash.update(byte_block)

    file_stats = os.stat(filepath)
    post_data = {
        'S-File-MD5': md5_hash.hexdigest(),
        'Check': 1,
        'Offset': 0,
        'Uuid': uuid.uuid4(),
        'TotalSize': file_stats.st_size,
    }

    url = 'http://{ip}:3030/uploadFile/upload'.format(ip=printer_ip)
    num_parts = (int)(file_stats.st_size / part_size)
    logger.info(f"Uploading file in {num_parts + 1} parts...")

    i = 0
    while i <= num_parts:
        offset = i * part_size
        progress_value = round(i / num_parts * 100) if num_parts > 0 else 100

        # Update progress (thread-safe)
        with uploadProgressLock:
            uploadProgress[upload_id] = progress_value

        with open(filepath, 'rb') as f:
            f.seek(offset)
            file_part = f.read(part_size)
            logger.debug(f"Uploading part {i}/{num_parts} (offset: {offset})")

            if not upload_file_part(url, post_data, filename, file_part, offset):
                logger.error("Uploading file to printer failed.")
                # Set progress to 0 to indicate failure
                with uploadProgressLock:
                    uploadProgress[upload_id] = 0
                return False

            logger.debug(f"Part {i}/{num_parts} uploaded.")
        i += 1

    # Set progress to 100% (thread-safe)
    with uploadProgressLock:
        uploadProgress[upload_id] = 100

    logger.info(f"✓ Upload complete!")

    # Delete the temporary file after successful upload
    try:
        os.remove(filepath)
        logger.debug(f"Temporary file {filepath} removed")
    except OSError as e:
        logger.warning(f"Could not remove temporary file {filepath}: {e}")

    return True


def upload_file_part(url, post_data, file_name, file_part, offset):
    """Upload a single chunk to the printer"""
    post_data['Offset'] = offset
    post_files = {'File': (file_name, file_part)}
    
    try:
        response = requests.post(url, data=post_data, files=post_files, timeout=30)
        status = json.loads(response.text)
        
        if status.get('success'):
            return True
        else:
            logger.error(f"Upload part failed: {status}")
            return False
    except Exception as e:
        logger.error(f"Upload part error: {e}")
        return False


# Global variables for upload progress tracking (thread-safe)
uploadProgress = {}  # Dictionary to track progress per upload session
uploadProgressLock = threading.Lock()
uploadLock = threading.Lock()  # Prevent concurrent uploads


# ============ SOCKETIO HANDLERS ============

@socketio.on('connect')
def sio_handle_connect(auth):
    logger.info('Client connected')
    logger.info(f'Available printers: {list(printers.keys())}')
    socketio.emit('printers', printers)


@socketio.on('disconnect')
def sio_handle_disconnect():
    logger.info('Client disconnected')


@socketio.on('printers')
def sio_handle_printers(data):
    logger.debug('client.printers >> '+str(data))
    load_saved_printers()


@socketio.on('printer_info')
def sio_handle_printer_status(data):
    logger.debug(f"client.printer_info >> {data['id']}")
    get_printer_status(data['id'])
    get_printer_attributes(data['id'])


@socketio.on('printer_files')
def sio_handle_printer_files(data):
    logger.debug(f'client.printer_files >> {json.dumps(data)}')
    get_printer_files(data['id'], data['url'])


@socketio.on('action_delete')
def sio_handle_action_delete(data):
    logger.debug(f'client.action_delete >> {json.dumps(data)}')
    
    send_printer_cmd(data['id'], 259, {"FileList": [data['data']]})


@socketio.on('action_print')
def sio_handle_action_print(data):
    logger.debug(f'client.action_print >> {json.dumps(data)}')
    send_printer_cmd(data['id'], 128, {
                     "Filename": data['data'], "StartLayer": 0})


@socketio.on('action_pause')
def sio_handle_action_pause(data):
    logger.debug(f'client.action_pause >> {json.dumps(data)}')
    send_printer_cmd(data['id'], 129)


@socketio.on('action_resume')
def sio_handle_action_resume(data):
    logger.debug(f'client.action_resume >> {json.dumps(data)}')
    send_printer_cmd(data['id'], 131)


@socketio.on('action_stop')
def sio_handle_action_stop(data):
    logger.debug(f'client.action_stop >> {json.dumps(data)}')
    send_printer_cmd(data['id'], 130)


@socketio.on('action_clear_history')
def sio_handle_action_clear_history(data):
    logger.info(f"Clearing print history for printer {data['id']}")
    # SDCP command 320 = Clear print history
    send_printer_cmd(data['id'], 320)


@socketio.on('action_wipe_storage')
def sio_handle_action_wipe_storage(data):
    logger.warning(f"FORMATTING LOCAL STORAGE on printer {data['id']}")
    printer_id = data['id']
    
    if printer_id not in printers:
        logger.error(f"Printer {printer_id} not found")
        return
    
    # SDCP command 322 = Format local storage
    # This is the same as the "Format Local Storage" button in printer settings
    send_printer_cmd(printer_id, 322)
    
    logger.info("Format local storage command sent")


@socketio.on('get_attributes')
def sio_handle_get_attributes(data):
    logger.debug(f'client.get_attributes >> {json.dumps(data)}')
    get_printer_attributes(data['id'])


@socketio.on('get_task_details')
def sio_handle_get_task_details(data):
    logger.debug(f'client.get_task_details >> {json.dumps(data)}')
    send_printer_cmd(data['id'], 321, {"Id": [data['taskId']]})


# ============ PRINTER CONTROL FUNCTIONS ============

def get_printer_status(id):
    send_printer_cmd(id, 0)


def get_printer_attributes(id):
    send_printer_cmd(id, 1)


def get_printer_files(id, url):
    send_printer_cmd(id, 258, {"Url": url})


def send_printer_cmd(id, cmd, data={}):
    printer = printers.get(id)
    if not printer:
        logger.error(f"Printer {id} not found")
        return False
        
    if id not in websockets:
        logger.error(f"No websocket connection for printer {id}")
        return False
        
    ts = int(time.time())
    payload = {
        "Id": printer['connection'],
        "Data": {
            "Cmd": cmd,
            "Data": data,
            "RequestID": os.urandom(8).hex(),
            "MainboardID": id,
            "TimeStamp": ts,
            "From": 0
        },
        "Topic": "sdcp/request/" + id
    }
    logger.debug("printer << \n{p}", p=json.dumps(payload, indent=4))
    
    try:
        websockets[id].send(json.dumps(payload))
        return True
    except Exception as e:
        logger.error(f"Failed to send command to printer {id}: {e}")
        return False


# ============ PRINTER DISCOVERY & CONNECTION ============

def discover_printers():
    logger.info("Starting printer discovery.")
    msg = b'M99999'
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM,
                         socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(discovery_timeout)
    sock.bind(('', 54781))
    sock.sendto(msg, ("255.255.255.255", 3000))
    socketOpen = True
    discovered_printers = {}
    while (socketOpen):
        try:
            data = sock.recv(8192)
            save_discovered_printer(data, discovered_printers)
        except TimeoutError:
            sock.close()
            break
    logger.info("Discovery done.")
    return discovered_printers


def save_discovered_printer(data, printer_dict):
    j = json.loads(data.decode('utf-8'))
    printer = {}
    printer['connection'] = j['Id']
    printer['name'] = j['Data']['Name']
    printer['model'] = j['Data']['MachineName']
    printer['brand'] = j['Data']['BrandName']
    printer['ip'] = j['Data']['MainboardIP']
    printer['protocol'] = j['Data']['ProtocolVersion']
    printer['firmware'] = j['Data']['FirmwareVersion']
    printer_dict[j['Data']['MainboardID']] = printer
    printers[j['Data']['MainboardID']] = printer
    logger.info("Discovered: {n} ({i})".format(
        n=printer['name'], i=printer['ip']))
    return printer_dict


def connect_printers(printers_to_connect):
    for id, printer in printers_to_connect.items():
        url = "ws://{ip}:3030/websocket".format(ip=printer['ip'])
        logger.info("Connecting to: {n}".format(n=printer['name']))
        websocket.setdefaulttimeout(1)
        ws = websocket.WebSocketApp(url,on_message=ws_msg_handler,
                                    on_open=lambda _, printer_id=id: ws_connected_handler(
                                        printer_id),
                                    on_close=lambda _, s, m, printer_id=id: ws_closed_handler(
                                        printer_id, s, m),
                                    on_error=lambda _, e, printer_id=id: ws_error_handler(
                                        printer_id, e)
                                    )
        websockets[id] = ws
        Thread(target=lambda: ws.run_forever(reconnect=1), daemon=True).start()

    return True


def ws_connected_handler(printer_id):
    if printer_id in printers:
        logger.info("Connected to: {n}".format(n=printers[printer_id]['name']))
        # Emit online status to frontend
        socketio.emit('printer_online', {'MainboardID': printer_id, 'name': printers[printer_id]['name']})
        socketio.emit('printers', printers)


def ws_closed_handler(printer_id, status_code, message):
    if printer_id in printers:
        logger.info("Connection to '{n}' closed: {m} ({s})".format(
            n=printers[printer_id]['name'], m=message, s=status_code))
        # Emit offline status to frontend
        socketio.emit('printer_offline', {'MainboardID': printer_id, 'name': printers[printer_id]['name']})


def ws_error_handler(printer_id, error):
    if printer_id in printers:
        logger.info("Connection to '{n}' error: {e}".format(
            n=printers[printer_id]['name'], e=error))
        # Emit offline status to frontend on error
        socketio.emit('printer_offline', {'MainboardID': printer_id, 'name': printers[printer_id]['name']})


def ws_msg_handler(ws, msg):
    try:
        data = json.loads(msg)
        logger.debug("printer >> \n{m}", m=json.dumps(data, indent=4))

        # Notify plugins of printer message
        printer_id = data.get('MainboardID')
        if printer_id:
            plugin_manager.notify_printer_message(printer_id, data)

        if data['Topic'].startswith("sdcp/response/"):
            socketio.emit('printer_response', data)
        elif data['Topic'].startswith("sdcp/status/"):
            socketio.emit('printer_status', data)
        elif data['Topic'].startswith("sdcp/attributes/"):
            socketio.emit('printer_attributes', data)
        elif data['Topic'].startswith("sdcp/error/"):
            socketio.emit('printer_error', data)
        elif data['Topic'].startswith("sdcp/notice/"):
            socketio.emit('printer_notice', data)
        else:
            logger.warning("--- UNKNOWN MESSAGE ---")
            logger.warning(data)
            logger.warning("--- UNKNOWN MESSAGE ---")
    except Exception as e:
        logger.error(f"Error handling websocket message: {e}")


def load_saved_printers():
    """Load and connect to saved printers from settings"""
    settings = load_settings()
    
    if settings.get("auto_discover", False):
        logger.info("Auto-discovery is enabled, discovering printers...")
        discover_printers()
    
    for printer_id, printer_config in settings.get("printers", {}).items():
        if printer_config.get("enabled", True):
            if printer_id not in printers:
                printer = {
                    'connection': printer_id,
                    'name': printer_config['name'],
                    'model': printer_config.get('model', 'Unknown'),
                    'brand': printer_config.get('brand', 'Unknown'),
                    'ip': printer_config['ip'],
                    'protocol': printer_config.get('protocol', 'Unknown'),
                    'firmware': printer_config.get('firmware', 'Unknown')
                }
                printers[printer_id] = printer
                logger.info(f"Loaded saved printer: {printer_config['name']} ({printer_config['ip']})")
            
            if printer_id not in websockets:
                connect_printers({printer_id: printers[printer_id]})


# ============ MAIN ============

def main():
    settings = load_settings()

    # Load plugins
    logger.info("Loading plugins...")
    plugin_manager.load_all_plugins(app, socketio)

    if settings.get("auto_discover", True):
        logger.info("Starting with auto-discovery enabled")
        discovered = discover_printers()
        if discovered:
            connect_printers(discovered)
            socketio.emit('printers', printers)
        else:
            logger.warning("No printers discovered.")

    load_saved_printers()


if __name__ == "__main__":
    main()

    logger.info("=" * 60)
    logger.info("ChitUI Starting")
    logger.info("=" * 60)
    logger.info(f"Python Environment:")
    logger.info(f"  → Python executable: {sys.executable}")
    logger.info(f"  → Python version: {sys.version.split()[0]}")
    logger.info(f"  → Running as user: {os.getenv('USER', 'unknown')}")
    if os.getenv('SUDO_USER'):
        logger.info(f"  → Original user (sudo): {os.getenv('SUDO_USER')}")
        logger.warning(f"  ⚠ Running with sudo - pip operations will affect root's Python environment")
    logger.info(f"Features:")
    logger.info(f"  ✓ Printer Management")
    if USE_USB_GADGET:
        logger.info(f"  ✓ File Upload (USB Gadget Mode)")
        logger.info(f"     → Files saved to: {UPLOAD_FOLDER}")
        logger.info(f"     → Connect USB to printer to access files")
    else:
        logger.info(f"  ✓ File Upload (Network Transfer)")
        logger.info(f"     → Files uploaded directly to printer")
    if CAMERA_SUPPORT:
        logger.info(f"  ✓ Camera Streaming (RTSP)")
    else:
        logger.info(f"  ✗ Camera Streaming (install opencv-python)")
    logger.info("=" * 60)
    logger.info(f"Data folder: {DATA_FOLDER}")
    logger.info(f"Settings file: {SETTINGS_FILE}")
    logger.info("=" * 60)

    socketio.run(app, host='0.0.0.0', port=port,
                 debug=debug, use_reloader=debug, log_output=True,
                 allow_unsafe_werkzeug=True)