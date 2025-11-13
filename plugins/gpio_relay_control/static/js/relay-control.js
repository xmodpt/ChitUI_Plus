/**
 * GPIO Relay Control Plugin
 * JavaScript for handling relay button interactions and real-time updates
 */

(function() {
    'use strict';

    // Plugin state
    const relayState = {
        relay1: false,
        relay2: false,
        relay3: false
    };

    const relayConfig = {
        relay1_name: 'Relay 1',
        relay2_name: 'Relay 2',
        relay3_name: 'Relay 3',
        relay1_pin: 17,
        relay2_pin: 27,
        relay3_pin: 22
    };

    // Initialize plugin when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeRelayControl();
    });

    /**
     * Initialize relay control functionality
     */
    function initializeRelayControl() {
        console.log('Initializing GPIO Relay Control plugin');

        // Setup button event listeners
        setupButtonListeners();

        // Setup Socket.IO listeners
        setupSocketListeners();

        // Load initial status
        loadRelayStatus();

        // Setup settings modal
        setupSettingsModal();
    }

    /**
     * Setup button click listeners
     */
    function setupButtonListeners() {
        // Relay toggle buttons
        for (let i = 1; i <= 3; i++) {
            const btn = document.getElementById(`relay${i}-btn`);
            if (btn) {
                btn.addEventListener('click', function() {
                    toggleRelay(i);
                });
            }
        }

        // Settings button
        const settingsBtn = document.getElementById('relay-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function() {
                openSettingsModal();
            });
        }

        // Save settings button
        const saveBtn = document.getElementById('save-relay-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                saveSettings();
            });
        }
    }

    /**
     * Setup Socket.IO event listeners
     */
    function setupSocketListeners() {
        // Check if socket is available
        if (typeof socket === 'undefined') {
            console.warn('Socket.IO not available');
            return;
        }

        // Listen for state changes from server
        socket.on('gpio_relay_state_changed', function(data) {
            console.log('Relay state changed:', data);
            updateRelayButton(data.relay, data.state);
        });

        // Listen for status updates
        socket.on('gpio_relay_status', function(data) {
            console.log('Relay status received:', data);
            updateAllRelayButtons(data);
        });

        // Listen for config updates
        socket.on('gpio_relay_config_updated', function(config) {
            console.log('Config updated:', config);
            relayConfig.relay1_name = config.relay1_name;
            relayConfig.relay2_name = config.relay2_name;
            relayConfig.relay3_name = config.relay3_name;
            updateButtonTooltips();
        });
    }

    /**
     * Load initial relay status from server
     */
    function loadRelayStatus() {
        fetch('/plugin/gpio_relay_control/status')
            .then(response => response.json())
            .then(data => {
                console.log('Initial status loaded:', data);
                updateAllRelayButtons(data);

                // Check if GPIO is available
                if (!data.gpio_available) {
                    const alert = document.getElementById('gpio-status-alert');
                    if (alert) {
                        alert.style.display = 'block';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading relay status:', error);
                showNotification('Failed to load relay status', 'error');
            });
    }

    /**
     * Toggle relay state
     */
    function toggleRelay(relayNum) {
        const btn = document.getElementById(`relay${relayNum}-btn`);
        if (!btn) return;

        // Add loading state
        btn.classList.add('loading');

        // Send toggle request
        fetch(`/plugin/gpio_relay_control/relay/${relayNum}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateRelayButton(relayNum, data.state);
                showNotification(`Relay ${relayNum} ${data.state ? 'ON' : 'OFF'}`, 'success');

                // Also emit via Socket.IO if available
                if (typeof socket !== 'undefined') {
                    socket.emit('gpio_relay_toggle', { relay: relayNum });
                }
            } else {
                showNotification('Failed to toggle relay', 'error');
            }
        })
        .catch(error => {
            console.error('Error toggling relay:', error);
            showNotification('Error toggling relay', 'error');
        })
        .finally(() => {
            btn.classList.remove('loading');
        });
    }

    /**
     * Update a single relay button state
     */
    function updateRelayButton(relayNum, state) {
        const btn = document.getElementById(`relay${relayNum}-btn`);
        if (!btn) return;

        relayState[`relay${relayNum}`] = state;

        if (state) {
            btn.classList.remove('relay-off');
            btn.classList.add('relay-on');
        } else {
            btn.classList.remove('relay-on');
            btn.classList.add('relay-off');
        }
    }

    /**
     * Update all relay buttons from status data
     */
    function updateAllRelayButtons(data) {
        for (let i = 1; i <= 3; i++) {
            const relayData = data[`relay${i}`];
            if (relayData) {
                updateRelayButton(i, relayData.state);

                // Update config
                relayConfig[`relay${i}_name`] = relayData.name;
                relayConfig[`relay${i}_pin`] = relayData.pin;
            }
        }

        updateButtonTooltips();
    }

    /**
     * Update button tooltips with custom names
     */
    function updateButtonTooltips() {
        for (let i = 1; i <= 3; i++) {
            const btn = document.getElementById(`relay${i}-btn`);
            if (btn) {
                btn.title = relayConfig[`relay${i}_name`];
            }
        }
    }

    /**
     * Open settings modal
     */
    function openSettingsModal() {
        // Load current config
        fetch('/plugin/gpio_relay_control/config')
            .then(response => response.json())
            .then(config => {
                // Populate form fields - names
                document.getElementById('relay1-name').value = config.relay1_name;
                document.getElementById('relay2-name').value = config.relay2_name;
                document.getElementById('relay3-name').value = config.relay3_name;

                // Populate form fields - GPIO pins
                document.getElementById('relay1-pin').value = config.relay1_pin;
                document.getElementById('relay2-pin').value = config.relay2_pin;
                document.getElementById('relay3-pin').value = config.relay3_pin;

                // Show modal
                const modal = new bootstrap.Modal(document.getElementById('gpioRelaySettingsModal'));
                modal.show();
            })
            .catch(error => {
                console.error('Error loading config:', error);
                showNotification('Failed to load settings', 'error');
            });
    }

    /**
     * Save settings
     */
    function saveSettings() {
        const newConfig = {
            relay1_name: document.getElementById('relay1-name').value,
            relay2_name: document.getElementById('relay2-name').value,
            relay3_name: document.getElementById('relay3-name').value,
            relay1_pin: parseInt(document.getElementById('relay1-pin').value),
            relay2_pin: parseInt(document.getElementById('relay2-pin').value),
            relay3_pin: parseInt(document.getElementById('relay3-pin').value)
        };

        // Validate GPIO pins
        if (newConfig.relay1_pin < 2 || newConfig.relay1_pin > 27 ||
            newConfig.relay2_pin < 2 || newConfig.relay2_pin > 27 ||
            newConfig.relay3_pin < 2 || newConfig.relay3_pin > 27) {
            showNotification('GPIO pins must be between 2 and 27', 'error');
            return;
        }

        // Check for duplicate pins
        if (newConfig.relay1_pin === newConfig.relay2_pin ||
            newConfig.relay1_pin === newConfig.relay3_pin ||
            newConfig.relay2_pin === newConfig.relay3_pin) {
            showNotification('Each relay must use a different GPIO pin', 'error');
            return;
        }

        fetch('/plugin/gpio_relay_control/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newConfig)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update local config
                Object.assign(relayConfig, newConfig);
                updateButtonTooltips();

                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('gpioRelaySettingsModal'));
                modal.hide();

                // Show success message with restart reminder
                showNotification('Settings saved! Please restart ChitUI for GPIO pin changes to take effect.', 'success');
            } else {
                showNotification('Failed to save settings', 'error');
            }
        })
        .catch(error => {
            console.error('Error saving settings:', error);
            showNotification('Error saving settings', 'error');
        });
    }

    /**
     * Show notification (using browser notification or console)
     */
    function showNotification(message, type) {
        console.log(`[${type.toUpperCase()}] ${message}`);

        // If there's a global notification system, use it
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else if (typeof alert !== 'undefined') {
            // Fallback to simple alert for errors
            if (type === 'error') {
                alert(message);
            }
        }
    }

    // Expose functions globally if needed
    window.gpioRelayControl = {
        toggleRelay: toggleRelay,
        loadRelayStatus: loadRelayStatus,
        openSettingsModal: openSettingsModal
    };

    console.log('GPIO Relay Control plugin loaded');
})();
