# Toolbar Demo Plugin

A demonstration plugin showing how to add toolbar buttons to ChitUI.

## Features

This plugin demonstrates:

- **3 Toolbar Buttons:**
  - Info button - Shows plugin information
  - Stats button - Displays click statistics
  - Quick Settings button - Example quick access settings

- **Modal Integration:**
  - Each button opens a Bootstrap modal with relevant content
  - Modals include formatted data and interactive elements

- **API Endpoints:**
  - `/plugin/toolbar_demo/stats` - Get button click statistics
  - `/plugin/toolbar_demo/click/<button_id>` - Track button clicks

- **SocketIO Integration:**
  - Real-time communication between frontend and backend
  - Custom event handlers

- **Visual Effects:**
  - Button hover animations
  - Click ripple effects
  - Bootstrap tooltips

## UI Integration

This plugin uses the `toolbar` integration type:

```json
{
  "ui_integration": {
    "type": "toolbar",
    "location": "main",
    "icon": "bi-stars",
    "title": "Toolbar Demo"
  }
}
```

## How It Works

### 1. Toolbar Injection

The plugin's HTML template contains toolbar buttons that are injected into the UI:

```html
<div class="toolbar-demo-container d-flex gap-2">
  <button class="btn btn-sm btn-outline-info">Info</button>
  <button class="btn btn-sm btn-outline-success">Stats</button>
  <button class="btn btn-sm btn-outline-warning">Quick</button>
</div>
```

### 2. Button Click Handling

Each button has a click handler that:
1. Tracks the click via API endpoint
2. Fetches relevant data
3. Displays data in a modal dialog

### 3. Statistics Tracking

The backend tracks how many times each button is clicked:

```python
self.click_counts = {
    'button1': 0,
    'button2': 0,
    'button3': 0
}
```

### 4. Modal Display

A shared modal is used to display different content based on which button was clicked:

```javascript
function showModal(title, body) {
  document.getElementById('toolbarDemoModalTitle').innerHTML = title;
  document.getElementById('toolbarDemoModalBody').innerHTML = body;
  demoModal.show();
}
```

## Customization

You can customize this plugin to:

- Change button colors and icons
- Add more buttons
- Implement different actions
- Store persistent settings
- Interact with printer data
- Send commands to printers

## Installation

1. Ensure plugin is in `plugins/toolbar_demo/` directory
2. Restart ChitUI or upload ZIP via Settings → Plugins
3. Enable the plugin
4. Reload the page
5. Toolbar buttons will appear below the printer preview section

## Usage

1. Click the **Info** button to see plugin information
2. Click the **Stats** button to view click statistics
3. Click the **Quick** button to see example settings
4. Try clicking multiple times to see the statistics update

## Technical Details

**Plugin Type:** Toolbar
**Dependencies:** None
**Backend:** Flask Blueprint with REST endpoints
**Frontend:** JavaScript with SocketIO
**UI Framework:** Bootstrap 5

## Use Cases

This pattern is useful for:

- Quick access tools and utilities
- Frequently used actions
- Settings shortcuts
- Status indicators
- Custom controls

## License

Part of ChitUI - Same license as main project
