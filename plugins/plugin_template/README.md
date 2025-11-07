# Plugin Template

This is a template for creating ChitUI plugins.

## Quick Start

1. **Copy this directory:**
   ```bash
   cp -r plugin_template my_plugin_name
   cd my_plugin_name
   ```

2. **Edit `plugin.json`:**
   - Update `name`, `author`, `description`
   - Change `icon` to your preferred Bootstrap icon
   - Set UI integration type

3. **Edit `__init__.py`:**
   - Update `get_name()`, `get_version()`, `get_author()`
   - Implement your plugin logic in the lifecycle hooks
   - Add custom routes to the Blueprint

4. **Edit `templates/plugin_template.html`:**
   - Rename to match your plugin
   - Customize the UI
   - Add your JavaScript logic

5. **Test locally:**
   - Place in `chitui_plus/plugins/` directory
   - Restart ChitUI
   - Enable in Settings → Plugins

6. **Package for distribution:**
   ```bash
   cd ../
   zip -r my_plugin_name.zip my_plugin_name/
   ```

7. **Share:**
   - Upload to GitHub
   - Share ZIP file with users
   - Submit to ChitUI plugin repository (coming soon!)

## What's Included

- `plugin.json` - Manifest with metadata
- `__init__.py` - Plugin class with extensive comments
- `templates/plugin_template.html` - UI template with examples
- `README.md` - This file

## Features to Implement

Based on your plugin's purpose, you might want to:

### Data Collection
- Monitor printer messages in `on_printer_message()`
- Store data in local files or database
- Provide statistics and analytics

### Custom Commands
- Add Flask routes for API endpoints
- Register SocketIO handlers for real-time communication
- Send commands to printers via the main app

### UI Integration
- Create cards for dashboard display
- Add tabs for detailed views
- Create modals for settings or information

### Background Tasks
- Start threads in `on_startup()`
- Clean up in `on_shutdown()`
- Use timers for periodic updates

## Bootstrap Icons

Find icons at: https://icons.getbootstrap.com/

Popular plugin icons:
- `bi-puzzle` - Generic plugin
- `bi-terminal` - Terminal/console
- `bi-graph-up` - Statistics/analytics
- `bi-camera-video` - Camera/monitoring
- `bi-bell` - Notifications
- `bi-file-earmark-text` - Logs/files
- `bi-gear` - Settings/configuration
- `bi-shield-check` - Security
- `bi-clock-history` - History/timeline

## Need Help?

- Read the full documentation: `PLUGIN_DEVELOPMENT.md`
- Check the Terminal plugin example: `plugins/terminal/`
- Open an issue on GitHub

Happy plugin development! 🎉
