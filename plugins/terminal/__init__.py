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

            self.log_message(printer_id, 'RECV', msg_str)
        except Exception as e:
            print(f"Error logging message: {e}")

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
