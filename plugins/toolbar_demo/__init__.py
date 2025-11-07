"""
Toolbar Demo Plugin for ChitUI

Demonstrates how to add toolbar buttons to the ChitUI interface.
This plugin adds 3 example buttons to a toolbar in the main UI.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from plugins.base import ChitUIPlugin
from flask import Blueprint, jsonify


class Plugin(ChitUIPlugin):
    """Toolbar Demo plugin implementation"""

    def __init__(self, plugin_dir):
        super().__init__(plugin_dir)
        self.click_counts = {
            'button1': 0,
            'button2': 0,
            'button3': 0
        }

    def get_name(self):
        return "Toolbar Demo"

    def get_version(self):
        return "1.0.0"

    def get_description(self):
        return "Demonstrates toolbar button integration with 3 example buttons"

    def get_author(self):
        return "ChitUI"

    def on_startup(self, app, socketio):
        """Initialize the plugin"""
        self.socketio = socketio

        # Create Flask blueprint for plugin routes
        self.blueprint = Blueprint(
            'toolbar_demo',
            __name__,
            static_folder=self.get_static_folder(),
            template_folder=self.get_template_folder()
        )

        # API endpoint to get click counts
        @self.blueprint.route('/stats')
        def get_stats():
            return jsonify(self.click_counts)

        # API endpoint to handle button clicks
        @self.blueprint.route('/click/<button_id>', methods=['POST'])
        def handle_click(button_id):
            if button_id in self.click_counts:
                self.click_counts[button_id] += 1
                return jsonify({
                    'success': True,
                    'button': button_id,
                    'count': self.click_counts[button_id]
                })
            return jsonify({'success': False, 'message': 'Invalid button'}), 400

    def register_socket_handlers(self, socketio):
        """Register SocketIO handlers"""
        @socketio.on('toolbar_demo_action')
        def handle_action(data):
            """Handle toolbar button actions"""
            action = data.get('action')
            print(f"Toolbar Demo: Action '{action}' triggered")

            # Emit response back to client
            socketio.emit('toolbar_demo_response', {
                'action': action,
                'timestamp': data.get('timestamp'),
                'message': f'Action {action} processed!'
            })

    def get_ui_integration(self):
        """Return UI integration configuration"""
        return {
            'type': 'toolbar',
            'location': 'main',
            'icon': 'bi-stars',
            'title': 'Toolbar Demo',
            'template': 'toolbar_demo.html'
        }
