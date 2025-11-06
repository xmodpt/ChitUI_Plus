#!/bin/bash
cat << "EOF"
 _____                 _                               _____  _____
|  __ \               | |                             |  __ \|_   _|
| |__) |__ _ ___ _ __ | |__   ___ _ __ _ __ _   _     | |__) | | |  
|  _  // _` / __| '_ \| '_ \ / _ \ '__| '__| | | |    |  ___/  | |  
| | \ \ (_| \__ \ |_) | |_) |  __/ |  | |  | |_| |    | |     _| |_ 
|_|  \_\__,_|___/ .__/|_.__/ \___|_|  |_|   \__, |    |_|    |_____|
                | |                          __/ |                   
                |_|                         |___/      
              
       Virtual USB Drive + File Manager              
               All-in-One Installer               

# Pi USB Drive Configuration Script
# This script configures a Raspberry Pi Zero W as a USB flash drive with selectable size
# and installs TinyFileManager for web-based file management

EOF

# Exit on error
set -e

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Try using sudo."
  exit 1
fi

echo "=====================================================
Raspberry Pi USB Flash Drive + TinyFileManager Installation
=====================================================
This tool will:
1. Configure your Pi to appear as a USB flash drive
2. Install TinyFileManager for web-based access to your files"
echo

echo "Would you like to:"
echo "1. Install USB drive configuration only"
echo "2. Install TinyFileManager only"
echo "3. Install both (recommended)"

read -p "Enter your choice (1-3): " INSTALL_CHOICE

# Default to installing both if invalid choice
if [[ "$INSTALL_CHOICE" != "1" && "$INSTALL_CHOICE" != "2" ]]; then
  INSTALL_CHOICE="3"
  echo "Installing both USB drive and TinyFileManager..."
elif [[ "$INSTALL_CHOICE" == "1" ]]; then
  echo "Installing USB drive configuration only..."
elif [[ "$INSTALL_CHOICE" == "2" ]]; then
  echo "Installing TinyFileManager only..."
fi

# Function to install USB drive configuration
install_usb_drive() {
  echo "=====================================================
Raspberry Pi USB Flash Drive Configuration Tool
=====================================================
This tool will configure your Pi to appear as a USB flash drive
when connected to a computer via USB."
  echo

  # Check for existing setup
  USB_FILE_PATH="/piusb.bin"
  EXISTING_SIZE="None"

  if [ -f "$USB_FILE_PATH" ]; then
    # Get current size in MB
    EXISTING_SIZE=$(du -m "$USB_FILE_PATH" | cut -f1)
    echo "DETECTED: Existing USB drive image ($EXISTING_SIZE MB)"
    
    read -p "Do you want to keep the existing setup? (y/n): " KEEP_EXISTING
    if [[ "$KEEP_EXISTING" == "y" || "$KEEP_EXISTING" == "Y" ]]; then
      echo "Keeping existing USB drive image."
      # Just ensure the modules are properly configured
      CONFIG_ONLY=true
    else
      echo "Will create a new USB drive image."
      CONFIG_ONLY=false
    fi
  else
    CONFIG_ONLY=false
  fi

  if [ "$CONFIG_ONLY" = false ]; then
    # Choose USB drive size
    echo
    echo "Please select the size for your USB drive:"
    echo "1. 4GB"
    echo "2. 8GB"
    echo "3. 16GB"
    echo "4. 32GB"
    echo "5. Custom size (specify in MB)"
    
    read -p "Enter selection (1-5): " SIZE_CHOICE
    
    case $SIZE_CHOICE in
      1) SIZE_MB=4096 ;;
      2) SIZE_MB=8192 ;;
      3) SIZE_MB=16384 ;;
      4) SIZE_MB=32768 ;;
      5) read -p "Enter custom size in MB: " SIZE_MB ;;
      *) echo "Invalid choice. Using 4GB as default."; SIZE_MB=4096 ;;
    esac
    
    echo "Selected size: $SIZE_MB MB"
    
    # Confirm before proceeding
    echo
    echo "WARNING: This will create a $SIZE_MB MB file on your Pi."
    echo "Make sure you have enough free space on your SD card."
    read -p "Continue? (y/n): " CONFIRM
    
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
      echo "Operation cancelled."
      exit 0
    fi
    
    # Check available space
    AVAILABLE_SPACE=$(df -m / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt "$SIZE_MB" ]; then
      echo "ERROR: Not enough space available on SD card."
      echo "Available: $AVAILABLE_SPACE MB, Required: $SIZE_MB MB"
      echo "Please free up space or choose a smaller size."
      exit 1
    fi
    
    # Create the USB image file
    echo
    echo "Creating USB image file ($SIZE_MB MB)..."
    echo "This may take some time depending on the size."
    
    # Remove existing file if present
    if [ -f "$USB_FILE_PATH" ]; then
      rm "$USB_FILE_PATH"
    fi
    
    # Create new file with dd
    dd if=/dev/zero of="$USB_FILE_PATH" bs=1M count="$SIZE_MB" status=progress
    
    # Format as FAT32 with proper parameters for Windows compatibility
    echo "Formatting USB image as FAT32 (Windows compatible)..."
    # Use -n for volume label, -F 32 for FAT32, -I to ignore warnings
    mkfs.vfat -F 32 -n "PI_USB" "$USB_FILE_PATH"
    
    echo "USB image file created and formatted as FAT32 successfully."
  else
    # If keeping existing, verify it's FAT32
    echo "Verifying existing USB image format..."
    FILE_TYPE=$(file -b "$USB_FILE_PATH")
    if [[ ! "$FILE_TYPE" =~ "FAT" ]]; then
      echo "WARNING: Existing file is not FAT32 format."
      read -p "Would you like to reformat it as FAT32? (This will ERASE all data) (y/n): " REFORMAT
      if [[ "$REFORMAT" == "y" || "$REFORMAT" == "Y" ]]; then
        echo "Reformatting as FAT32..."
        mkfs.vfat -F 32 -n "PI_USB" "$USB_FILE_PATH"
        echo "Reformatted successfully."
      else
        echo "Keeping existing format. Note: Windows compatibility may be limited."
      fi
    else
      echo "Existing USB image is already FAT32 formatted."
    fi
  fi

  # Configure USB gadget mode
  echo
  echo "Configuring USB gadget mode..."

  # Set up dtoverlay in config.txt
  CONFIG_PATH="/boot/firmware/config.txt"
  if [ ! -f "$CONFIG_PATH" ]; then
    CONFIG_PATH="/boot/config.txt"
  fi

  # First make a backup
  if [ ! -f "${CONFIG_PATH}.backup" ]; then
    cp "$CONFIG_PATH" "${CONFIG_PATH}.backup"
    echo "Created backup of config.txt"
  fi

  # Remove any existing dwc2 entries to avoid duplicates
  sed -i '/dtoverlay=dwc2/d' "$CONFIG_PATH"
  
  # Check if [all] section exists
  if grep -q "^\[all\]" "$CONFIG_PATH"; then
    # Add dtoverlay after [all] section
    sed -i '/^\[all\]/a dtoverlay=dwc2' "$CONFIG_PATH"
    echo "Added dwc2 overlay after existing [all] section"
  else
    # Add [all] section at the end with dtoverlay
    echo -e "\n[all]\ndtoverlay=dwc2" >> "$CONFIG_PATH"
    echo "Added [all] section with dwc2 overlay to $CONFIG_PATH"
  fi

  # Set up modules-load in cmdline.txt
  CMDLINE_PATH="/boot/firmware/cmdline.txt"
  if [ ! -f "$CMDLINE_PATH" ]; then
    CMDLINE_PATH="/boot/cmdline.txt"
  fi

  if ! grep -q "modules-load=dwc2,g_mass_storage" "$CMDLINE_PATH"; then
    # Make backup
    if [ ! -f "${CMDLINE_PATH}.backup" ]; then
      cp "$CMDLINE_PATH" "${CMDLINE_PATH}.backup"
    fi
    sed -i 's/rootwait/rootwait modules-load=dwc2,g_mass_storage/' "$CMDLINE_PATH"
    echo "Added modules-load to $CMDLINE_PATH"
  fi

  # Create mount point and set up fstab
  MOUNT_POINT="/mnt/usb_share"
  mkdir -p "$MOUNT_POINT"

  # Make sure /piusb.bin is properly in /etc/fstab
  if grep -q "$USB_FILE_PATH" /etc/fstab; then
    # Remove the existing entry to update it
    sed -i "\|$USB_FILE_PATH|d" /etc/fstab
  fi

  # Add the updated entry to fstab with proper Windows-compatible options
  # umask=000 makes all files readable/writable, uid=1000,gid=1000 for pi user
  echo "$USB_FILE_PATH $MOUNT_POINT vfat users,umask=000,uid=1000,gid=1000 0 0" >> /etc/fstab
  echo "Updated $USB_FILE_PATH in fstab with Windows-compatible options"

  # Create systemd service for mounting the USB drive
  echo "Creating systemd service for auto-mounting..."

  cat > /etc/systemd/system/piusb-mount.service << EOF
[Unit]
Description=Mount Pi USB Drive Image
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/bin/mount $MOUNT_POINT
RemainAfterExit=yes
ExecStop=/bin/umount $MOUNT_POINT

[Install]
WantedBy=multi-user.target
EOF

  # Reload systemd, enable and start the service
  systemctl daemon-reload
  systemctl enable piusb-mount.service
  systemctl start piusb-mount.service
  echo "Created and enabled piusb-mount.service"

  # Try to mount the USB image
  echo "Mounting USB image to $MOUNT_POINT..."
  if mount | grep -q "$MOUNT_POINT"; then
    echo "Already mounted."
  else
    if ! mount "$MOUNT_POINT"; then
      echo "Warning: Failed to mount directly, trying with explicit options..."
      if ! mount -t vfat -o loop,rw,umask=000,uid=1000,gid=1000 "$USB_FILE_PATH" "$MOUNT_POINT"; then
        echo "Could not mount the USB image file. Will continue setup anyway."
      fi
    fi
  fi

  # Add a README file
  if mount | grep -q "$MOUNT_POINT"; then
    echo "Creating a README.txt file on the USB drive..."
    cat > "$MOUNT_POINT/README.txt" << EOF
Raspberry Pi USB Drive
======================
This is a Raspberry Pi Zero W configured as a USB drive.
Created on $(date)

The drive is formatted as FAT32 for Windows compatibility.

Access Methods:
1. USB Connection: Connect Pi to computer via USB data port
2. Network Share: \\\\$(hostname)\\usb (Samba/SMB)
3. Web Interface: TinyFileManager (if installed)

For more information, see /home/pi/README_USB_DRIVE.txt on the Pi.
EOF
    chmod 666 "$MOUNT_POINT/README.txt"
  fi

  # Install and configure Samba
  echo
  echo "===== Installing and configuring Samba for Windows network sharing ====="
  
  # Update package list
  apt-get update
  
  # Install Samba and dependencies
  echo "Installing Samba packages..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y samba samba-common-bin
  
  # Verify Samba installed correctly
  if [ ! -f "/etc/samba/smb.conf" ]; then
    echo "ERROR: Samba installation failed - smb.conf not found"
    echo "Attempting to create basic smb.conf..."
    mkdir -p /etc/samba
    cat > /etc/samba/smb.conf << 'SMBEOF'
[global]
   workgroup = WORKGROUP
   server string = Raspberry Pi
   security = user
   map to guest = bad user
   dns proxy = no
SMBEOF
  fi

  # Backup original config if it exists and we haven't done so
  if [ -f "/etc/samba/smb.conf" ] && [ ! -f "/etc/samba/smb.conf.backup" ]; then
    cp /etc/samba/smb.conf /etc/samba/smb.conf.backup
    echo "Original Samba config backed up to /etc/samba/smb.conf.backup"
  fi

  # Configure global section for guest access if not already done
  if ! grep -q "map to guest = bad user" /etc/samba/smb.conf; then
    # Add to global section
    sed -i '/\[global\]/a \   map to guest = bad user' /etc/samba/smb.conf
    echo "Configured Samba for guest access"
  fi

  # Check if USB share already exists in Samba config
  if ! grep -q "\[usb\]" /etc/samba/smb.conf; then
    cat >> /etc/samba/smb.conf << 'EOF'

[usb]
   comment = Raspberry Pi USB Drive
   path = /mnt/usb_share
   browseable = yes
   writeable = yes
   guest ok = yes
   public = yes
   create mask = 0777
   directory mask = 0777
   force user = pi
   force group = pi
EOF
    echo "Added USB share to Samba config"
  else
    echo "USB share already exists in Samba config"
  fi

  # Test Samba configuration
  echo "Testing Samba configuration..."
  if testparm -s /etc/samba/smb.conf >/dev/null 2>&1; then
    echo "Samba configuration is valid"
  else
    echo "WARNING: Samba configuration has issues. Running testparm for details:"
    testparm -s /etc/samba/smb.conf || true
  fi

  # Enable and start Samba services
  echo "Starting Samba services..."
  systemctl enable smbd
  systemctl enable nmbd
  systemctl restart smbd
  systemctl restart nmbd

  # Check if Samba is running
  if systemctl is-active --quiet smbd && systemctl is-active --quiet nmbd; then
    echo "✓ Samba services are running successfully"
  else
    echo "! WARNING: Samba services may not be running properly"
    echo "  Check status with: systemctl status smbd nmbd"
  fi

  # Configure USB mass storage module with specific USB identifiers
  echo
  echo "Setting up USB mass storage module..."
  if grep -q "g_mass_storage" /etc/modules; then
    sed -i '/g_mass_storage/d' /etc/modules
  fi

  # Add new configuration with USB drive identifiers
  echo "g_mass_storage file=$USB_FILE_PATH stall=0 ro=0 removable=1 idVendor=0x0951 idProduct=0x1666 iManufacturer=Kingston iProduct=DataTraveler iSerialNumber=74A53CDF" >> /etc/modules
  echo "Configured USB mass storage module"

  # Create test script for manual loading
  cat > /home/pi/test_usb_gadget.sh << EOF
#!/bin/bash
# This script manually loads the USB gadget module

# Unload existing modules
sudo modprobe -r g_mass_storage 2>/dev/null || true
sudo modprobe -r dwc2 2>/dev/null || true

# Load modules in correct order
sudo modprobe dwc2
sudo modprobe g_mass_storage file=$USB_FILE_PATH stall=0 ro=0 removable=1 idVendor=0x0951 idProduct=0x1666 iManufacturer=Kingston iProduct=DataTraveler iSerialNumber=74A53CDF

echo "USB gadget should now be active"
echo "Check your computer for a new USB drive named 'PI_USB'"
EOF
  chmod +x /home/pi/test_usb_gadget.sh
  chown pi:pi /home/pi/test_usb_gadget.sh

  # Create a simple README for the user
  cat > /home/pi/README_USB_DRIVE.txt << EOF
Raspberry Pi USB Drive Configuration
===================================

Your Raspberry Pi has been configured as a USB flash drive.

- USB Image File: $USB_FILE_PATH
- Format: FAT32 (Windows compatible)
- Size: $(du -h "$USB_FILE_PATH" 2>/dev/null | cut -f1 || echo "Unknown")
- Mount Point: $MOUNT_POINT
- Volume Label: PI_USB

Network Access (Samba/Windows Share):
-------------------------------------
Share Name: \\\\$(hostname)\\usb
Alternative: \\\\$(hostname -I | awk '{print $1}')\\usb

You can access this from Windows by:
1. Opening File Explorer
2. Typing in the address bar: \\\\$(hostname)\\usb
3. Or using the IP address: \\\\$(hostname -I | awk '{print $1}')\\usb

USB Connection:
--------------
1. Connect your Pi to a computer via the USB data port (not PWR port)
2. Your Pi should appear as a USB drive named "PI_USB"
3. The drive is formatted as FAT32 for maximum compatibility

Troubleshooting:
---------------
If the USB drive is not detected after reboot:
  sudo /home/pi/test_usb_gadget.sh

To check systemd service status:
  sudo systemctl status piusb-mount.service

To manually start the systemd service:
  sudo systemctl start piusb-mount.service

To check Samba status:
  sudo systemctl status smbd nmbd

To restart Samba:
  sudo systemctl restart smbd nmbd

For changes to take effect completely, please reboot your Pi:
  sudo reboot
EOF
  chown pi:pi /home/pi/README_USB_DRIVE.txt

  echo
  echo "=====================================================
USB Drive Setup complete!
=====================================================
Your Raspberry Pi has been configured as a USB flash drive.
- Format: FAT32 (Windows compatible)
- Size: $(if [ -f "$USB_FILE_PATH" ]; then du -h "$USB_FILE_PATH" | cut -f1; else echo "Unknown"; fi)
- Volume Label: PI_USB

Access Methods:
1. USB: Connect to computer via USB data port
2. Network: \\\\$(hostname)\\usb or \\\\$(hostname -I | awk '{print $1}')\\usb
3. Local: $MOUNT_POINT

Configuration changes made:
- Created FAT32 formatted USB image at $USB_FILE_PATH
- Added dtoverlay=dwc2 under [all] section in $CONFIG_PATH
- Added /piusb.bin to /etc/fstab with Windows-compatible options
- Created and enabled systemd service for automatic mounting
- Installed and configured Samba for Windows network sharing
- Configured USB mass storage gadget module

Samba Status: $(systemctl is-active smbd nmbd || echo "Check manually")"
}

# Function to install TinyFileManager
install_tiny_file_manager() {
  cat << "EOF"
 _____  _              _____ _ _      __  __                                   
|_   _|(_)            |  ___(_) |    |  \/  |                                  
  | |   _  _ __  _   _| |_   _| | ___|  \\/  | __ _ _ __   __ _  __ _  ___ _ __ 
  | |  | || '_ \| | | |  _| | | |/ _ \ |\/| |/ _` | '_ \ / _` |/ _` |/ _ \ '__|
  | |  | || | | | |_| | |   | | |  __/ |  | | (_| | | | | (_| | (_| |  __/ |   
  \_/  |_||_| |_|\__, \_|   |_|_|\___\_|  |_/\__,_|_| |_|\__,_|\__, |\___|_|   
                  __/ |                                          __/ |          
                 |___/                                          |___/           
                                 _____           _        _ _                 
                                |_   _|         | |      | | |                
                                  | |  _ __  ___| |_ __ _| | | ___ _ __      
                                  | | | '_ \/ __| __/ _` | | |/ _ \ '__|     
                                 _| |_| | | \__ \ || (_| | | |  __/ |        
                                 \___/|_| |_|___/\__\__,_|_|_|\___|_|        

- Install TinyFileManager on Raspberry Pi
- This script installs Apache, PHP, and TinyFileManager
- Configured to only access /mnt/usb_share directory

EOF

  echo "===== Updating system packages ====="
  apt update && apt upgrade -y

  echo "===== Installing Apache web server ====="
  apt install -y apache2

  # Verify Apache installation
  if [ ! -f "/etc/apache2/apache2.conf" ]; then
      echo "Apache configuration file not found. Attempting to repair..."
      apt remove --purge -y apache2 apache2-*
      rm -rf /etc/apache2
      apt clean
      apt update
      apt install -y apache2
      
      # Check again
      if [ ! -f "/etc/apache2/apache2.conf" ]; then
          echo "ERROR: Failed to install Apache properly. Please check your system."
          exit 1
      fi
  fi

  # Make sure Apache is enabled and started
  systemctl enable apache2
  systemctl start apache2

  # Verify Apache is running
  if ! systemctl is-active --quiet apache2; then
      echo "WARNING: Apache is not running. Checking error logs..."
      journalctl -u apache2 --no-pager -n 20
      echo "Attempting to fix common issues..."
      
      # Fix common issues
      mkdir -p /var/log/apache2
      chown -R www-data:www-data /var/log/apache2
      chmod -R 755 /var/log/apache2
      
      # Try starting again
      systemctl start apache2
      
      if ! systemctl is-active --quiet apache2; then
          echo "ERROR: Could not start Apache. Please check logs and fix manually."
          echo "You can continue with the installation, but TinyFileManager won't work until Apache is running."
      fi
  fi

  echo "===== Installing PHP and required extensions ====="
  apt install -y php php-zip php-json php-mbstring php-gd php-curl libapache2-mod-php

  echo "===== Making sure /mnt/usb_share exists ====="
  mkdir -p /mnt/usb_share
  chmod 777 /mnt/usb_share 2>/dev/null || echo "Warning: Could not change permissions on /mnt/usb_share"

  # Add Apache user to necessary groups for access
  echo "===== Adding Apache user to necessary groups for access ====="
  usermod -a -G pi,plugdev,dialout www-data 2>/dev/null || true

  # Remove any existing index.html that would take precedence over our index.php
  if [ -f "/var/www/html/index.html" ]; then
      echo "===== Removing existing index.html ====="
      rm -f /var/www/html/index.html
  fi

  echo "===== Downloading TinyFileManager as index.php ====="
  wget -O /var/www/html/index.php https://raw.githubusercontent.com/prasathmani/tinyfilemanager/master/tinyfilemanager.php

  echo "===== Configuring TinyFileManager to only access /mnt/usb_share ====="
  # Create a backup of the original file
  cp /var/www/html/index.php /var/www/html/index.php.backup

  # Modify the file to restrict access to /mnt/usb_share
  sed -i "s|\$root_path = \$_SERVER\['DOCUMENT_ROOT'\];|\$root_path = '/mnt/usb_share';|g" /var/www/html/index.php
  sed -i "s|\$root_url = '';|\$root_url = '';|g" /var/www/html/index.php

  # Set dark theme as default
  sed -i "s|'theme' => 'light'|'theme' => 'dark'|g" /var/www/html/index.php

  echo "===== Setting proper permissions ====="
  chown -R www-data:www-data /var/www/html/index.php
  chmod 644 /var/www/html/index.php

  echo "===== Restarting Apache ====="
  if systemctl is-active --quiet apache2; then
      systemctl restart apache2
      if ! systemctl is-active --quiet apache2; then
          echo "WARNING: Apache failed to restart. Attempting to start..."
          systemctl start apache2
      fi
  else
      echo "WARNING: Apache is not running. Attempting to start..."
      systemctl start apache2
  fi

  # Final check
  if ! systemctl is-active --quiet apache2; then
      echo "ERROR: Apache is not running. TinyFileManager will not be accessible."
      echo "Please fix Apache issues before accessing TinyFileManager."
  fi

  # Setup USB gadget service if the test script exists
  echo "===== Setting up USB gadget to run on boot ====="

  # Check if test_usb_gadget.sh exists
  TEST_SCRIPT="/home/pi/test_usb_gadget.sh"
  if [ ! -f "$TEST_SCRIPT" ]; then
      echo "Note: USB gadget test script not found. It will be created during USB drive setup."
  else
      # Make sure the test script is executable
      chmod +x "$TEST_SCRIPT"
      
      # Create the systemd service file
      cat > /etc/systemd/system/usb-gadget.service << 'USBEOF'
[Unit]
Description=USB Gadget Setup
After=local-fs.target piusb-mount.service

[Service]
Type=oneshot
ExecStart=/home/pi/test_usb_gadget.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
USBEOF

      # Set correct permissions for the service file
      chmod 644 /etc/systemd/system/usb-gadget.service
      
      # Reload systemd
      systemctl daemon-reload
      
      # Enable the service to run at boot
      systemctl enable usb-gadget.service
      
      # Start the service now
      if systemctl start usb-gadget.service 2>/dev/null; then
          echo "✓ USB gadget service started successfully."
      else
          echo "! USB gadget service will start on next reboot."
      fi
      
      echo "✓ USB gadget service configured to run at boot."
  fi

  # Get the IP address to display in the final message
  IP_ADDRESS=$(hostname -I | awk '{print $1}')

  echo "===== TinyFileManager Installation completed! ====="
  echo "You can now access TinyFileManager at: http://$IP_ADDRESS/"
  echo "TinyFileManager is restricted to only view and manage files in /mnt/usb_share"
  echo ""
  echo "Default login credentials:"
  echo "Administrator: admin/admin@123"
  echo "User: user/12345"
  echo ""
  echo "IMPORTANT: Please change the default login credentials for security reasons!"
  echo "You can modify the credentials by editing the /var/www/html/index.php file."
}

# Install components based on the user's choice
if [[ "$INSTALL_CHOICE" == "1" || "$INSTALL_CHOICE" == "3" ]]; then
  install_usb_drive
fi

if [[ "$INSTALL_CHOICE" == "2" || "$INSTALL_CHOICE" == "3" ]]; then
  install_tiny_file_manager
fi

# Final message for combined installation
if [[ "$INSTALL_CHOICE" == "3" ]]; then
  # Get the IP address to display in the final message
  IP_ADDRESS=$(hostname -I | awk '{print $1}')
  HOSTNAME=$(hostname)
  
  echo ""
  echo "=====================================================
All-In-One Installation Complete!
=====================================================
Your Raspberry Pi has been configured with:

1. USB Drive Configuration:
   - Format: FAT32 (Windows compatible)
   - Volume Label: PI_USB
   - Connect via USB data port to use as USB drive
   
2. Network Share (Samba/Windows):
   - Share path: \\\\$HOSTNAME\\usb
   - Or use IP: \\\\$IP_ADDRESS\\usb
   - Access from Windows File Explorer
   
3. TinyFileManager Web Interface:
   - Web access: http://$IP_ADDRESS/
   - Default login: admin/admin@123 (CHANGE THIS!)

For full functionality, please reboot your Pi:
  sudo reboot

The system will reboot in 10 seconds to apply all changes..."

  # Schedule a reboot in 10 seconds
  echo "Press Ctrl+C to cancel automatic reboot..."
  sleep 10
  reboot
elif [[ "$INSTALL_CHOICE" == "1" ]]; then
  echo ""
  echo "Please reboot your Pi for all settings to take effect:
  sudo reboot"
  
  # Ask about rebooting
  read -p "Would you like to reboot now? (y/n): " REBOOT_NOW
  if [[ "$REBOOT_NOW" == "y" || "$REBOOT_NOW" == "Y" ]]; then
    echo "Rebooting in 5 seconds..."
    sleep 5
    reboot
  fi
fi
