/**
 * ChitUI Plugin System - Frontend
 *
 * Handles dynamic loading and management of plugins in the UI
 */

// Plugin state
let pluginData = [];

/**
 * Load and inject plugin UI elements into the page
 */
function loadPluginUI() {
  console.log('Loading plugin UI...');

  fetch('/plugins/ui')
    .then(response => response.json())
    .then(plugins => {
      console.log('Loaded plugins:', plugins);

      plugins.forEach(plugin => {
        injectPluginUI(plugin);
      });
    })
    .catch(error => {
      console.error('Failed to load plugin UI:', error);
    });
}

/**
 * Inject a plugin's UI into the appropriate location
 */
function injectPluginUI(plugin) {
  const { type, location, html, plugin_id, title, icon } = plugin;

  if (!html) {
    console.warn(`Plugin ${plugin_id} has no HTML to inject`);
    return;
  }

  console.log(`Injecting plugin ${plugin_id} (${type}) into ${location}`);

  switch (type) {
    case 'card':
      injectCard(plugin);
      break;
    case 'toolbar':
      injectToolbar(plugin);
      break;
    case 'tab':
      injectTab(plugin);
      break;
    case 'modal':
      injectModal(plugin);
      break;
    default:
      console.warn(`Unknown plugin type: ${type}`);
  }
}

/**
 * Inject a plugin as a card in the main content area
 */
function injectCard(plugin) {
  const container = document.querySelector('.app-content');
  if (!container) {
    console.error('Card container not found');
    return;
  }

  const pluginDiv = document.createElement('div');
  pluginDiv.id = `plugin-${plugin.plugin_id}`;
  pluginDiv.className = 'plugin-card';
  pluginDiv.innerHTML = plugin.html;

  container.appendChild(pluginDiv);
}

/**
 * Inject a plugin into the toolbar
 */
function injectToolbar(plugin) {
  const toolbar = document.querySelector('.toolbar'); // Adjust selector as needed
  if (!toolbar) {
    console.error('Toolbar not found');
    return;
  }

  const button = document.createElement('button');
  button.className = 'btn btn-sm btn-outline-secondary';
  button.innerHTML = `<i class="${plugin.icon}"></i> ${plugin.title}`;
  button.onclick = () => {
    // Toggle plugin visibility or open modal
    const pluginEl = document.getElementById(`plugin-${plugin.plugin_id}`);
    if (pluginEl) {
      pluginEl.classList.toggle('d-none');
    }
  };

  toolbar.appendChild(button);
}

/**
 * Inject a plugin as a tab
 */
function injectTab(plugin) {
  // Add to navigation tabs
  const navTabs = document.getElementById('navTabs');
  if (!navTabs) {
    console.error('Nav tabs not found');
    return;
  }

  const tab = document.createElement('li');
  tab.className = 'nav-item';
  tab.innerHTML = `
    <button class="nav-link" id="tab-${plugin.plugin_id}"
            data-bs-toggle="pill" data-bs-target="#tab${plugin.plugin_id}"
            type="button">
      <i class="${plugin.icon}"></i> ${plugin.title}
    </button>
  `;
  navTabs.appendChild(tab);

  // Add content pane
  const navPanes = document.getElementById('navPanes');
  if (!navPanes) {
    console.error('Nav panes not found');
    return;
  }

  const pane = document.createElement('div');
  pane.className = 'tab-pane fade';
  pane.id = `tab${plugin.plugin_id}`;
  pane.innerHTML = plugin.html;
  navPanes.appendChild(pane);
}

/**
 * Inject a plugin as a modal
 */
function injectModal(plugin) {
  const body = document.body;

  const modalDiv = document.createElement('div');
  modalDiv.id = `plugin-modal-${plugin.plugin_id}`;
  modalDiv.innerHTML = plugin.html;

  body.appendChild(modalDiv);
}

/**
 * Load plugin list for management UI
 */
function loadPluginList() {
  return fetch('/plugins')
    .then(response => response.json())
    .then(data => {
      pluginData = data;
      return data;
    });
}

/**
 * Enable a plugin
 */
function enablePlugin(pluginId) {
  return fetch(`/plugins/${pluginId}/enable`, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Plugin ${pluginId} enabled`);
        // Reload page to load the plugin
        window.location.reload();
      } else {
        console.error(`Failed to enable plugin: ${data.message}`);
        alert(`Failed to enable plugin: ${data.message}`);
      }
    });
}

/**
 * Disable a plugin
 */
function disablePlugin(pluginId) {
  return fetch(`/plugins/${pluginId}/disable`, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Plugin ${pluginId} disabled`);
        // Reload page to unload the plugin
        window.location.reload();
      } else {
        console.error(`Failed to disable plugin: ${data.message}`);
        alert(`Failed to disable plugin: ${data.message}`);
      }
    });
}

/**
 * Render plugin manager UI
 */
function renderPluginManager() {
  loadPluginList().then(plugins => {
    const container = document.getElementById('pluginManagerList');
    if (!container) return;

    container.innerHTML = '';

    if (plugins.length === 0) {
      container.innerHTML = '<p class="text-muted">No plugins available</p>';
      return;
    }

    plugins.forEach(plugin => {
      const card = document.createElement('div');
      card.className = 'card mb-3';
      card.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h5 class="card-title">${plugin.name}</h5>
              <p class="card-text text-muted small">${plugin.description}</p>
              <p class="card-text">
                <small class="text-muted">
                  Version: ${plugin.version} | Author: ${plugin.author}
                </small>
              </p>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox"
                     id="plugin-toggle-${plugin.id}"
                     ${plugin.enabled ? 'checked' : ''}
                     onchange="togglePlugin('${plugin.id}', this.checked)">
              <label class="form-check-label" for="plugin-toggle-${plugin.id}">
                ${plugin.enabled ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

/**
 * Toggle plugin enabled/disabled
 */
function togglePlugin(pluginId, enabled) {
  if (enabled) {
    enablePlugin(pluginId);
  } else {
    disablePlugin(pluginId);
  }
}

// Initialize plugins on page load
document.addEventListener('DOMContentLoaded', () => {
  // Load plugin UI elements
  loadPluginUI();

  // If on settings page, load plugin manager
  if (document.getElementById('pluginManagerList')) {
    renderPluginManager();
  }
});
