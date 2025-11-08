"""
GPIO Relay Control Plugin for ChitUI
Allows control of up to 4 GPIO relays with customizable settings
"""

from plugins.base import ChitUIPlugin
from flask import Blueprint, jsonify, request, render_template
import json
import os
import threading

# Try to import GPIO, but allow the plugin to work without it (for testing)
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    GPIO_AVAILABLE = False
    print("GPIO Relay Plugin: RPi.GPIO not available - running in simulation mode")


class Plugin(ChitUIPlugin):
    """GPIO Relay Control Plugin"""

    def __init__(self, plugin_dir):
        super().__init__(plugin_dir)
        self.config_file = os.path.expanduser('~/.chitui/gpio_relays_config.json')
        self.gpio_lock = threading.Lock()
        self.relay_states = {}

        # Default configuration for 4 relays
        self.config = {
            'relay1': {
                'enabled': False,
                'name': 'Relay 1',
                'icon': 'fa-solid fa-power-off',
                'gpio_pin': 17,
                'mode': 'NO',  # NO = Normally Open, NC = Normally Closed
                'state': False
            },
            'relay2': {
                'enabled': False,
                'name': 'Relay 2',
                'icon': 'fa-solid fa-lightbulb',
                'gpio_pin': 27,
                'mode': 'NO',
                'state': False
            },
            'relay3': {
                'enabled': False,
                'name': 'Relay 3',
                'icon': 'fa-solid fa-fire',
                'gpio_pin': 22,
                'mode': 'NO',
                'state': False
            },
            'relay4': {
                'enabled': False,
                'name': 'Relay 4',
                'icon': 'fa-solid fa-fan',
                'gpio_pin': 23,
                'mode': 'NO',
                'state': False
            }
        }

        # Load saved configuration
        self.load_config()

    def get_name(self):
        return "GPIO Relay Control"

    def get_version(self):
        return "1.0.0"

    def load_config(self):
        """Load configuration from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    saved_config = json.load(f)
                    # Merge saved config with defaults to ensure all fields exist
                    for relay_id in self.config.keys():
                        if relay_id in saved_config:
                            self.config[relay_id].update(saved_config[relay_id])
                print(f"GPIO Relays: Loaded configuration from {self.config_file}")
        except Exception as e:
            print(f"GPIO Relays: Error loading configuration: {e}")

    def save_config(self):
        """Save configuration to file"""
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            print(f"GPIO Relays: Saved configuration to {self.config_file}")
        except Exception as e:
            print(f"GPIO Relays: Error saving configuration: {e}")

    def init_gpio(self):
        """Initialize GPIO pins for enabled relays"""
        if not GPIO_AVAILABLE:
            print("GPIO Relays: Running in simulation mode (no actual GPIO control)")
            return

        try:
            with self.gpio_lock:
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)

                for relay_id, relay in self.config.items():
                    if relay['enabled']:
                        pin = relay['gpio_pin']
                        GPIO.setup(pin, GPIO.OUT)

                        # Set initial state based on mode
                        # NO (Normally Open): LOW = OFF, HIGH = ON
                        # NC (Normally Closed): HIGH = OFF, LOW = ON
                        initial_state = GPIO.LOW if relay['mode'] == 'NO' else GPIO.HIGH
                        GPIO.output(pin, initial_state)
                        self.relay_states[relay_id] = False

                        print(f"GPIO Relays: Initialized {relay_id} on GPIO {pin} (mode: {relay['mode']})")
        except Exception as e:
            print(f"GPIO Relays: Error initializing GPIO: {e}")

    def cleanup_gpio(self):
        """Cleanup GPIO on shutdown"""
        if not GPIO_AVAILABLE:
            return

        try:
            with self.gpio_lock:
                # Turn off all relays before cleanup
                for relay_id, relay in self.config.items():
                    if relay['enabled']:
                        self.set_relay(relay_id, False)

                GPIO.cleanup()
                print("GPIO Relays: GPIO cleanup completed")
        except Exception as e:
            print(f"GPIO Relays: Error during GPIO cleanup: {e}")

    def set_relay(self, relay_id, state):
        """
        Set relay state
        Args:
            relay_id: The relay identifier (relay1, relay2, etc.)
            state: True for ON, False for OFF
        """
        if relay_id not in self.config:
            return False

        relay = self.config[relay_id]

        if not relay['enabled']:
            print(f"GPIO Relays: {relay_id} is disabled")
            return False

        if GPIO_AVAILABLE:
            try:
                with self.gpio_lock:
                    pin = relay['gpio_pin']
                    mode = relay['mode']

                    # Calculate GPIO state based on relay mode
                    if mode == 'NO':  # Normally Open
                        gpio_state = GPIO.HIGH if state else GPIO.LOW
                    else:  # Normally Closed
                        gpio_state = GPIO.LOW if state else GPIO.HIGH

                    GPIO.output(pin, gpio_state)
                    self.relay_states[relay_id] = state
                    self.config[relay_id]['state'] = state
                    self.save_config()

                    print(f"GPIO Relays: Set {relay_id} to {'ON' if state else 'OFF'} (GPIO {pin} = {'HIGH' if gpio_state == GPIO.HIGH else 'LOW'})")
                    return True
            except Exception as e:
                print(f"GPIO Relays: Error setting relay state: {e}")
                return False
        else:
            # Simulation mode
            self.relay_states[relay_id] = state
            self.config[relay_id]['state'] = state
            self.save_config()
            print(f"GPIO Relays: [SIMULATION] Set {relay_id} to {'ON' if state else 'OFF'}")
            return True

    def on_startup(self, app, socketio):
        """Called when plugin is loaded"""
        # Create Blueprint for routes
        self.blueprint = Blueprint('gpio_relays', __name__,
                                   template_folder='templates',
                                   static_folder=None)

        # Route: Get plugin UI
        @self.blueprint.route('/plugin/gpio_relays/ui')
        def get_ui():
            return render_template('gpio_relays.html', config=self.config)

        # Route: Get configuration
        @self.blueprint.route('/plugin/gpio_relays/config')
        def get_config():
            return jsonify(self.config)

        # Route: Save configuration
        @self.blueprint.route('/plugin/gpio_relays/config', methods=['POST'])
        def save_config_route():
            try:
                new_config = request.json

                # Cleanup old GPIO settings
                self.cleanup_gpio()

                # Update configuration
                for relay_id in self.config.keys():
                    if relay_id in new_config:
                        self.config[relay_id].update(new_config[relay_id])

                # Save to file
                self.save_config()

                # Re-initialize GPIO with new settings
                self.init_gpio()

                return jsonify({'success': True, 'config': self.config})
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500

        # Route: Toggle relay
        @self.blueprint.route('/plugin/gpio_relays/toggle/<relay_id>', methods=['POST'])
        def toggle_relay(relay_id):
            if relay_id not in self.config:
                return jsonify({'success': False, 'error': 'Invalid relay ID'}), 400

            current_state = self.relay_states.get(relay_id, False)
            new_state = not current_state

            success = self.set_relay(relay_id, new_state)

            return jsonify({
                'success': success,
                'relay_id': relay_id,
                'state': new_state
            })

        # Route: Get relay states
        @self.blueprint.route('/plugin/gpio_relays/states')
        def get_states():
            return jsonify(self.relay_states)

        # Register blueprint
        app.register_blueprint(self.blueprint)

        # Initialize GPIO
        self.init_gpio()

        print("GPIO Relay Control Plugin: Started")

    def on_shutdown(self):
        """Called when plugin is disabled or app shuts down"""
        self.cleanup_gpio()
        print("GPIO Relay Control Plugin: Stopped")

    def get_ui_integration(self):
        """Return UI integration configuration"""
        return {
            'type': 'toolbar',
            'location': 'main',
            'icon': 'fa-solid fa-toggle-on',
            'title': 'GPIO Relay Control',
            'template': 'gpio_relays.html'
        }
