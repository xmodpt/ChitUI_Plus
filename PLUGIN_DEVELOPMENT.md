# ChitUI Plugin Development Guide

This guide explains how to create, install, and distribute plugins for ChitUI.

## Table of Contents
- [Plugin Structure](#plugin-structure)
- [Creating Your First Plugin](#creating-your-first-plugin)
- [Plugin Manifest (plugin.json)](#plugin-manifest-pluginjson)
- [Plugin Class](#plugin-class)
- [UI Integration](#ui-integration)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Dependencies](#dependencies)
- [Installing Plugins](#installing-plugins)
- [Distributing Plugins](#distributing-plugins)
- [Example Plugins](#example-plugins)
- [Best Practices](#best-practices)

---

## Plugin Structure

Every ChitUI plugin must follow this directory structure:

```
my_plugin/                    # Plugin directory name (must be unique)
├── plugin.json               # Plugin manifest (REQUIRED)
├── __init__.py               # Plugin code with Plugin class (REQUIRED)
├── static/                   # Static assets (optional)
│   ├── css/
│   ├── js/
│   └── images/
└── templates/                # HTML templates (optional)
    └── my_plugin.html
```

### Required Files

1. **`plugin.json`** - Manifest file with plugin metadata
2. **`__init__.py`** - Python file containing the `Plugin` class

### Optional Directories

- **`static/`** - CSS, JavaScript, images for your plugin UI
- **`templates/`** - HTML templates for UI components

---

## Creating Your First Plugin

Let's create a simple "Hello World" plugin step by step.

### Step 1: Create Plugin Directory

```bash
cd chitui_plus/plugins
mkdir hello_world
cd hello_world
```

### Step 2: Create plugin.json

Create `plugin.json` with the following content:

```json
{
  "name": "Hello World",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A simple hello world plugin",
  "dependencies": [],
  "ui_integration": {
    "type": "card",
    "location": "main",
    "icon": "bi-hand-thumbs-up",
    "title": "Hello World"
  }
}
```

### Step 3: Create __init__.py

Create `__init__.py` with your plugin code:

```python
"""
Hello World Plugin for ChitUI
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from plugins.base import ChitUIPlugin
from flask import Blueprint


class Plugin(ChitUIPlugin):
    """Hello World plugin implementation"""

    def __init__(self, plugin_dir):
        super().__init__(plugin_dir)

    def get_name(self):
        return "Hello World"

    def get_version(self):
        return "1.0.0"

    def get_description(self):
        return "A simple hello world plugin"

    def get_author(self):
        return "Your Name"

    def on_startup(self, app, socketio):
        """Initialize the plugin"""
        print("Hello World plugin started!")

        # Create Flask blueprint for custom routes (optional)
        self.blueprint = Blueprint(
            'hello_world',
            __name__,
            static_folder=self.get_static_folder(),
            template_folder=self.get_template_folder()
        )

        # Register a custom route
        @self.blueprint.route('/greet')
        def greet():
            return {"message": "Hello from the plugin!"}

    def on_printer_connected(self, printer_id, printer_info):
        """Called when a printer connects"""
        print(f"Hello World: Printer {printer_id} connected!")

    def on_printer_message(self, printer_id, message):
        """Called when a printer message is received"""
        # You can process printer messages here
        pass

    def get_ui_integration(self):
        """Return UI integration configuration"""
        return {
            'type': 'card',
            'location': 'main',
            'icon': 'bi-hand-thumbs-up',
            'title': 'Hello World',
            'template': 'hello_world.html'
        }
```

### Step 4: Create UI Template (Optional)

Create `templates/hello_world.html`:

```html
<div class="card">
  <div class="card-header">
    <h5 class="mb-0">
      <i class="bi bi-hand-thumbs-up"></i> Hello World Plugin
    </h5>
  </div>
  <div class="card-body">
    <p>Welcome to your first ChitUI plugin!</p>
    <button class="btn btn-primary" id="btnGreet">
      Say Hello
    </button>
    <div id="greetMessage" class="mt-3"></div>
  </div>
</div>

<script>
document.getElementById('btnGreet').addEventListener('click', function() {
  fetch('/plugin/hello_world/greet')
    .then(r => r.json())
    .then(data => {
      document.getElementById('greetMessage').innerHTML =
        '<div class="alert alert-success">' + data.message + '</div>';
    });
});
</script>
```

### Step 5: Test Your Plugin

1. Restart ChitUI
2. The plugin will be automatically discovered
3. Go to Settings → Plugins
4. Enable your plugin
5. Reload the page
6. You should see your "Hello World" card on the main page!

---

## Plugin Manifest (plugin.json)

The `plugin.json` file contains metadata about your plugin.

### Required Fields

```json
{
  "name": "Plugin Name",           // Display name (required)
  "version": "1.0.0",               // Semantic version (required)
  "author": "Your Name"             // Author name (required)
}
```

### Optional Fields

```json
{
  "description": "What your plugin does",
  "dependencies": ["requests>=2.0.0", "pillow"],  // Python pip packages
  "ui_integration": {
    "type": "card",                  // card, toolbar, tab, or modal
    "location": "main",              // Where to display
    "icon": "bi-icon-name",          // Bootstrap icon
    "title": "Display Title",
    "template": "template.html"      // Template filename
  }
}
```

### Dependency Format

Dependencies use pip package format:

```json
"dependencies": [
  "requests",              // Latest version
  "pillow>=8.0.0",        // Minimum version
  "numpy==1.19.0"         // Exact version
]
```

---

## Plugin Class

Your `__init__.py` must contain a class named `Plugin` that inherits from `ChitUIPlugin`.

### Minimal Plugin Class

```python
from plugins.base import ChitUIPlugin

class Plugin(ChitUIPlugin):
    def get_name(self):
        return "My Plugin"

    def get_version(self):
        return "1.0.0"
```

### Available Methods

#### Required Methods

- `get_name()` - Return plugin name (string)
- `get_version()` - Return version (string)

#### Optional Methods

- `get_description()` - Return description (string)
- `get_author()` - Return author name (string)
- `get_dependencies()` - Return list of pip packages
- `get_ui_integration()` - Return UI configuration (dict)

#### Lifecycle Hooks

- `on_startup(app, socketio)` - Called when plugin loads
- `on_shutdown()` - Called when plugin is disabled
- `on_printer_connected(printer_id, printer_info)` - Printer connects
- `on_printer_disconnected(printer_id)` - Printer disconnects
- `on_printer_message(printer_id, message)` - Printer sends message

#### Advanced Methods

- `register_socket_handlers(socketio)` - Register custom SocketIO events
- `get_blueprint()` - Return Flask Blueprint for custom routes
- `get_static_folder()` - Get path to plugin's static files
- `get_template_folder()` - Get path to plugin's templates

---

## UI Integration

Plugins can integrate into the UI in different ways.

### Integration Types

#### 1. Card (Main Content Area)

```json
{
  "ui_integration": {
    "type": "card",
    "location": "main",
    "icon": "bi-terminal",
    "title": "My Card",
    "template": "my_template.html"
  }
}
```

Shows as a card on the main page below printer information.

#### 2. Toolbar Button

```json
{
  "ui_integration": {
    "type": "toolbar",
    "location": "top",
    "icon": "bi-gear",
    "title": "My Tool"
  }
}
```

Adds a button to the toolbar.

#### 3. Tab

```json
{
  "ui_integration": {
    "type": "tab",
    "location": "printer-info",
    "icon": "bi-graph-up",
    "title": "Statistics"
  }
}
```

Adds a new tab next to Status, Files, etc.

#### 4. Modal

```json
{
  "ui_integration": {
    "type": "modal",
    "icon": "bi-info-circle",
    "title": "About"
  }
}
```

Creates a modal dialog.

---

## Lifecycle Hooks

### on_startup(app, socketio)

Called when the plugin is loaded at application startup.

```python
def on_startup(self, app, socketio):
    self.socketio = socketio
    self.app = app

    # Initialize your plugin
    self.data = {}

    # Create Flask blueprint
    self.blueprint = Blueprint('my_plugin', __name__)

    @self.blueprint.route('/api/data')
    def get_data():
        return jsonify(self.data)
```

### on_printer_connected(printer_id, printer_info)

Called when a printer connects.

```python
def on_printer_connected(self, printer_id, printer_info):
    print(f"Printer connected: {printer_info['name']}")
    self.printers[printer_id] = printer_info
```

### on_printer_message(printer_id, message)

Called for every message from a printer. Great for monitoring!

```python
def on_printer_message(self, printer_id, message):
    # Monitor specific commands
    if 'status' in message.get('Topic', ''):
        print(f"Status update from {printer_id}")

    # Log all messages
    self.message_log.append({
        'printer': printer_id,
        'message': message,
        'timestamp': time.time()
    })
```

### register_socket_handlers(socketio)

Register custom SocketIO event handlers.

```python
def register_socket_handlers(self, socketio):
    @socketio.on('my_custom_event')
    def handle_custom_event(data):
        # Handle custom event from frontend
        print('Received custom event:', data)
        socketio.emit('my_response', {'status': 'ok'})
```

---

## Dependencies

Plugins can specify Python package dependencies that will be automatically installed.

### Declaring Dependencies

In `plugin.json`:

```json
{
  "dependencies": [
    "requests>=2.25.0",
    "pillow",
    "pandas>=1.0.0"
  ]
}
```

Or in `__init__.py`:

```python
def get_dependencies(self):
    return [
        "requests>=2.25.0",
        "pillow",
        "pandas>=1.0.0"
    ]
```

### Installation

Dependencies are installed automatically when the plugin is enabled:

```python
# In base plugin class
def install_dependencies(self):
    import subprocess
    deps = self.get_dependencies()
    for dep in deps:
        subprocess.check_call(['pip', 'install', dep])
```

---

## Installing Plugins

### Method 1: Via UI (Recommended)

1. **Open ChitUI** in your browser
2. Click **Settings** (gear icon)
3. Go to **Plugins** tab
4. Click **Choose File** under "Install New Plugin"
5. Select your plugin ZIP file
6. Click **Upload**
7. Page will reload automatically
8. Enable the plugin with the toggle switch

### Method 2: Manual Installation

1. Copy your plugin directory to `chitui_plus/plugins/`:
   ```bash
   cp -r my_plugin chitui_plus/plugins/
   ```

2. Restart ChitUI:
   ```bash
   python main.py
   ```

3. Plugin will be automatically discovered
4. Enable it in Settings → Plugins

---

## Distributing Plugins

### Creating a Plugin Package

To distribute your plugin, package it as a ZIP file:

```bash
# From the plugins directory
cd chitui_plus/plugins
zip -r my_plugin.zip my_plugin/
```

### ZIP Structure

The ZIP must contain a single directory with your plugin:

```
my_plugin.zip
└── my_plugin/
    ├── plugin.json
    ├── __init__.py
    ├── static/
    └── templates/
```

**Important:** Don't zip individual files! The ZIP must contain the plugin directory.

❌ **Wrong:**
```
my_plugin.zip
├── plugin.json
└── __init__.py
```

✅ **Correct:**
```
my_plugin.zip
└── my_plugin/
    ├── plugin.json
    └── __init__.py
```

### Sharing Your Plugin

You can share your plugin by:

1. **GitHub** - Create a repository with your plugin
2. **GitHub Releases** - Attach the ZIP to a release
3. **Direct Download** - Host the ZIP on your website
4. **ChitUI Plugin Repository** (Coming Soon!)

---

## Example Plugins

### Terminal Plugin

The included Terminal plugin is a great example showing:

- Real-time message monitoring
- Custom SocketIO handlers
- Command sending to printers
- Card UI integration

Location: `plugins/terminal/`

### Custom Statistics Plugin Example

```python
"""
Statistics Plugin - Track printer usage
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from plugins.base import ChitUIPlugin
from flask import Blueprint, jsonify
import json

class Plugin(ChitUIPlugin):
    def __init__(self, plugin_dir):
        super().__init__(plugin_dir)
        self.stats = {}
        self.stats_file = os.path.expanduser('~/.chitui/plugin_stats.json')
        self.load_stats()

    def get_name(self):
        return "Statistics"

    def get_version(self):
        return "1.0.0"

    def load_stats(self):
        if os.path.exists(self.stats_file):
            with open(self.stats_file, 'r') as f:
                self.stats = json.load(f)

    def save_stats(self):
        os.makedirs(os.path.dirname(self.stats_file), exist_ok=True)
        with open(self.stats_file, 'w') as f:
            json.dump(self.stats, f)

    def on_startup(self, app, socketio):
        self.blueprint = Blueprint('statistics', __name__)

        @self.blueprint.route('/stats')
        def get_stats():
            return jsonify(self.stats)

    def on_printer_message(self, printer_id, message):
        if printer_id not in self.stats:
            self.stats[printer_id] = {
                'messages': 0,
                'prints': 0
            }

        self.stats[printer_id]['messages'] += 1

        # Count prints
        if 'PrintInfo' in message:
            self.stats[printer_id]['prints'] += 1

        self.save_stats()

    def get_ui_integration(self):
        return {
            'type': 'card',
            'location': 'main',
            'icon': 'bi-graph-up',
            'title': 'Statistics',
            'template': 'statistics.html'
        }
```

---

## Best Practices

### 1. Naming Convention

- **Plugin directory:** lowercase with underscores (`my_plugin`)
- **Plugin name:** User-friendly (`My Plugin`)
- **Class name:** Always `Plugin`

### 2. Error Handling

Always wrap printer message handling in try-except:

```python
def on_printer_message(self, printer_id, message):
    try:
        # Your code here
        pass
    except Exception as e:
        print(f"Error in plugin: {e}")
```

### 3. Resource Cleanup

Clean up resources in `on_shutdown()`:

```python
def on_shutdown(self):
    # Close files
    if self.log_file:
        self.log_file.close()

    # Stop threads
    if self.worker_thread:
        self.worker_thread.stop()
```

### 4. Non-Blocking Operations

Don't block the main thread in event handlers:

```python
def on_printer_message(self, printer_id, message):
    # ✅ Good - quick processing
    self.message_count += 1

    # ❌ Bad - slow operation
    # time.sleep(5)

    # ✅ Good - run in background
    threading.Thread(target=self.process_message, args=(message,)).start()
```

### 5. Configuration

Store plugin settings in user directory:

```python
def __init__(self, plugin_dir):
    super().__init__(plugin_dir)
    self.config_file = os.path.expanduser('~/.chitui/my_plugin_config.json')
    self.load_config()

def load_config(self):
    if os.path.exists(self.config_file):
        with open(self.config_file, 'r') as f:
            self.config = json.load(f)
```

### 6. Security

- **Validate input** from users
- **Sanitize** printer data before displaying
- **Escape HTML** in templates
- **Don't execute** arbitrary code from printer

```python
# ✅ Good
def handle_command(self, command):
    if command in ['start', 'stop', 'pause']:
        self.execute(command)
    else:
        raise ValueError("Invalid command")

# ❌ Bad
def handle_command(self, command):
    eval(command)  # NEVER DO THIS!
```

### 7. Documentation

Include a README.md with your plugin:

```markdown
# My Plugin

Description of what your plugin does.

## Features
- Feature 1
- Feature 2

## Installation
Upload the ZIP file via Settings → Plugins

## Usage
1. Enable the plugin
2. Access via the main dashboard

## Configuration
No configuration needed

## Changelog
### 1.0.0
- Initial release
```

---

## Troubleshooting

### Plugin Not Loading

**Check the console logs:**
```bash
python main.py
# Look for plugin loading messages
```

**Common issues:**
- Missing `plugin.json` or `__init__.py`
- Invalid JSON in `plugin.json`
- Python syntax errors in `__init__.py`
- Missing `Plugin` class

### Dependencies Not Installing

Check pip is available:
```bash
pip --version
```

Manually install dependencies:
```bash
pip install your-dependency
```

### UI Not Showing

- Check `get_ui_integration()` returns correct config
- Verify template file exists
- Check template HTML is valid
- Look for JavaScript errors in browser console

---

## API Reference

### ChitUIPlugin Base Class

Full API available in `plugins/base.py`

**Key Methods:**
- `get_name()` → str
- `get_version()` → str
- `get_description()` → str
- `get_author()` → str
- `get_dependencies()` → list
- `on_startup(app, socketio)` → None
- `on_shutdown()` → None
- `on_printer_connected(printer_id, printer_info)` → None
- `on_printer_disconnected(printer_id)` → None
- `on_printer_message(printer_id, message)` → None
- `register_socket_handlers(socketio)` → None
- `get_blueprint()` → Blueprint
- `get_ui_integration()` → dict

---

## Need Help?

- Check the Terminal plugin source code for a complete example
- Review `plugins/base.py` for all available methods
- Open an issue on GitHub for questions
- Join the ChitUI community

Happy Plugin Development! 🎉
