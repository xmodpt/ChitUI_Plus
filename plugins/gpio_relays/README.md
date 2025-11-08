# GPIO Relay Control Plugin

Control up to 4 GPIO-connected relays directly from the ChitUI toolbar.

## Features

- **4 Independent Relays** - Control up to 4 relays simultaneously
- **Customizable Icons** - Choose from 15 Font Awesome icons across categories:
  - Power: power-off, plug, bolt
  - Light: lightbulb, sun, moon
  - Heater: fire, temperature-high
  - Fan: fan, wind, snowflake
  - Misc: toggle-on, circle-dot, gear, play
- **Icon-Only Toolbar Buttons** - Compact 45x45px buttons with hover tooltips
- **Configurable GPIO Pins** - Assign any BCM pin (0-27) to each relay
- **NO/NC Mode Support** - Configure each relay as Normally Open or Normally Closed
- **Custom Names** - Give each relay a meaningful name (shown on hover)
- **Persistent Settings** - Configuration saved to `~/.chitui/gpio_relays_config.json`
- **Visual Feedback** - Active relays shown in green, inactive in gray
- **Self-Contained Configuration** - Configure button automatically appears in Settings → Plugins

## Installation

The plugin will automatically install its dependency (RPi.GPIO) when loaded by ChitUI.

## Configuration

1. Go to **Settings → Plugins**
2. Find "GPIO Relay Control" in the plugin list
3. Click the **Configure** button
4. For each relay you want to use:
   - **Enable** the relay
   - Set a **name** (shown on hover)
   - Select the **GPIO pin** (BCM numbering)
   - Choose **working mode**:
     - **NO (Normally Open)**: GPIO HIGH = ON, GPIO LOW = OFF
     - **NC (Normally Closed)**: GPIO LOW = ON, GPIO HIGH = OFF
   - Pick an **icon** from the grid
5. Click **Save & Reload**

## Usage

After configuration, enabled relays appear as icon buttons in the toolbar:

- Click an icon to toggle the relay ON/OFF
- Hover over the icon to see the relay name
- Green = ON, Gray = OFF

## GPIO Pin Numbering

This plugin uses **BCM (Broadcom) pin numbering**. Common pins include:

- GPIO 2, 3 (I2C)
- GPIO 17, 27, 22 (general purpose)
- GPIO 23, 24, 25 (general purpose)

**Warning**: Avoid using pins that are reserved for other functions (e.g., UART, SPI) unless you know what you're doing.

## Wiring

### Typical Relay Module Wiring

```
Raspberry Pi          Relay Module
-----------          ------------
3.3V or 5V    -->    VCC
GND           -->    GND
GPIO XX       -->    IN1 (Relay 1)
GPIO YY       -->    IN2 (Relay 2)
GPIO ZZ       -->    IN3 (Relay 3)
GPIO WW       -->    IN4 (Relay 4)
```

### Important Notes

- Most relay modules are **active LOW**, meaning they trigger when the GPIO pin is LOW
- If using an active LOW module, set the working mode to **NC (Normally Closed)**
- Always verify your relay module's specifications
- Use appropriate power supply for your relay module (some require 5V)
- **Never** connect high voltage AC directly - relays should switch low voltage DC control circuits or use proper isolation

## Safety

⚠️ **WARNING**: Working with GPIO and relays can be dangerous if not done properly:

- Always disconnect power when wiring
- Double-check connections before powering on
- Use proper fuses and circuit protection
- Never work on live AC circuits
- Consult an electrician for AC applications
- Test with low voltage DC loads first

## Troubleshooting

### Relays not responding

1. Check GPIO pin numbers (BCM mode)
2. Verify relay module wiring
3. Try toggling NO/NC mode
4. Check relay module power supply
5. Test GPIO pins with a multimeter

### "Running in simulation mode" message

This means RPi.GPIO library is not available. This is normal on non-Raspberry Pi systems. The plugin will still save settings and show UI, but won't control actual hardware.

### Configuration not saving

Check that `~/.chitui/` directory is writable:

```bash
ls -la ~/.chitui/
chmod 755 ~/.chitui/
```

## Technical Details

- **Dependency**: RPi.GPIO
- **Pin Mode**: BCM (Broadcom)
- **Thread Safety**: GPIO operations are protected with mutex locks
- **Config File**: `~/.chitui/gpio_relays_config.json`
- **API Endpoints**:
  - `GET /plugin/gpio_relays/config` - Get configuration
  - `POST /plugin/gpio_relays/config` - Save configuration
  - `POST /plugin/gpio_relays/toggle/<relay_id>` - Toggle relay
  - `GET /plugin/gpio_relays/states` - Get all relay states

## License

Part of ChitUI plugin system.
