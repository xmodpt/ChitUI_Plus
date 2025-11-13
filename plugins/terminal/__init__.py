"""
Terminal Plugin for ChitUI

Provides a terminal interface to monitor printer communication
and send raw commands to the printer.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from plugins.base import ChitUIPlugin
from flask import Blueprint, render_template_string, jsonify, request
from datetime import datetime


class Plugin(ChitUIPlugin):
    """Terminal plugin implementation"""

    def __init__(self, plugin_dir):
        super().__init__(plugin_dir)
        self.message_log = []
        self.max_log_size = 1000
        self.socketio = None

        # Message filtering - only show these types
        self.filter_enabled = True
        self.allowed_message_types = {
            'system_command',  # System commands (M codes, system G-codes)
            'print_command',   # Print-related commands
            'print_status',    # Print status updates
            'system_error'     # System errors
        }

    def get_name(self):
        return "Terminal"

    def get_version(self):
        return "1.0.0"

    def get_description(self):
        return "Monitor printer communication and send raw commands"

    def get_author(self):
        return "ChitUI"

    def on_startup(self, app, socketio):
        """Initialize the plugin"""
        self.socketio = socketio

        # Create Flask blueprint for plugin routes
        self.blueprint = Blueprint(
            'terminal',
            __name__,
            static_folder=self.get_static_folder(),
            template_folder=self.get_template_folder()
        )

        # Register routes
        @self.blueprint.route('/messages')
        def get_messages():
            """Get message log"""
            return jsonify({'messages': self.message_log})

        @self.blueprint.route('/clear', methods=['POST'])
        def clear_messages():
            """Clear message log"""
            self.message_log = []
            return jsonify({'ok': True})

        @self.blueprint.route('/filter', methods=['GET'])
        def get_filter_settings():
            """Get current filter settings"""
            return jsonify({
                'enabled': self.filter_enabled,
                'allowed_types': list(self.allowed_message_types)
            })

        @self.blueprint.route('/filter', methods=['POST'])
        def update_filter_settings():
            """Update filter settings"""
            data = request.get_json()
            if 'enabled' in data:
                self.filter_enabled = bool(data['enabled'])
            return jsonify({'ok': True, 'enabled': self.filter_enabled})

    def register_socket_handlers(self, socketio):
        """Register SocketIO handlers"""

        @socketio.on('terminal_send_command')
        def handle_send_command(data):
            """Handle raw command sent from terminal"""
            printer_id = data.get('printer_id')
            command = data.get('command')

            if not printer_id or not command:
                return {'ok': False, 'msg': 'Missing printer_id or command'}

            # Log the outgoing command
            self.log_message(printer_id, 'SEND', command)

            # Emit to main app for sending to printer
            socketio.emit('terminal_command', {
                'printer_id': printer_id,
                'command': command
            })

            return {'ok': True}

    def on_printer_message(self, printer_id, message):
        """Log incoming printer messages"""
        try:
            # Format the message for display
            if isinstance(message, dict):
                import json
                msg_str = json.dumps(message, indent=2)
            else:
                msg_str = str(message)

            # Apply filtering if enabled
            if self.filter_enabled:
                message_type = self.categorize_message(msg_str)
                if message_type not in self.allowed_message_types:
                    return  # Skip this message

            self.log_message(printer_id, 'RECV', msg_str)
        except Exception as e:
            print(f"Error logging message: {e}")

    def categorize_message(self, message):
        """Categorize message type for filtering"""
        msg_lower = message.lower()

        # System errors
        if any(err in msg_lower for err in ['error', 'err:', 'fail', 'warning', 'warn:', 'exception', 'fault']):
            return 'system_error'

        # System commands (M codes and system G-codes)
        if any(cmd in msg_lower for cmd in ['m110', 'm111', 'm112', 'm115', 'm117', 'm118', 'm119',
                                              'm120', 'm121', 'm122', 'm123', 'm124', 'm125',
                                              'm503', 'm504', 'm505', 'm997', 'm999']):
            return 'system_command'

        # Print status (temperature, position, status reports)
        if any(status in msg_lower for status in ['t:', 'b:', 'ok t:', 'x:', 'y:', 'z:', 'e:',
                                                    'count ', 'printing', 'progress', 'percent',
                                                    'layer', 'position', 'busy:', 'ok b:']):
            return 'print_status'

        # Print commands (temperature control, movement, print-related)
        if any(cmd in msg_lower for cmd in ['m104', 'm105', 'm106', 'm107', 'm108', 'm109',
                                              'm140', 'm141', 'm190', 'm191',
                                              'g28', 'g29', 'g90', 'g91', 'g92',
                                              'm0', 'm1', 'm17', 'm18', 'm20', 'm21', 'm22',
                                              'm23', 'm24', 'm25', 'm26', 'm27', 'm28', 'm29',
                                              'm30', 'm31', 'm32', 'm33']):
            return 'print_command'

        # If starts with G or M followed by number, likely a command
        import re
        if re.match(r'^[gm]\d+', msg_lower.strip()):
            # Check if it's movement (G0, G1) or print-related
            if re.match(r'^g[01]\s', msg_lower.strip()):
                return 'print_command'
            # Other G/M codes as system commands
            return 'system_command'

        # Default: don't show
        return 'other'

    def log_message(self, printer_id, direction, message):
        """Add a message to the log"""
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]

        log_entry = {
            'timestamp': timestamp,
            'printer_id': printer_id,
            'direction': direction,
            'message': message
        }

        self.message_log.append(log_entry)

        # Keep log size under limit
        if len(self.message_log) > self.max_log_size:
            self.message_log = self.message_log[-self.max_log_size:]

        # Broadcast to connected clients
        if self.socketio:
            self.socketio.emit('terminal_message', log_entry)

    def get_ui_integration(self):
        """Return UI integration configuration"""
        return {
            'type': 'card',
            'location': 'main',
            'icon': 'bi-terminal',
            'title': 'Terminal',
            'template': 'terminal.html'
        }
