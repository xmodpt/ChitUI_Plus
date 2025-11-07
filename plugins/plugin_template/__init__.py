"""
ChitUI Plugin Template

Copy this template to create your own plugin.

1. Rename this directory from 'plugin_template' to 'your_plugin_name'
2. Update plugin.json with your plugin information
3. Implement the methods below
4. Create HTML templates in templates/ directory
5. Add static assets (CSS, JS, images) in static/ directory
6. ZIP the directory and install via Settings → Plugins
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from plugins.base import ChitUIPlugin
from flask import Blueprint, jsonify


class Plugin(ChitUIPlugin):
    """Your plugin implementation"""

    def __init__(self, plugin_dir):
        super().__init__(plugin_dir)
        # Initialize your plugin variables here
        self.data = {}

    # ============================================
    # REQUIRED METHODS
    # ============================================

    def get_name(self):
        """Return the plugin name"""
        return "Plugin Template"

    def get_version(self):
        """Return the plugin version"""
        return "1.0.0"

    # ============================================
    # OPTIONAL METHODS
    # ============================================

    def get_description(self):
        """Return the plugin description"""
        return "A template for creating ChitUI plugins"

    def get_author(self):
        """Return the plugin author"""
        return "Your Name"

    def get_dependencies(self):
        """
        Return list of Python package dependencies.
        These will be installed automatically when the plugin is enabled.

        Example:
            return ['requests>=2.25.0', 'pillow', 'pandas']
        """
        return []

    # ============================================
    # LIFECYCLE HOOKS
    # ============================================

    def on_startup(self, app, socketio):
        """
        Called when the plugin is loaded at application startup.

        Args:
            app: Flask application instance
            socketio: SocketIO instance

        Use this to:
        - Initialize your plugin
        - Create Flask blueprints for custom routes
        - Set up background tasks
        """
        print(f"{self.get_name()} plugin started!")

        # Store references
        self.socketio = socketio
        self.app = app

        # Create Flask blueprint for custom API routes (optional)
        self.blueprint = Blueprint(
            'plugin_template',
            __name__,
            static_folder=self.get_static_folder(),
            template_folder=self.get_template_folder()
        )

        # Example custom route
        @self.blueprint.route('/example')
        def example_route():
            return jsonify({
                'message': 'Hello from plugin!',
                'data': self.data
            })

    def on_shutdown(self):
        """
        Called when the plugin is disabled or app shuts down.

        Use this to:
        - Clean up resources
        - Close files
        - Stop background threads
        """
        print(f"{self.get_name()} plugin shutting down")

    def on_printer_connected(self, printer_id, printer_info):
        """
        Called when a printer connects.

        Args:
            printer_id: Unique printer identifier (MainboardID)
            printer_info: Dict with printer information
                {
                    'connection': printer_id,
                    'name': 'Printer Name',
                    'model': 'Model Name',
                    'brand': 'Brand Name',
                    'ip': '192.168.1.100',
                    'protocol': 'SDCP',
                    'firmware': '1.0.0'
                }
        """
        print(f"Printer connected: {printer_info.get('name', 'Unknown')} ({printer_id})")
        # Store printer info if needed
        self.data[printer_id] = {
            'connected': True,
            'info': printer_info
        }

    def on_printer_disconnected(self, printer_id):
        """
        Called when a printer disconnects.

        Args:
            printer_id: Unique printer identifier
        """
        print(f"Printer disconnected: {printer_id}")
        if printer_id in self.data:
            self.data[printer_id]['connected'] = False

    def on_printer_message(self, printer_id, message):
        """
        Called when a message is received from a printer.

        This is called for EVERY message from ANY printer. Use this to:
        - Monitor printer activity
        - Track statistics
        - React to specific events
        - Log communication

        Args:
            printer_id: Unique printer identifier
            message: Dict with message data
                {
                    'Topic': 'sdcp/status/...',
                    'MainboardID': printer_id,
                    'Status': {...},
                    'Data': {...}
                }

        Example message types:
        - sdcp/status/* - Printer status updates
        - sdcp/response/* - Command responses
        - sdcp/attributes/* - Printer attributes
        - sdcp/error/* - Error messages
        - sdcp/notice/* - Notice messages
        """
        # Example: Count messages per printer
        if printer_id not in self.data:
            self.data[printer_id] = {'message_count': 0}
        self.data[printer_id]['message_count'] = self.data[printer_id].get('message_count', 0) + 1

        # Example: React to specific topics
        topic = message.get('Topic', '')
        if 'status' in topic:
            # Handle status messages
            pass
        elif 'error' in topic:
            # Handle errors
            pass

    # ============================================
    # ADVANCED FEATURES
    # ============================================

    def register_socket_handlers(self, socketio):
        """
        Register custom SocketIO event handlers.

        Args:
            socketio: SocketIO instance

        Use this to handle custom events from the frontend.
        """
        @socketio.on('plugin_template_event')
        def handle_custom_event(data):
            """Handle custom event from frontend JavaScript"""
            print(f"Received custom event: {data}")

            # Process data
            result = self.process_data(data)

            # Send response back to frontend
            socketio.emit('plugin_template_response', {
                'success': True,
                'result': result
            })

    def process_data(self, data):
        """Example method for processing data"""
        return {'processed': True, 'input': data}

    # ============================================
    # UI INTEGRATION
    # ============================================

    def get_ui_integration(self):
        """
        Return UI integration configuration.

        Returns:
            Dict with UI configuration or None to disable UI

        Types:
        - 'card': Displays as a card on the main page
        - 'toolbar': Adds a button to the toolbar
        - 'tab': Adds a tab next to Status, Files, etc.
        - 'modal': Creates a modal dialog

        Example configurations:

        Card:
            {
                'type': 'card',
                'location': 'main',
                'icon': 'bi-puzzle',
                'title': 'My Plugin',
                'template': 'my_template.html'
            }

        Toolbar:
            {
                'type': 'toolbar',
                'location': 'top',
                'icon': 'bi-gear',
                'title': 'Settings'
            }

        Tab:
            {
                'type': 'tab',
                'location': 'printer-info',
                'icon': 'bi-graph-up',
                'title': 'Statistics',
                'template': 'stats.html'
            }

        Modal:
            {
                'type': 'modal',
                'icon': 'bi-info-circle',
                'title': 'About',
                'template': 'about.html'
            }
        """
        return {
            'type': 'card',
            'location': 'main',
            'icon': 'bi-puzzle',
            'title': 'Plugin Template',
            'template': 'plugin_template.html'
        }
