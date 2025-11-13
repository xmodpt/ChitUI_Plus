# GPIO Relay Control Plugin

Control up to 4 GPIO relays from the ChitUI toolbar with real-time status updates and enable/disable controls.

## Features

- **4 Independent Relay Controls** - Control up to 4 separate GPIO relays
- **Enable/Disable Relays** - Show only the relays you need in the toolbar
- **Toolbar Integration** - Buttons positioned on the far right of the toolbar
- **Real-time Updates** - Socket.IO integration for instant state synchronization
- **Custom Names & Icons** - Rename each relay and choose custom FontAwesome icons
- **NO/NC Relay Support** - Configure for Normally Open or Normally Closed relays
- **Visual Feedback** - Orange/gray indicators show relay state (ON/OFF)
- **Settings Panel** - Configure relay names, pins, types, icons, and enable state
- **Persistent State** - Relay states are saved and restored on reboot
- **Simulation Mode** - Works without GPIO hardware for testing

## Hardware Setup

### Default GPIO Pin Assignment (BCM Numbering)

- **Relay 1**: GPIO 17 (⚡ Lightning Bolt icon)
- **Relay 2**: GPIO 27 (🔌 Power icon)
- **Relay 3**: GPIO 22 (🌀 Fan icon)
- **Relay 4**: GPIO 23 (💡 Light Bulb icon)

### Wiring

For Raspberry Pi Zero W2, connect your relay modules as follows:

```
Raspberry Pi GPIO    →    Relay Module
------------------------------------------
GPIO 17 (Pin 11)     →    Relay 1 IN
GPIO 27 (Pin 13)     →    Relay 2 IN
GPIO 22 (Pin 15)     →    Relay 3 IN
GPIO 23 (Pin 16)     →    Relay 4 IN
GND     (Pin 6)      →    GND
5V      (Pin 2)      →    VCC (if relay needs 5V)
```

**Important Notes:**
- Configure relay type (NO/NC) in settings based on your relay module
- **Normally Open (NO)**: Relay activates when GPIO is HIGH
- **Normally Closed (NC)**: Relay activates when GPIO is LOW
- Use appropriate power supply for your relay modules
- Consider using optocouplers for electrical isolation
- Check your relay module's voltage requirements (3.3V or 5V)

## Installation

The plugin will be automatically discovered when placed in the `plugins/` directory.

### Dependencies

The plugin requires `RPi.GPIO` which will be installed automatically:

```bash
pip install RPi.GPIO
```

## Usage

### Enable the Plugin

1. Go to the ChitUI plugin manager
2. Find "GPIO Relay Control" in the list
3. Click "Enable"
4. The relay control buttons will appear in the top-right corner of the toolbar

### Control Relays

1. **Toggle Relay**: Click any relay button (R1, R2, R3, R4) to toggle its state
2. **Visual Feedback**:
   - **Gray button** = Relay OFF
   - **Orange button** = Relay ON
3. **Settings**: Click the settings icon to open configuration panel

### Configure Relays

1. Open **Settings** from the main ChitUI interface
2. Navigate to **Plugins** section
3. Find **GPIO Relay Control** settings
4. For each relay, you can configure:
   - **Enable/Disable**: Toggle to show/hide relay in toolbar
   - **Name**: Custom name (e.g., "Lights", "Fan", "Heater")
   - **Type**: NO (Normally Open) or NC (Normally Closed)
   - **Icon**: Choose from 6 FontAwesome icons
   - **GPIO Pin**: Change pin assignment (requires restart)
5. Click "Save Changes"
6. Only enabled relays will appear in the toolbar

## API Endpoints

The plugin provides REST API endpoints for integration:

### Get All Relay States
```
GET /plugin/gpio_relay_control/status
```

Response:
```json
{
  "relay1": {
    "name": "Relay 1",
    "pin": 17,
    "state": false,
    "enabled": true
  },
  "relay2": {
    "name": "Relay 2",
    "pin": 27,
    "state": false,
    "enabled": true
  },
  "relay3": {
    "name": "Relay 3",
    "pin": 22,
    "state": false,
    "enabled": true
  },
  "relay4": {
    "name": "Relay 4",
    "pin": 23,
    "state": false,
    "enabled": true
  },
  "gpio_available": true
}
```

### Toggle Relay
```
POST /plugin/gpio_relay_control/relay/<relay_num>/toggle
```

Where `<relay_num>` is 1, 2, 3, or 4.

Example:
```bash
curl -X POST http://localhost:8080/plugin/gpio_relay_control/relay/1/toggle
```

### Set Relay State Explicitly
```
POST /plugin/gpio_relay_control/relay/<relay_num>/set
Content-Type: application/json

{
  "state": true
}
```

### Get Configuration
```
GET /plugin/gpio_relay_control/config
```

### Update Configuration
```
POST /plugin/gpio_relay_control/config
Content-Type: application/json

{
  "relay1_name": "Lights",
  "relay1_enabled": true,
  "relay1_type": "NO",
  "relay1_icon": "fa-lightbulb",
  "relay1_pin": 17,
  "relay2_name": "Fan",
  "relay2_enabled": true,
  "relay2_type": "NO",
  "relay2_icon": "fa-fan",
  "relay2_pin": 27,
  "show_text": true
}
```

**Note**: Changing GPIO pins requires restarting ChitUI.

## Socket.IO Events

### Client → Server

**Toggle Relay:**
```javascript
socket.emit('gpio_relay_toggle', {
  relay: 1  // Relay number (1, 2, 3, or 4)
});
```

**Request Status:**
```javascript
socket.emit('gpio_relay_request_status');
```

### Server → Client

**State Changed:**
```javascript
socket.on('gpio_relay_state_changed', function(data) {
  console.log(data.relay);  // Relay number
  console.log(data.state);  // true (ON) or false (OFF)
});
```

**Status Update:**
```javascript
socket.on('gpio_relay_status', function(data) {
  console.log(data);  // Full status object
});
```

**Config Updated:**
```javascript
socket.on('gpio_relay_config_updated', function(config) {
  console.log(config);  // Updated configuration
});
```

## Configuration Files

### Plugin Config
Location: `~/.chitui/gpio_relay_config.json`

Contains:
- GPIO pin assignments (relay1_pin through relay4_pin)
- Relay names (relay1_name through relay4_name)
- Relay types (relay1_type through relay4_type: NO or NC)
- Relay icons (relay1_icon through relay4_icon)
- Enable states (relay1_enabled through relay4_enabled)
- Last known relay states (relay1_state through relay4_state)
- Display settings (show_text)

### Plugin Settings
Location: `~/.chitui/plugin_settings.json`

Contains:
- Plugin enable/disable state

## Troubleshooting

### Buttons Not Appearing

1. Check plugin is enabled in plugin manager
2. Refresh the browser page
3. Check browser console for JavaScript errors

### Relays Not Responding

1. **Check GPIO Permissions:**
   ```bash
   sudo usermod -a -G gpio $USER
   ```
   Log out and log back in

2. **Check RPi.GPIO Installation:**
   ```bash
   python3 -c "import RPi.GPIO; print('GPIO Available')"
   ```

3. **Check Wiring:**
   - Verify GPIO pin connections
   - Check relay module power supply
   - Test with multimeter

### Simulation Mode Warning

If you see "Running in simulation mode":
- RPi.GPIO is not available
- Plugin will work but won't control actual GPIO pins
- Good for testing without hardware

### Permission Denied Errors

Run ChitUI with sudo if GPIO access is denied:
```bash
sudo python3 main.py
```

Or add user to gpio group:
```bash
sudo usermod -a -G gpio $USER
```

## Safety Considerations

⚠️ **Important Safety Notes:**

1. **Electrical Safety**
   - Never work on live circuits
   - Use proper insulation and enclosures
   - Consider using optocouplers for isolation

2. **Relay Ratings**
   - Don't exceed relay voltage/current ratings
   - Use appropriately rated relays for your load
   - Consider inrush current for motors and transformers

3. **GPIO Protection**
   - Use current-limiting resistors if needed
   - Don't connect GPIO directly to high voltage
   - Consider using relay modules with built-in protection

4. **Testing**
   - Test with low-voltage loads first
   - Verify relay activation before connecting critical loads
   - Have a manual override/emergency stop

## Customization

### Change GPIO Pins

Edit the configuration in `~/.chitui/gpio_relay_config.json` or use the settings panel:

```json
{
  "relay1_pin": 17,
  "relay2_pin": 27,
  "relay3_pin": 22,
  "relay4_pin": 23
}
```

**Note:** Restart ChitUI after changing GPIO pins.

### Disable Unused Relays

If you're only using 2 or 3 relays, you can disable the unused ones:

1. Open Settings → Plugins → GPIO Relay Control
2. Toggle off the "Enabled" switch for unused relays
3. Click "Save Changes"
4. Only enabled relays will appear in the toolbar

### Available Icons

Choose from these FontAwesome icons:
- ⚡ `fa-bolt` - Lightning Bolt
- 🔌 `fa-power-off` - Power
- 🌀 `fa-fan` - Fan
- 💧 `fa-droplet` - Water Drop
- 💡 `fa-lightbulb` - Light Bulb
- 🔥 `fa-fire` - Heater

## License

This plugin is part of the ChitUI project.

## Support

For issues and questions, please refer to the main ChitUI documentation or create an issue in the project repository.

## Version History

### v1.1.0 (Current)
- 4 relay support (added 4th relay)
- Enable/disable controls for each relay
- NO/NC relay type configuration
- Custom icon selection (6 FontAwesome icons)
- Improved settings panel
- Smart pin validation (only checks enabled relays)

### v1.0.0
- Initial release
- 3 relay control
- Toolbar integration
- Real-time Socket.IO updates
- Configuration modal
- Persistent state storage
