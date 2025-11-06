// Settings Management
let currentSettings = {
    printers: {},
    auto_discover: false
};

// Load settings on page load
$(document).ready(function() {
    console.log('Settings module loaded');
    loadSettings();
    
    // Settings modal event handlers
    $('#btnDiscover').click(discoverPrinters);
    $('#btnAddManual').click(addManualPrinter);
    $('#btnSaveSettings').click(saveSettings);
    
    // Auto-discover checkbox
    $('#autoDiscoverCheck').change(function() {
        currentSettings.auto_discover = $(this).is(':checked');
    });
    
    // Load settings when modal opens
    $('#modalSettings').on('show.bs.modal', function() {
        console.log('Settings modal opened');
        loadSettings();
    });
});

// Load settings from server
function loadSettings() {
    console.log('Loading settings from server...');
    $.ajax({
        url: '/settings',
        method: 'GET',
        success: function(data) {
            console.log('Settings loaded:', data);
            currentSettings = data;
            updateSettingsUI();
        },
        error: function(xhr, status, error) {
            console.error('Error loading settings:', status, error);
            showToast('Error loading settings', 'danger');
        }
    });
}

// Update UI with current settings
function updateSettingsUI() {
    // Update auto-discover checkbox
    $('#autoDiscoverCheck').prop('checked', currentSettings.auto_discover || false);
    
    // Update saved printers list
    const savedPrintersList = $('#savedPrintersList');
    savedPrintersList.empty();
    
    const printerCount = Object.keys(currentSettings.printers || {}).length;
    
    if (printerCount === 0) {
        savedPrintersList.html(`
            <div class="list-group-item text-muted text-center">
                <i class="bi bi-info-circle"></i> No printers configured yet
            </div>
        `);
    } else {
        $.each(currentSettings.printers, function(printerId, printer) {
            const template = $('#tmplSavedPrinter').html();
            const $item = $(template);
            
            $item.attr('data-printer-id', printerId);
            $item.find('.printer-name').text(printer.name);
            $item.find('.printer-ip').text(printer.ip);
            $item.find('.printer-enabled-toggle').prop('checked', printer.enabled !== false);
            
            // Handle enable/disable toggle
            $item.find('.printer-enabled-toggle').change(function() {
                currentSettings.printers[printerId].enabled = $(this).is(':checked');
            });
            
            // Handle remove button
            $item.find('.btn-remove-printer').click(function() {
                if (confirm(`Remove printer "${printer.name}"?`)) {
                    removePrinter(printerId);
                }
            });
            
            savedPrintersList.append($item);
        });
    }
}

// Discover printers
function discoverPrinters() {
    const $btn = $('#btnDiscover');
    const $spinner = $('#discoverSpinner');
    
    $btn.prop('disabled', true);
    $spinner.removeClass('d-none');
    
    console.log('Starting printer discovery...');
    
    $.ajax({
        url: '/discover',
        method: 'POST',
        timeout: 5000, // 5 second timeout
        success: function(data) {
            console.log('Discovery response:', data);
            if (data.success) {
                const count = data.count || Object.keys(data.printers || {}).length;
                showToast(`Discovered ${count} printer(s)`, 'success');
                
                // Wait a moment for printers to connect, then reload settings
                setTimeout(function() {
                    loadSettings();
                }, 1000);
            } else {
                showToast(data.message || 'No printers discovered', 'warning');
            }
        },
        error: function(xhr, status, error) {
            console.error('Discovery error:', status, error, xhr.responseJSON);
            const message = xhr.responseJSON?.message || 'No printers discovered';
            showToast(message, 'warning');
        },
        complete: function() {
            $btn.prop('disabled', false);
            $spinner.addClass('d-none');
        }
    });
}

// Add printer manually
function addManualPrinter() {
    const ip = $('#manualPrinterIP').val().trim();
    const name = $('#manualPrinterName').val().trim() || `Printer-${ip}`;
    
    if (!ip) {
        showToast('Please enter an IP address', 'warning');
        return;
    }
    
    // Basic IP validation
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip)) {
        showToast('Please enter a valid IP address', 'warning');
        return;
    }
    
    // Validate IP octets
    const octets = ip.split('.');
    for (let i = 0; i < octets.length; i++) {
        const octet = parseInt(octets[i]);
        if (octet < 0 || octet > 255) {
            showToast('IP address octets must be between 0 and 255', 'warning');
            return;
        }
    }
    
    console.log('Adding manual printer:', ip, name);
    
    const $btn = $('#btnAddManual');
    $btn.prop('disabled', true);
    
    $.ajax({
        url: '/printer/manual',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            ip: ip,
            name: name
        }),
        timeout: 5000,
        success: function(data) {
            console.log('Add printer response:', data);
            if (data.success) {
                showToast(`Added printer "${name}" - attempting to connect...`, 'success');
                $('#manualPrinterIP').val('');
                $('#manualPrinterName').val('');
                
                // Wait a moment for connection, then reload settings
                setTimeout(function() {
                    loadSettings();
                }, 1500);
            } else {
                showToast(data.message || 'Failed to add printer', 'danger');
            }
        },
        error: function(xhr, status, error) {
            console.error('Add printer error:', status, error, xhr.responseJSON);
            const message = xhr.responseJSON?.message || 'Failed to add printer';
            showToast(message, 'danger');
        },
        complete: function() {
            $btn.prop('disabled', false);
        }
    });
}

// Remove printer
function removePrinter(printerId) {
    $.ajax({
        url: `/printer/${printerId}`,
        method: 'DELETE',
        success: function(data) {
            if (data.success) {
                showToast('Printer removed', 'success');
                delete currentSettings.printers[printerId];
                updateSettingsUI();
            }
        },
        error: function(xhr, status, error) {
            showToast('Failed to remove printer', 'danger');
        }
    });
}

// Save settings
function saveSettings() {
    console.log('Saving settings:', currentSettings);
    
    $.ajax({
        url: '/settings',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(currentSettings),
        success: function(data) {
            console.log('Settings save response:', data);
            if (data.success) {
                showToast('Settings saved successfully', 'success');
                $('#modalSettings').modal('hide');
                
                // Refresh printers list - check if socket is available
                if (typeof socket !== 'undefined' && socket) {
                    socket.emit('printers', {});
                } else {
                    console.log('Socket not available, reloading page...');
                    setTimeout(function() {
                        window.location.reload();
                    }, 1000);
                }
            }
        },
        error: function(xhr, status, error) {
            console.error('Save settings error:', status, error);
            showToast('Failed to save settings', 'danger');
        }
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    const $toast = $('#toastUpload');
    const bgClass = type === 'success' ? 'bg-success' : 
                    type === 'danger' ? 'bg-danger' : 
                    type === 'warning' ? 'bg-warning' : 'bg-info';
    
    $toast.find('.toast-header').removeClass('bg-success bg-danger bg-warning bg-info bg-body-secondary')
          .addClass(bgClass);
    $toast.find('.toast-body').text(message);
    
    const toast = new bootstrap.Toast($toast[0]);
    toast.show();
}