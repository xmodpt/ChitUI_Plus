const socket = io();
var websockets = []
var printers = {}
var currentPrinter = null
var progress = null
var printStatusModal = null
var cameraFullscreenModal = null
var cameraActive = false

socket.on("connect", () => {
  console.log('socket.io connected: ' + socket.id);
  setServerStatus(true)
});

socket.on("disconnect", () => {
  console.log("socket.io disconnected");
  setServerStatus(false)
});

socket.on("printers", (data) => {
  console.log(JSON.stringify(data))
  printers = data
  $("#printersList").empty()
  addPrinters(data)
});

socket.on("printer_response", (data) => {
  switch (data.Data.Cmd) {
    case SDCP_CMD_STATUS:
      // Status responses are already handled by printer_status event
      // but we can log it here for debugging
      console.log('Status response received');
      break;
      
    case SDCP_CMD_ATTRIBUTES:
      // Attributes responses are already handled by printer_attributes event
      // but we can log it here for debugging
      console.log('Attributes response received');
      break;
      
    case SDCP_CMD_RETRIEVE_FILE_LIST:
      handle_printer_files(data);
      break;
      
    case SDCP_CMD_BATCH_DELETE_FILES:
      modalConfirm.hide();
      break;
      
    case SDCP_CMD_START_PRINTING:
      modalConfirm.hide();
      break;
      
    case SDCP_CMD_RETRIEVE_TASK_DETAILS:
      handle_task_details(data);
      break;
      
    default:
      console.log('Unknown response:', data);
      break;
  }
});

socket.on("printer_error", (data) => {
  console.log("=== ERROR ===")
  console.log(data)
  alert("Error Code:" + data.Data.Data.ErrorCode)
});

socket.on("printer_notice", (data) => {
  console.log("=== NOTICE ===")
  console.log(data)
  alert("Notice:" + data.Data.Data.Message)
});

socket.on("printer_status", (data) => {
  handle_printer_status(data)
});

socket.on("printer_attributes", (data) => {
  handle_printer_attributes(data)
});

function handle_printer_status(data) {
  if (!printers[data.MainboardID].hasOwnProperty('status')) {
    printers[data.MainboardID]['status'] = {}
  }
  var filter = ['CurrentStatus', 'PrintScreen', 'ReleaseFilm', 'TempOfUVLED', 'TimeLapseStatus', 'PrintInfo']
  $.each(data.Status, function (key, val) {
    if (filter.includes(key)) {
      if (val.length == 1) {
        val = val[0]
      }
      printers[data.MainboardID]['status'][key] = val
    }
  })
  printer_status = printers[data.MainboardID]['status']
  
  if (typeof printer_status['PreviousStatus'] !== undefined
    && printer_status['PreviousStatus'] == SDCP_MACHINE_STATUS_UNKNOWN_8
    && printer_status['CurrentStatus'] == SDCP_MACHINE_STATUS_IDLE) {
    socket.emit("printer_files", { id: data.MainboardID, url: '/local' })
  }
  printers[data.MainboardID]['status']['PreviousStatus'] = printer_status['CurrentStatus']
  updatePrinterStatus(data)
  createTable('Status', data.Status)
  if (data.Status.CurrentStatus.includes(1)) {
    createTable('Print', data.Status.PrintInfo)
    updatePrintOverlay(data.MainboardID, data.Status.PrintInfo)
  } else {
    if (printStatusModal && data.MainboardID === currentPrinter) {
      printStatusModal.hide()
    }
  }
}

function handle_printer_attributes(data) {
  console.log(data)
  if (!printers[data.MainboardID].hasOwnProperty('attributes')) {
    printers[data.MainboardID]['attributes'] = {}
  }
  var filter = ['Resolution', 'XYZsize', 'NumberOfVideoStreamConnected', 'MaximumVideoStreamAllowed', 'UsbDiskStatus', 'Capabilities', 'SupportFileType', 'DevicesStatus', 'ReleaseFilmMax', 'CameraStatus', 'RemainingMemory', 'TLPNoCapPos', 'TLPStartCapPos', 'TLPInterLayers']
  $.each(data.Attributes, function (key, val) {
    if (filter.includes(key)) {
      printers[data.MainboardID]['attributes'][key] = val
    }
  })
  createTable('Attributes', data.Attributes)
  
  // Update storage display if RemainingMemory is present
  if (data.Attributes.RemainingMemory !== undefined) {
    updateStorageDisplay(data.Attributes.RemainingMemory);
  }
}

function updateStorageDisplay(remainingBytes) {
  // RemainingMemory is in bytes, convert to GB
  const remainingGB = remainingBytes / (1024 * 1024 * 1024);
  
  // Try to determine total storage from remaining
  // Most printers have 16GB or 32GB internal storage
  let totalGB = 32;
  if (remainingGB > 32) {
    totalGB = 64;
  } else if (remainingGB < 16) {
    totalGB = 16;
  }
  
  const usedGB = totalGB - remainingGB;
  const usedPercent = (usedGB / totalGB * 100).toFixed(1);
  
  // Format sizes nicely
  function formatSize(gb) {
    if (gb < 1) {
      return (gb * 1024).toFixed(0) + ' MB';
    }
    return gb.toFixed(2) + ' GB';
  }
  
  // Update simple display (main page)
  $('#storageUsedSimple').text(formatSize(usedGB));
  $('#storageFreeSimple').text(formatSize(remainingGB));
  $('#storageInfo').show();
  
  // Update detailed display (settings modal)
  $('#storageUsed').text(formatSize(usedGB));
  $('#storageTotal').text(formatSize(totalGB));
  $('#storageFree').text(formatSize(remainingGB));
  $('#storagePercent').text(usedPercent + '%');
  $('#storageProgressBar').css('width', usedPercent + '%').attr('aria-valuenow', usedPercent);
  
  // Color code the progress bar
  const $progressBar = $('#storageProgressBar');
  $progressBar.removeClass('bg-success bg-warning bg-danger');
  if (usedPercent < 70) {
    $progressBar.addClass('bg-success');
  } else if (usedPercent < 90) {
    $progressBar.addClass('bg-warning');
  } else {
    $progressBar.addClass('bg-danger');
  }
}


function handle_task_details(data) {
  console.log('=== Task details received ===');
  console.log('Full data:', JSON.stringify(data, null, 2));

  var id = data.Data.MainboardID;
  console.log('Printer ID:', id);

  if (data.Data && data.Data.Data && data.Data.Data.HistoryDetailList) {
    console.log('HistoryDetailList found, length:', data.Data.Data.HistoryDetailList.length);

    if (data.Data.Data.HistoryDetailList.length > 0) {
      var taskDetail = data.Data.Data.HistoryDetailList[0];
      console.log('Task detail object keys:', Object.keys(taskDetail));
      console.log('Task detail:', taskDetail);

      if (!printers[id].currentPrint) {
        printers[id].currentPrint = {};
      }

      // Store thumbnail (v2 style - use Thumbnail field directly)
      if (taskDetail.Thumbnail) {
        console.log('Thumbnail found! Type:', typeof taskDetail.Thumbnail);
        console.log('Thumbnail preview:', taskDetail.Thumbnail.substring(0, 100));
        printers[id].currentPrint.thumbnail = taskDetail.Thumbnail;

        // Display if modal is currently showing for this printer (v2 style)
        if (currentPrinter === id && $('#modalPrintStatus').hasClass('show')) {
          console.log('Modal is showing, displaying thumbnail now');
          displayThumbnail(taskDetail.Thumbnail);
        } else {
          console.log('Modal not showing yet or different printer, thumbnail stored for later');
        }
      } else {
        console.warn('No Thumbnail field found. Available fields:', Object.keys(taskDetail));
      }

      // Store other task details if needed
      if (taskDetail.Name) {
        printers[id].currentPrint.fileName = taskDetail.Name;
      }
    }
  } else {
    console.warn('HistoryDetailList not found in expected location. Data structure:', data.Data);
  }
  console.log('=== End task details ===');
}

function handle_printer_files(data) {
  var id = data.Data.MainboardID
  files = []
  if (printers[id]['files'] !== undefined) {
    files = printers[id]['files']
  }
  $.each(data.Data.Data.FileList, function (i, f) {
    if (f.type === 0) {
      getPrinterFiles(id, f.name)
    } else {
      if (!files.includes(f.name)) {
        files.push(f.name)
      }
    }
  })
  printers[id]['files'] = files
  createTable('Files', files)
  addFileOptions()
}

function addPrinters(printers) {
  $.each(printers, function (id, printer) {
    var template = $("#tmplPrintersListItem").html()
    var item = $(template)
    var printerIcon = (printer.brand + '_' + printer.model).split(" ").join("").toLowerCase()
    item.attr('id', 'printer_' + id)
    item.attr("data-connection-id", printer.connection)
    item.attr("data-printer-id", id)
    item.find(".printerName").text(printer.name)
    item.find(".printerType").text(printer.brand + ' ' + printer.model)
    item.find(".printerIcon").attr("src", 'img/' + printerIcon + '.webp')
    item.on('click', function () {
      showPrinter($(this).data('printer-id'))
    })
    $("#printersList").append(item)
    console.log('Emitting printer_info for printer:', id)
    socket.emit("printer_info", { id: id })
  });
}

function showPrinter(id) {
  currentPrinter = id
  var p = printers[id]
  var printerIcon = (p.brand + '_' + p.model).split(" ").join("").toLowerCase()
  $('#printerName').text(p.name)
  $('#printerType').text(p.brand + ' ' + p.model)

  // Preload the image to avoid showing broken image icon
  var imgPath = 'img/' + printerIcon + '.webp'
  var img = new Image()
  img.onload = function() {
    // Image loaded successfully, show it and hide placeholder
    $("#printerIcon").attr("src", imgPath).removeClass('d-none')
    $("#printerIconPlaceholder").addClass('d-none')
  }
  img.onerror = function() {
    // Image failed to load, keep placeholder visible
    console.log('Printer icon not found:', imgPath)
    $("#printerIcon").addClass('d-none')
    $("#printerIconPlaceholder").removeClass('d-none')
  }
  img.src = imgPath

  // Only create tables if data exists
  if (p.status) {
    createTable('Status', p.status, true)
    if (p.status.PrintInfo) {
      createTable('Print', p.status.PrintInfo)
    }
  }
  if (p.attributes) {
    createTable('Attributes', p.attributes)
  }

  // Always request files from both locations if not already loaded
  if (printers[id]['files'] == undefined || printers[id]['files'].length == 0) {
    getPrinterFiles(id, '/local')
    getPrinterFiles(id, '/usb')
  }

  $('#uploadPrinter').val(id)
  
  if (p.status && p.status.CurrentStatus && p.status.CurrentStatus.includes(SDCP_MACHINE_STATUS_PRINTING)) {
    updatePrintOverlay(id, p.status.PrintInfo)
  }
}

function createTable(name, data, active = false) {
  if ($('#tab-' + name).length == 0) {
    var tTab = $("#tmplNavTab").html()
    var tab = $(tTab)
    tab.find('button').attr('id', 'tab-' + name)
    tab.find('button').attr('data-bs-target', '#tab' + name)
    tab.find('button').text(name)
    if (active) {
      tab.find('button').addClass('active')
    }
    $('#navTabs').append(tab)
  }

  if ($('#tab' + name).length == 0) {
    var tPane = $("#tmplNavPane").html()
    var pane = $(tPane)
    pane.attr('id', 'tab' + name)
    pane.find('tbody').attr('id', 'table' + name)
    if (active) {
      pane.addClass('active')
    }
    $('#navPanes').append(pane)
  }
  fillTable(name, data)
}

function formatDisplayValue(key, val, tableName) {
  // Format Status tab values
  if (tableName === 'Status') {
    switch(key) {
      case 'CurrentStatus':
        if (Array.isArray(val) && val.length > 0) {
          var statusClass = 'idle';
          var statusText = 'Idle';

          switch(val[0]) {
            case SDCP_MACHINE_STATUS_IDLE:
              statusClass = 'idle';
              statusText = 'Idle';
              break;
            case SDCP_MACHINE_STATUS_PRINTING:
              statusClass = 'printing';
              statusText = 'Printing';
              break;
            case SDCP_MACHINE_STATUS_FILE_TRANSFERRING:
              statusClass = 'warning';
              statusText = 'File Transfer';
              break;
            case SDCP_MACHINE_STATUS_EXPOSURE_TESTING:
              statusClass = 'printing';
              statusText = 'Exposure Test';
              break;
            case SDCP_MACHINE_STATUS_DEVICES_TESTING:
              statusClass = 'warning';
              statusText = 'Device Testing';
              break;
            default:
              statusClass = 'warning';
              statusText = 'Unknown';
          }

          return '<span class="status-indicator ' + statusClass + '">●</span> ' + statusText;
        }
        return val;

      case 'PrintScreen':
        var hours = Math.floor(val / 3600);
        var mins = Math.floor((val % 3600) / 60);
        if (hours > 0) {
          return hours + 'h ' + mins + 'm';
        }
        return mins + 'm ' + Math.round(val % 60) + 's';

      case 'ReleaseFilm':
        return val.toLocaleString() + ' cycles';

      case 'TempOfUVLED':
        return val.toFixed(1) + ' °C';

      case 'TimeLapseStatus':
        return val === 1 ? 'Enabled' : 'Disabled';
    }
  }

  // Format Attributes tab values
  if (tableName === 'Attributes') {
    // Filter out PrintInfo object
    if (key === 'PrintInfo') {
      return null;
    }

    switch(key) {
      case 'RemainingMemory':
        var gb = (val / (1024 * 1024 * 1024)).toFixed(2);
        return gb + ' GB';

      case 'Resolution':
        return val;

      case 'XYZsize':
        return val;

      case 'Capabilities':
      case 'SupportFileType':
        if (Array.isArray(val)) {
          return val.join(', ');
        }
        return val;

      case 'DevicesStatus':
        if (typeof val === 'object') {
          var statuses = [];
          for (var device in val) {
            var deviceName = device.replace(/Status|State/g, '').replace(/([A-Z])/g, ' $1').trim();
            var statusIcon = val[device] === 1 ? '✓' : '✗';
            statuses.push(statusIcon + ' ' + deviceName);
          }
          return statuses.join('<br>');
        }
        return val;

      case 'NetworkStatus':
        return val.toUpperCase();

      case 'UsbDiskStatus':
      case 'SDCPStatus':
      case 'CameraStatus':
        return val === 1 ? '✓ Connected' : '○ Disconnected';

      case 'ReleaseFilmMax':
        return val.toLocaleString() + ' cycles';

      case 'NumberOfVideoStreamConnected':
      case 'MaximumVideoStreamAllowed':
      case 'NumberOfCloudSDCPServicesConnected':
      case 'MaximumCloudSDCPSercicesAllowed':
        return val;

      // Hide less useful fields
      case 'TLPNoCapPos':
      case 'TLPStartCapPos':
      case 'TLPInterLayers':
        return null;
    }
  }

  return val;
}

function fillTable(table, data) {
  var t = $('#table' + table);
  t.empty();

  // Special card-based UI for Status tab
  if (table === 'Status') {
    var grid = $('<div class="status-grid"></div>');

    $.each(data, function (key, val) {
      // Skip PrintInfo - it has its own Print tab
      if (key === 'PrintInfo') {
        return true;
      }

      // Format the value
      var formattedVal = formatDisplayValue(key, val, table);

      // Skip if formatDisplayValue returns null
      if (formattedVal === null) {
        return true;
      }

      // If still an object after formatting, stringify it
      if (typeof formattedVal === 'object') {
        formattedVal = JSON.stringify(formattedVal);
      }

      // Make key more readable
      var displayKey = key.replace(/([A-Z])/g, ' $1').trim();

      // Get icon for each status type
      var icon = '';
      switch(key) {
        case 'CurrentStatus':
          icon = '<i class="bi bi-circle-fill"></i>';
          break;
        case 'PrintScreen':
          icon = '<i class="bi bi-clock-history"></i>';
          break;
        case 'ReleaseFilm':
          icon = '<i class="bi bi-arrow-repeat"></i>';
          break;
        case 'TempOfUVLED':
          icon = '<i class="bi bi-thermometer-half"></i>';
          break;
        case 'TimeLapseStatus':
          icon = '<i class="bi bi-camera-video"></i>';
          break;
        default:
          icon = '<i class="bi bi-info-circle"></i>';
      }

      var card = $('<div class="status-card"></div>');
      card.append('<div class="status-card-label">' + icon + displayKey + '</div>');
      card.append('<div class="status-card-value">' + formattedVal + '</div>');
      grid.append(card);
    });

    t.append(grid);
    return;
  }

  // Regular table layout for other tabs
  $.each(data, function (key, val) {
    // Format the value
    var formattedVal = formatDisplayValue(key, val, table);

    // Skip if formatDisplayValue returns null
    if (formattedVal === null) {
      return true; // continue to next iteration
    }

    // If still an object after formatting, stringify it
    if (typeof formattedVal === 'object') {
      formattedVal = JSON.stringify(formattedVal);
    }

    // Make key more readable
    var displayKey = key.replace(/([A-Z])/g, ' $1').trim();

    var row = $('<tr><td class="fieldKey">' + displayKey + '</td><td class="fieldValue">' + formattedVal + '</td></tr>');
    t.append(row);
  });
}

function getPrinterFiles(id, url) {
  socket.emit("printer_files", { id: id, url: url })
}

function addFileOptions() {
  $('#tableFiles .fieldValue').each(function () {
    var file = $(this).text()
    var options = $('<i class="bi bi-printer-fill fileOption ps-3" data-action="print" data-file="' + file + '"></i><i class="bi bi-trash-fill fileOption ps-1" data-action="delete" data-file="' + file + '"></i>')
    $(this).append(options)
    $(this).parent().attr('data-file', file)
  })
  $('.fileOption').on('click', function (e) {
    var action = $(this).data('action')
    var file = $(this).data('file')
    $('#modalConfirmTitle').text('Confirm ' + action)
    $('#modalConfirmAction').text(action)
    $('#modalConfirmValue').text(file)
    $('#btnConfirm').data('action', action).data('value', file)
    modalConfirm.show()
  })
}

function updatePrinterStatus(data) {
  var info = $('#printer_' + data.MainboardID).find('.printerInfo')
  switch (data.Status.CurrentStatus[0]) {
    case SDCP_MACHINE_STATUS_IDLE:
      info.text("Idle")
      updatePrinterStatusIcon(data.MainboardID, "success", false)
      break
    case SDCP_MACHINE_STATUS_PRINTING:
      info.text("Printing")
      updatePrinterStatusIcon(data.MainboardID, "success", true)
      break
    case SDCP_MACHINE_STATUS_FILE_TRANSFERRING:
      info.text("File Transfer")
      updatePrinterStatusIcon(data.MainboardID, "warning", true)
      break
    case SDCP_MACHINE_STATUS_EXPOSURE_TESTING:
      info.text("Exposure Test")
      updatePrinterStatusIcon(data.MainboardID, "info", true)
      break
    case SDCP_MACHINE_STATUS_DEVICES_TESTING:
      info.text("Devices Self-Test")
      updatePrinterStatusIcon(data.MainboardID, "warning", true)
      break
    case SDCP_MACHINE_STATUS_UNKNOWN_8:
      info.text("UNKNOWN STATUS")
      updatePrinterStatusIcon(data.MainboardID, "info", true)
      break
    default:
      break
  }
}

function updatePrinterStatusIcon(id, style, spinner) {
  var el = 'printerStatus'
  if (spinner) {
    el = 'printerSpinner'
    $('.printerStatus').addClass('visually-hidden')
    $('.printerSpinner').removeClass('visually-hidden')
  } else {
    $('.printerStatus').removeClass('visually-hidden')
    $('.printerSpinner').addClass('visually-hidden')
  }
  var status = $('#printer_' + id).find('.' + el)
  status.removeClass(function (index, css) {
    return (css.match(/\btext-\S+/g) || []).join(' ');
  }).addClass("text-" + style);
  status.find('i').removeClass().addClass('bi-circle-fill')
}

function setServerStatus(online) {
  serverStatus = $('.serverStatus')
  if (online) {
    serverStatus.removeClass('bi-cloud text-danger').addClass('bi-cloud-check-fill')
  } else {
    serverStatus.removeClass('bi-cloud-check-fill').addClass('bi-cloud text-danger')
  }
}

function updatePrintOverlay(printerId, printInfo) {
  if (!printInfo || printerId !== currentPrinter) return;
  
  if (!printStatusModal) {
    printStatusModal = new bootstrap.Modal($('#modalPrintStatus'), {
      backdrop: true,  // Allow closing by clicking backdrop
      keyboard: true   // Allow closing with Escape key
    });
  }
  
  if (!printers[printerId].printTracking) {
    printers[printerId].printTracking = {
      startTime: Date.now(),
      startLayer: printInfo.CurrentLayer || 0,
      lastUpdate: Date.now(),
      estimatedTotal: 0,
      thumbnailRequested: false,
      modalShownOnce: false
    };
  }
  
  var tracking = printers[printerId].printTracking;

  if (printInfo.TaskId && !tracking.thumbnailRequested) {
    console.log('Requesting task details for TaskId:', printInfo.TaskId);
    socket.emit('get_task_details', { id: printerId, taskId: printInfo.TaskId });
    tracking.thumbnailRequested = true;
  } else if (!printInfo.TaskId) {
    console.log('No TaskId in printInfo:', printInfo);
  }

  if (printers[printerId].currentPrint && printers[printerId].currentPrint.thumbnail) {
    displayThumbnail(printers[printerId].currentPrint.thumbnail);
  }
  
  // Always enable camera button when printing (it will start camera if needed)
  $('#btnPrintCamera').prop('disabled', false);
  
  var statusText = getPrintStatusText(printInfo.Status);
  $('#printStatusText').text(statusText);
  
  $('#printFileName').text(printInfo.Filename || 'Unknown');
  
  var currentLayer = printInfo.CurrentLayer || 0;
  var totalLayers = printInfo.TotalLayer || 0;
  $('#printLayers').text(currentLayer + ' / ' + totalLayers);
  
  var percentage = totalLayers > 0 ? Math.round((currentLayer / totalLayers) * 100) : 0;
  $('#printProgress').css('width', percentage + '%').text(percentage + '%');

  // Update header button badge
  $('#printStatusBadge').text(percentage + '%');

  var currentTime = formatTime(printInfo.CurrentTicks || 0);
  var estimatedTotal = 0;
  var remainingTime = 0;
  
  if (currentLayer > tracking.startLayer && currentLayer > 0) {
    var elapsedMs = Date.now() - tracking.startTime;
    var layersPrinted = currentLayer - tracking.startLayer;
    var msPerLayer = elapsedMs / layersPrinted;
    var remainingLayers = totalLayers - currentLayer;
    remainingTime = Math.round((remainingLayers * msPerLayer) / 1000) * 1000;
    estimatedTotal = Math.round(elapsedMs + remainingTime);
    tracking.estimatedTotal = estimatedTotal;
  } else if (printInfo.TotalTicks && printInfo.TotalTicks > 0) {
    estimatedTotal = printInfo.TotalTicks;
    remainingTime = estimatedTotal - (printInfo.CurrentTicks || 0);
  }
  
  var totalTimeText = estimatedTotal > 0 ? formatTime(estimatedTotal) : formatTime(printInfo.TotalTicks || 0);
  var remainingTimeText = remainingTime > 0 ? formatTime(remainingTime) : '--:--:--';
  
  $('#printTime').text(currentTime + ' / ' + remainingTimeText + ' remaining');
  $('#printTotalTime').text('Total estimated: ' + totalTimeText);
  
  tracking.lastUpdate = Date.now();
  
  if (printInfo.ErrorNumber && printInfo.ErrorNumber !== 0) {
    var errorText = getPrintErrorText(printInfo.ErrorNumber);
    $('#printError').text('Error: ' + errorText).removeClass('d-none');
  } else {
    $('#printError').addClass('d-none');
  }
  
  updatePrintControls(printInfo.Status);

  if (printInfo.Status !== SDCP_PRINT_STATUS_IDLE &&
      printInfo.Status !== SDCP_PRINT_STATUS_COMPLETE) {
    // Show header button for reopening modal
    $('#btnShowPrintStatus').removeClass('d-none');

    // Show main dashboard print controls card
    $('#printControlsRow').removeClass('d-none');

    // Update main dashboard card
    $('#mainPrintFileName').text(printInfo.Filename || 'Unknown');
    $('#mainPrintStatus').text(statusText);
    $('#mainPrintProgress').css('width', percentage + '%').text(percentage + '%');
    $('#mainPrintLayers').text(currentLayer + ' / ' + totalLayers);
    $('#mainPrintTime').text(currentTime);

    // Update main dashboard pause/resume buttons
    if (printInfo.Status === SDCP_PRINT_STATUS_PAUSED) {
      $('#btnMainPausePrint').addClass('d-none');
      $('#btnMainResumePrint').removeClass('d-none');
    } else {
      $('#btnMainPausePrint').removeClass('d-none');
      $('#btnMainResumePrint').addClass('d-none');
    }

    // Auto-show modal on first print start (with small delay to allow data to load)
    if (!$('#modalPrintStatus').hasClass('show') && !tracking.modalShownOnce) {
      tracking.modalShownOnce = true;
      // Small delay to ensure data is ready, especially on mobile
      setTimeout(function() {
        // Only show if still printing and modal wasn't manually opened
        if (!$('#modalPrintStatus').hasClass('show')) {
          printStatusModal.show();
        }
      }, 500); // 500ms delay
    }
  } else {
    // Hide header button and main card when print is complete/idle
    $('#btnShowPrintStatus').addClass('d-none');
    $('#printControlsRow').addClass('d-none');
    delete printers[printerId].printTracking;
    delete printers[printerId].currentPrint;
  }
}

function displayThumbnail(thumbnailUrl) {
  console.log('=== displayThumbnail ===');
  console.log('Thumbnail URL:', thumbnailUrl);

  if (thumbnailUrl && thumbnailUrl !== '') {
    var finalUrl = thumbnailUrl;

    // Check if it's an HTTP URL (not a data URI)
    if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
      console.log('Thumbnail is HTTP URL, proxying through backend');
      // Proxy through backend to avoid CORS issues
      finalUrl = '/thumbnail/' + currentPrinter + '?url=' + encodeURIComponent(thumbnailUrl);
      console.log('Proxied URL:', finalUrl);
    } else if (thumbnailUrl.startsWith('data:')) {
      console.log('Thumbnail is data URI');
    } else {
      console.warn('Unknown thumbnail URL format:', thumbnailUrl.substring(0, 50));
    }

    console.log('Setting thumbnail src and showing image');
    $('#printThumbnail').attr('src', finalUrl);
    $('#printThumbnail').removeClass('d-none');
    $('#printThumbnailPlaceholder').addClass('d-none');
    console.log('Thumbnail display initiated');
  } else {
    console.log('No thumbnail URL, showing placeholder');
    // Show placeholder
    $('#printThumbnail').addClass('d-none');
    $('#printThumbnailPlaceholder').removeClass('d-none');
  }
  console.log('=== End displayThumbnail ===');
}

function getPrintStatusText(status) {
  switch(status) {
    case SDCP_PRINT_STATUS_IDLE: return 'Idle';
    case SDCP_PRINT_STATUS_HOMING: return 'Homing';
    case SDCP_PRINT_STATUS_DROPPING: return 'Descending';
    case SDCP_PRINT_STATUS_EXPOSURING: return 'Exposing';
    case SDCP_PRINT_STATUS_LIFTING: return 'Lifting';
    case SDCP_PRINT_STATUS_PAUSING: return 'Pausing...';
    case SDCP_PRINT_STATUS_PAUSED: return 'Paused';
    case SDCP_PRINT_STATUS_STOPPING: return 'Stopping...';
    case SDCP_PRINT_STATUS_STOPED: return 'Stopped';
    case SDCP_PRINT_STATUS_COMPLETE: return 'Complete!';
    case SDCP_PRINT_STATUS_FILE_CHECKING: return 'Checking File...';
    default: return 'Unknown Status';
  }
}

function getPrintErrorText(errorNumber) {
  switch(errorNumber) {
    case SDCP_PRINT_ERROR_NONE: return 'None';
    case SDCP_PRINT_ERROR_CHECK: return 'File MD5 Check Failed';
    case SDCP_PRINT_ERROR_FILEIO: return 'File Read Failed';
    case SDCP_PRINT_ERROR_INVLAID_RESOLUTION: return 'Resolution Mismatch';
    case SDCP_PRINT_ERROR_UNKNOWN_FORMAT: return 'Format Mismatch';
    case SDCP_PRINT_ERROR_UNKNOWN_MODEL: return 'Machine Model Mismatch';
    default: return 'Unknown Error (' + errorNumber + ')';
  }
}

function formatTime(milliseconds) {
  var seconds = Math.floor(milliseconds / 1000);
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var secs = seconds % 60;
  
  return hours.toString().padStart(2, '0') + ':' + 
         minutes.toString().padStart(2, '0') + ':' + 
         secs.toString().padStart(2, '0');
}

function updatePrintControls(status) {
  var btnPause = $('#btnPausePrint');
  var btnResume = $('#btnResumePrint');
  var btnStop = $('#btnStopPrint');
  
  switch(status) {
    case SDCP_PRINT_STATUS_PAUSED:
      btnPause.addClass('d-none');
      btnResume.removeClass('d-none');
      btnStop.removeClass('d-none');
      break;
    case SDCP_PRINT_STATUS_PAUSING:
    case SDCP_PRINT_STATUS_STOPPING:
      btnPause.addClass('d-none').prop('disabled', true);
      btnResume.addClass('d-none').prop('disabled', true);
      btnStop.addClass('d-none').prop('disabled', true);
      break;
    case SDCP_PRINT_STATUS_IDLE:
    case SDCP_PRINT_STATUS_COMPLETE:
    case SDCP_PRINT_STATUS_STOPED:
      btnPause.addClass('d-none');
      btnResume.addClass('d-none');
      btnStop.addClass('d-none');
      break;
    default:
      btnPause.removeClass('d-none').prop('disabled', false);
      btnResume.addClass('d-none');
      btnStop.removeClass('d-none').prop('disabled', false);
  }
}

// ============ CAMERA CONTROLS ============

$('#btnStartCamera').on('click', function() {
  console.log('Starting camera...');
  $(this).prop('disabled', true);
  $('#cameraStatus').text('Connecting...');
  
  $.ajax({
    url: '/camera/start',
    type: 'POST',
    success: function(response) {
      if (response.ok) {
        console.log('Camera started successfully');
        cameraActive = true;
        $('#btnStartCamera').prop('disabled', true);
        $('#btnStopCamera').prop('disabled', false);
        $('#btnFullscreenCamera').prop('disabled', false);
        $('#btnPrintCamera').prop('disabled', false);
        $('#cameraPlaceholder').hide();
        $('#cameraStream').show().attr('src', '/camera/video');
        $('#cameraStatus').text('Streaming');
      } else {
        console.error('Camera start failed:', response.msg);
        alert('Camera Error: ' + response.msg);
        $('#btnStartCamera').prop('disabled', false);
        $('#cameraStatus').text(response.msg);
        cameraActive = false;
      }
    },
    error: function(xhr, status, error) {
      console.error('Camera start error:', error);
      alert('Failed to start camera: ' + error);
      $('#btnStartCamera').prop('disabled', false);
      $('#cameraStatus').text('Error starting camera');
      cameraActive = false;
    }
  });
});

$('#btnStopCamera').on('click', function() {
  console.log('Stopping camera...');
  
  // Close fullscreen modal if open
  if (cameraFullscreenModal && $('#modalCameraFullscreen').hasClass('show')) {
    cameraFullscreenModal.hide();
  }
  
  // Update UI immediately
  cameraActive = false;
  $('#btnStartCamera').prop('disabled', false);
  $('#btnStopCamera').prop('disabled', true);
  $('#btnFullscreenCamera').prop('disabled', true);
  $('#btnPrintCamera').prop('disabled', true);
  $('#cameraStream').hide().attr('src', '');
  $('#cameraPlaceholder').show();
  $('#cameraStatus').text('Camera stopped');
  
  // Send stop request to server
  $.ajax({
    url: '/camera/stop',
    type: 'POST',
    success: function(response) {
      console.log('Camera stopped successfully');
    },
    error: function(xhr, status, error) {
      console.log('Camera stop request failed (but UI updated):', error);
    }
  });
});

// Camera fullscreen button handler
$('#btnFullscreenCamera').on('click', function() {
  if (!cameraFullscreenModal) {
    cameraFullscreenModal = new bootstrap.Modal($('#modalCameraFullscreen'), {});
  }
  
  // Start streaming to fullscreen modal
  $('#cameraStreamFullscreen').attr('src', '/camera/video');
  cameraFullscreenModal.show();
});

// Clean up fullscreen stream when modal closes
$('#modalCameraFullscreen').on('hidden.bs.modal', function() {
  $('#cameraStreamFullscreen').attr('src', '');
});

// Restore print overlay data when reopened
$('#modalPrintStatus').on('show.bs.modal', function() {
  console.log('Print modal opening, restoring data...');

  // Restore thumbnail if it exists
  if (currentPrinter && printers[currentPrinter] && printers[currentPrinter].currentPrint) {
    var currentPrint = printers[currentPrinter].currentPrint;

    if (currentPrint.thumbnail) {
      console.log('Restoring thumbnail from stored data');
      displayThumbnail(currentPrint.thumbnail);
    }
  }
});

// Reset print overlay when closed
$('#modalPrintStatus').on('hidden.bs.modal', function() {
  // Reset camera/thumbnail view
  $('#printCameraContainer').addClass('d-none');
  $('#printThumbnailContainer').removeClass('d-none');
  $('#btnPrintCamera').html('<i class="bi bi-camera-video"></i> Camera');

  // Clear thumbnail (but keep data in printers object)
  $('#printThumbnail').addClass('d-none').attr('src', '');
  $('#printThumbnailPlaceholder').removeClass('d-none');
});

// Print overlay camera button
$('#btnPrintCamera').on('click', function() {
  // Toggle camera view in the print overlay
  if ($('#printCameraContainer').hasClass('d-none')) {
    // Show camera view, hide thumbnail
    if (!cameraActive) {
      // Start camera first
      console.log('Starting camera from print overlay...');
      $(this).prop('disabled', true).html('<i class="bi bi-hourglass-split"></i> Starting...');

      $.ajax({
        url: '/camera/start',
        type: 'POST',
        success: function(response) {
          if (response.ok) {
            console.log('Camera started successfully');
            cameraActive = true;
            $('#btnStartCamera').prop('disabled', true);
            $('#btnStopCamera').prop('disabled', false);
            $('#btnFullscreenCamera').prop('disabled', false);
            $('#cameraPlaceholder').hide();
            $('#cameraStream').show().attr('src', '/camera/video');
            $('#cameraStatus').text('Streaming');

            // Show camera in print overlay
            $('#printCameraView').attr('src', '/camera/video?' + new Date().getTime());
            $('#printCameraContainer').removeClass('d-none');
            $('#printThumbnailContainer').addClass('d-none');
            $('#btnPrintCamera').prop('disabled', false).html('<i class="bi bi-image"></i> Thumbnail');
          } else {
            console.error('Camera start failed:', response.msg);
            alert('Camera Error: ' + response.msg);
            $('#btnPrintCamera').prop('disabled', false).html('<i class="bi bi-camera-video"></i> Camera');
          }
        },
        error: function(xhr, status, error) {
          console.error('Camera start error:', error);
          alert('Failed to start camera: ' + error);
          $('#btnPrintCamera').prop('disabled', false).html('<i class="bi bi-camera-video"></i> Camera');
        }
      });
    } else {
      // Camera already active, just show it
      $('#printCameraView').attr('src', '/camera/video?' + new Date().getTime());
      $('#printCameraContainer').removeClass('d-none');
      $('#printThumbnailContainer').addClass('d-none');
      $(this).html('<i class="bi bi-image"></i> Thumbnail');
    }
  } else {
    // Hide camera view, show thumbnail
    $('#printCameraContainer').addClass('d-none');
    $('#printThumbnailContainer').removeClass('d-none');
    $(this).html('<i class="bi bi-camera-video"></i> Camera');
  }
});

// ============ FILE UPLOAD ============

$('#btnUpload').on('click', function () {
  uploadFile()
});

function uploadFile() {
  // Generate a unique upload ID for progress tracking
  var uploadId = generateUUID();

  // Get the form data and add the upload ID
  var formData = new FormData($('#formUpload')[0]);
  formData.append('upload_id', uploadId);

  // Start progress tracking BEFORE starting upload to avoid race condition
  var progressEventSource = null;
  var progressStarted = false;

  var req = $.ajax({
    url: '/upload',
    type: 'POST',
    data: formData,
    cache: false,
    contentType: false,
    processData: false,
    xhr: function () {
      var myXhr = $.ajaxSettings.xhr();
      if (myXhr.upload) {
        myXhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) {
            var percent = Math.floor(e.loaded / e.total * 100);
            $('#progressUpload').text('Upload to ChitUI: ' + percent + '%').css('width', percent + '%');

            // Start server-to-printer progress tracking when client upload reaches 50%
            // This gives time for EventSource to connect before server upload begins
            if (percent >= 50 && !progressStarted) {
              progressStarted = true;
              progressEventSource = fileTransferProgress(uploadId);
            }
          }
        }, false);
      }
      return myXhr;
    }
  })
  req.done(function (data) {
    $('#uploadFile').val('')

    // Show success toast with appropriate message
    var toastMsg = '✓ File uploaded successfully!';
    if (data.usb_gadget) {
      if (data.refresh_triggered) {
        toastMsg = '✓ File saved to USB gadget. Checking printer...';
      } else {
        toastMsg = '⚠ File saved. You may need to reconnect USB or refresh on printer.';
      }
    }

    $("#toastUploadText").text(toastMsg);
    $("#toastUpload").show()
    setTimeout(function () {
      $("#toastUpload").hide()
    }, 5000)

    // Handle file list refresh based on upload type
    if (data.usb_gadget) {
      // USB gadget upload - use retry logic since printer may need time to detect
      console.log('USB gadget upload detected, starting retry logic...')
      refreshFileListWithRetry(data.filename, 0)
    } else {
      // Network upload - single refresh is usually sufficient
      setTimeout(function() {
        if (currentPrinter) {
          console.log('Refreshing file list after network upload...')
          refreshFileList()
        }
      }, 1000)
    }
  })
  req.fail(function (xhr, status, error) {
    // Close progress EventSource if it was started
    if (progressEventSource) {
      progressEventSource.close();
    }

    // Reset progress bar
    $('#progressUpload').text('0%').css('width', '0%')
      .removeClass('progress-bar-striped progress-bar-animated text-bg-warning');

    // Better error handling - check if responseJSON exists
    var errorMsg = 'Upload failed';
    if (xhr.responseJSON && xhr.responseJSON.msg) {
      errorMsg = xhr.responseJSON.msg;
    } else if (xhr.responseText) {
      try {
        var response = JSON.parse(xhr.responseText);
        errorMsg = response.msg || errorMsg;
      } catch (e) {
        errorMsg = xhr.responseText || errorMsg;
      }
    } else if (error) {
      errorMsg = error;
    }

    alert(errorMsg);
  })
  req.always(function () {
    // Cleanup if needed
  })
}

// Helper function to generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function fileTransferProgress(uploadId) {
  $('#progressUpload').addClass('progress-bar-striped progress-bar-animated')
  var progress = new EventSource('/progress?upload_id=' + uploadId);

  progress.onmessage = function (event) {
    if (event.data > 0) {
      $('#progressUpload').text('Upload to printer: ' + event.data + '%').css('width', event.data + '%').addClass('text-bg-warning');
    }
    if (event.data == 100) {
      setTimeout(function () {
        $('#progressUpload').text('0%').css('width', '0%');
        setTimeout(function () {
          $('#progressUpload').removeClass('progress-bar-striped progress-bar-animated text-bg-warning')
        }, 1000)
      }, 1000)
      progress.close()
    }
  };

  progress.onerror = function(event) {
    console.error('EventSource error:', event);
    progress.close();
  };

  return progress;  // Return so caller can close it if needed
}

// ============ FILE LIST REFRESH HELPERS ============

function refreshFileList() {
  /**
   * Simple file list refresh - clears cache and requests fresh lists
   */
  if (!currentPrinter) return;

  // Clear the cached files list
  if (printers[currentPrinter]) {
    printers[currentPrinter]['files'] = []
  }

  // Request fresh file list from both USB and local
  getPrinterFiles(currentPrinter, '/usb')
  getPrinterFiles(currentPrinter, '/local')
}

function refreshFileListWithRetry(uploadedFilename, attemptNumber) {
  /**
   * Retry file list refresh for USB gadget uploads
   * The printer may need time to detect the new file
   *
   * @param {string} uploadedFilename - Name of the uploaded file to look for
   * @param {number} attemptNumber - Current retry attempt (0-based)
   */
  var maxAttempts = 5;
  var delays = [2000, 3000, 5000, 7000, 10000]; // Progressive delays in milliseconds

  if (attemptNumber >= maxAttempts) {
    console.log('Max retry attempts reached for file list refresh')
    $("#toastUploadText").text('⚠ File saved but not detected yet. Try refreshing the printer screen or reconnecting USB.');
    $("#toastUpload").show()
    setTimeout(function () {
      $("#toastUpload").hide()
    }, 5000)
    return;
  }

  var delay = delays[attemptNumber] || 10000;

  console.log('Refreshing file list (attempt ' + (attemptNumber + 1) + '/' + maxAttempts + ') in ' + (delay/1000) + 's...')

  setTimeout(function() {
    if (!currentPrinter) {
      console.log('No current printer, stopping retry')
      return;
    }

    // Clear the cached files list
    if (printers[currentPrinter]) {
      printers[currentPrinter]['files'] = []
    }

    // Store current file count to detect if new file appeared
    var fileCountBefore = printers[currentPrinter] && printers[currentPrinter]['files']
      ? printers[currentPrinter]['files'].length
      : 0;

    // Request fresh file list from both USB and local
    getPrinterFiles(currentPrinter, '/usb')
    getPrinterFiles(currentPrinter, '/local')

    // Wait a bit for the file list to come back, then check if file appeared
    setTimeout(function() {
      var fileFound = false;
      if (printers[currentPrinter] && printers[currentPrinter]['files']) {
        fileFound = printers[currentPrinter]['files'].some(function(file) {
          return file.name === uploadedFilename;
        });
      }

      if (fileFound) {
        console.log('✓ File detected on printer!')
        $("#toastUploadText").text('✓ File detected on printer!');
        $("#toastUpload").show()
        setTimeout(function () {
          $("#toastUpload").hide()
        }, 3000)
      } else {
        // File not found, retry
        console.log('File not detected yet, will retry...')
        refreshFileListWithRetry(uploadedFilename, attemptNumber + 1)
      }
    }, 1500); // Wait 1.5s for printer response

  }, delay);
}

// ============ UI EVENT HANDLERS ============

$('.serverStatus').on('mouseenter', function (e) {
  if ($(this).hasClass('bi-cloud-check-fill')) {
    $(this).removeClass('bi-cloud-check-fill').addClass('bi-cloud-plus text-primary')
  }
});

$('.serverStatus').on('mouseleave', function (e) {
  $(this).removeClass('bi-cloud-plus text-primary').addClass('bi-cloud-check-fill')
});

$('.serverStatus').on('click', function (e) {
  socket.emit("printers", "{}")
});

$('#toastUpload .btn-close').on('click', function (e) {
  $("#toastUpload").hide()
});

var modalConfirm;
$(document).ready(function () {
  modalConfirm = new bootstrap.Modal($('#modalConfirm'), {});

  // Thumbnail image load/error handlers for debugging
  $('#printThumbnail').on('load', function() {
    console.log('✓ Thumbnail image loaded successfully');
    console.log('Image src:', $(this).attr('src').substring(0, 100));
    console.log('Image dimensions:', this.naturalWidth + 'x' + this.naturalHeight);
  });

  $('#printThumbnail').on('error', function() {
    console.error('✗ Thumbnail image failed to load');
    console.error('Failed src:', $(this).attr('src'));
    // Show placeholder on error
    $(this).addClass('d-none');
    $('#printThumbnailPlaceholder').removeClass('d-none');
  });
});

$('#btnConfirm').on('click', function () {
  var action = $(this).data('action')
  var value = $(this).data('value')
  socket.emit('action_' + action, { id: currentPrinter, data: value })
  
  // If deleting, refresh the file list after a short delay
  if (action === 'delete') {
    setTimeout(function() {
      if (currentPrinter) {
        // Clear the cached files list
        if (printers[currentPrinter]) {
          printers[currentPrinter]['files'] = []
        }
        // Request fresh file list from both locations
        getPrinterFiles(currentPrinter, '/local')
        getPrinterFiles(currentPrinter, '/usb')
      }
    }, 500)
  }
});

// Print control button handlers
$('#btnPausePrint').on('click', function () {
  if (currentPrinter) {
    socket.emit('action_pause', { id: currentPrinter })
  }
});

$('#btnResumePrint').on('click', function () {
  if (currentPrinter) {
    socket.emit('action_resume', { id: currentPrinter })
  }
});

$('#btnStopPrint').on('click', function () {
  if (currentPrinter && confirm('Are you sure you want to stop the print?')) {
    socket.emit('action_stop', { id: currentPrinter })
  }
});

// Header button to show/reopen print status modal
$('#btnShowPrintStatus').on('click', function () {
  if (printStatusModal) {
    printStatusModal.show();
  }
});

// Main dashboard "Show Details" button
$('#btnShowPrintStatusMain').on('click', function () {
  if (printStatusModal) {
    printStatusModal.show();
  }
});

// Main dashboard print control buttons
$('#btnMainPausePrint').on('click', function () {
  if (currentPrinter) {
    socket.emit('action_pause', { id: currentPrinter });
  }
});

$('#btnMainResumePrint').on('click', function () {
  if (currentPrinter) {
    socket.emit('action_resume', { id: currentPrinter });
  }
});

$('#btnMainStopPrint').on('click', function () {
  if (currentPrinter && confirm('Are you sure you want to stop the print?')) {
    socket.emit('action_stop', { id: currentPrinter });
  }
});

$('#btnCleanStorage').on('click', function() {
  if (!currentPrinter) {
    alert('Please select a printer first');
    return;
  }
  
  if (confirm('This will delete all print history and cached data.\n\nYour .goo files will NOT be deleted.\n\nContinue?')) {
    const $btn = $(this);
    const originalText = $btn.html();
    
    $btn.prop('disabled', true).html('<i class="bi bi-hourglass-split"></i> Cleaning...');
    
    // Send command to clear history
    socket.emit('action_clear_history', { id: currentPrinter });
    
    // Re-enable button after a delay
    setTimeout(function() {
      $btn.prop('disabled', false).html(originalText);
      
      // Request updated attributes to refresh storage display
      socket.emit('get_attributes', { id: currentPrinter });
      
      alert('Storage cleanup initiated. Storage info will update in a moment.');
    }, 3000);
  }
});

$('#btnWipeStorage').on('click', function() {
  if (!currentPrinter) {
    alert('Please select a printer first');
    return;
  }
  
  if (!confirm('⚠️ WARNING: This will FORMAT the printer\'s local storage!\n\nThis will delete:\n• All .goo files\n• Print history\n• Thumbnails\n• Everything on /local\n\nThis action CANNOT be undone!\n\nAre you ABSOLUTELY sure?')) {
    return;
  }
  
  // Double confirmation
  const confirmText = prompt('Type "FORMAT" to confirm:');
  if (confirmText !== 'FORMAT') {
    alert('Cancelled. Storage was not formatted.');
    return;
  }
  
  const $btn = $(this);
  const originalText = $btn.html();
  
  $btn.prop('disabled', true).html('<i class="bi bi-hourglass-split"></i> Formatting...');
  
  // Send command to format local storage
  socket.emit('action_wipe_storage', { id: currentPrinter });
  
  // Re-enable button after a delay
  setTimeout(function() {
    $btn.prop('disabled', false).html(originalText);
    
    // Request updated file list and attributes
    getPrinterFiles(currentPrinter, '/local');
    getPrinterFiles(currentPrinter, '/usb');
    socket.emit('get_attributes', { id: currentPrinter });
    
    alert('Local storage has been formatted.');
  }, 5000);
});

// ============ INITIALIZATION ============

// Force dark mode
document.documentElement.setAttribute('data-bs-theme', 'dark');

// Mobile menu toggle
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.querySelector('.app-sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar() {
  sidebar.classList.toggle('show');
  sidebarOverlay.classList.toggle('show');
  document.body.style.overflow = sidebar.classList.contains('show') ? 'hidden' : '';
}

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener('click', toggleSidebar);
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', toggleSidebar);
}

// File upload drag and drop
const uploadArea = document.querySelector('.upload-area');
const fileInput = document.getElementById('uploadFile');
const uploadButton = document.getElementById('btnUpload');
const progressContainer = document.querySelector('.progress-enhanced');

if (uploadArea && fileInput) {
  uploadArea.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      fileInput.click();
    }
  });
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  fileInput.addEventListener('change', handleFileSelect);
}

function handleFileSelect() {
  if (fileInput.files.length > 0) {
    const fileName = fileInput.files[0].name;
    uploadArea.querySelector('h5').textContent = fileName;
    if (uploadButton) uploadButton.style.display = 'block';
    if (progressContainer) progressContainer.style.display = 'flex';
  }
}

// File search functionality
const fileSearchInput = document.getElementById('fileSearchInput');
if (fileSearchInput) {
  fileSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const fileRows = document.querySelectorAll('#fileManagerBody tr');
    
    fileRows.forEach(row => {
      if (row.cells.length === 1) return;
      const fileName = row.cells[1]?.textContent.toLowerCase() || '';
      row.style.display = fileName.includes(searchTerm) ? '' : 'none';
    });
  });
}

// Refresh files button
const btnRefreshFiles = document.getElementById('btnRefreshFiles');
if (btnRefreshFiles) {
  btnRefreshFiles.addEventListener('click', () => {
    console.log('Refreshing files...');
    if (currentPrinter) {
      // Clear the cached files list
      if (printers[currentPrinter]) {
        printers[currentPrinter]['files'] = []
      }
      // Request fresh file list from both locations
      getPrinterFiles(currentPrinter, '/local')
      getPrinterFiles(currentPrinter, '/usb')
    }
  });
}

// Monitor for files being added to the Files tab
function syncFilesToFileManager() {
  console.log('Initializing file sync...');
  
  const observer = new MutationObserver(() => {
    const fileTable = document.getElementById('tableFiles');
    if (fileTable && fileTable.children.length > 0) {
      syncTableToFileManager(fileTable);
    }
    hideFilesTab();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true
  });
  
  setInterval(() => {
    const fileTable = document.getElementById('tableFiles');
    if (fileTable && fileTable.children.length > 0) {
      syncTableToFileManager(fileTable);
    }
    hideFilesTab();
  }, 2000);
}

function hideFilesTab() {
  const filesTab = document.getElementById('tab-Files');
  if (filesTab && filesTab.parentElement) {
    filesTab.parentElement.style.visibility = 'hidden';
    filesTab.parentElement.style.position = 'absolute';
    filesTab.parentElement.style.pointerEvents = 'none';
  }
}

let lastFileCount = 0;

function syncTableToFileManager(sourceTbody) {
  const fileManagerBody = document.getElementById('fileManagerBody');
  if (!fileManagerBody || !sourceTbody) return;
  
  const rows = sourceTbody.querySelectorAll('tr');
  
  if (rows.length === lastFileCount) return;
  
  lastFileCount = rows.length;
  console.log(`Syncing ${rows.length} files to File Manager`);
  
  fileManagerBody.innerHTML = '';
  
  rows.forEach((row, index) => {
    const newRow = document.createElement('tr');
    newRow.classList.add('file-row');
    
    const cells = row.querySelectorAll('td');
    
    if (cells.length >= 2) {
      const indexCell = document.createElement('td');
      indexCell.textContent = index;
      indexCell.style.width = '50px';
      newRow.appendChild(indexCell);
      
      const fieldValueContent = cells[1].innerHTML;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = fieldValueContent;
      const filename = tempDiv.childNodes[0]?.textContent || '';
      
      const filenameCell = document.createElement('td');
      filenameCell.textContent = filename;
      filenameCell.style.fontFamily = 'monospace';
      newRow.appendChild(filenameCell);
      
      const actionsCell = document.createElement('td');
      const icons = tempDiv.querySelectorAll('i');
      icons.forEach(icon => actionsCell.appendChild(icon.cloneNode(true)));
      actionsCell.style.textAlign = 'right';
      newRow.appendChild(actionsCell);
      
      const dataFile = row.getAttribute('data-file');
      if (dataFile) {
        newRow.setAttribute('data-file', dataFile);
      }
      
      fileManagerBody.appendChild(newRow);
    }
  });
  
  console.log('File Manager updated with', fileManagerBody.children.length, 'files');
}

setTimeout(syncFilesToFileManager, 1000);

// Format PrintInfo nicely
function formatPrintInfo() {
  const statusTable = document.getElementById('tableStatus');
  if (!statusTable) return;
  
  const rows = statusTable.querySelectorAll('tr');
  rows.forEach(row => {
    const keyCell = row.querySelector('.fieldKey');
    if (keyCell && keyCell.textContent.trim() === 'PrintInfo') {
      const valueCell = row.querySelector('.fieldValue');
      if (valueCell) {
        try {
          let printInfo;
          const printInfoText = valueCell.textContent.trim();
          
          // Check if it's already parsed or needs parsing
          if (printInfoText.startsWith('{')) {
            printInfo = JSON.parse(printInfoText);
          } else {
            // Skip formatting if it's not valid JSON
            return;
          }
          
          const formattedHTML = `
            <div class="print-info-card">
              <div class="print-info-item">
                <span class="print-info-label">Status</span>
                <span class="print-status-badge ${printInfo.Status === 0 ? 'print-status-idle' : 'print-status-printing'}">
                  ${printInfo.Status === 0 ? 'Idle' : 'Active'}
                </span>
              </div>
              <div class="print-info-item">
                <span class="print-info-label">Current Layer</span>
                <span class="print-info-value">${printInfo.CurrentLayer || 0}</span>
              </div>
              <div class="print-info-item">
                <span class="print-info-label">Total Layers</span>
                <span class="print-info-value">${printInfo.TotalLayer || 0}</span>
              </div>
              <div class="print-info-item">
                <span class="print-info-label">Progress</span>
                <span class="print-info-value large">${printInfo.TotalLayer ? Math.round((printInfo.CurrentLayer / printInfo.TotalLayer) * 100) : 0}%</span>
              </div>
              <div class="print-info-item">
                <span class="print-info-label">Elapsed Time</span>
                <span class="print-info-value">${formatMilliseconds(printInfo.CurrentTicks || 0)}</span>
              </div>
              <div class="print-info-item">
                <span class="print-info-label">Total Time</span>
                <span class="print-info-value">${formatMilliseconds(printInfo.TotalTicks || 0)}</span>
              </div>
              ${printInfo.Filename ? `
              <div class="print-info-item">
                <span class="print-info-label">File</span>
                <span class="print-info-value" style="font-size: 0.75rem; word-break: break-all;">${printInfo.Filename}</span>
              </div>
              ` : ''}
              ${printInfo.ErrorNumber && printInfo.ErrorNumber !== 0 ? `
              <div class="print-info-item">
                <span class="print-info-label">Error</span>
                <span class="print-status-badge print-status-error">Error ${printInfo.ErrorNumber}</span>
              </div>
              ` : ''}
            </div>
          `;
          
          valueCell.innerHTML = formattedHTML;
        } catch (e) {
          // Silently skip - PrintInfo might not be valid JSON yet
        }
      }
    }
  });
}

function formatMilliseconds(ms) {
  if (!ms || ms === 0) return '00:00:00';
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

setInterval(formatPrintInfo, 1000);

// Auto-select first printer on load
function autoSelectFirstPrinter() {
  console.log('Starting auto-select...');
  
  let attempts = 0;
  const maxAttempts = 30;
  
  const checkInterval = setInterval(() => {
    attempts++;
    
    const printersList = document.getElementById('printersList');
    if (!printersList) {
      console.log('Printers list not found yet...');
      return;
    }
    
    const printers = printersList.querySelectorAll('.printer-card');
    
    if (printers.length > 0) {
      console.log(`Found ${printers.length} printer(s)`);
      clearInterval(checkInterval);
      
      const lastPrinterId = localStorage.getItem('lastSelectedPrinter');
      let printerToSelect = null;
      
      if (lastPrinterId) {
        printerToSelect = Array.from(printers).find(
          p => p.getAttribute('data-printer-id') === lastPrinterId
        );
        if (printerToSelect) {
          console.log('Found last selected printer:', lastPrinterId);
        }
      }
      
      if (!printerToSelect) {
        printerToSelect = printers[0];
        console.log('Selecting first printer');
      }
      
      setTimeout(() => {
        printers.forEach(p => p.classList.remove('active'));
        printerToSelect.classList.add('active');
        printerToSelect.click();
        console.log('Printer auto-selected');
        
        const waitForStatus = setInterval(() => {
          const statusTab = document.getElementById('tab-Status');
          if (statusTab) {
            console.log('Auto-clicking Status tab');
            statusTab.click();
            clearInterval(waitForStatus);
          }
        }, 200);
        
        setTimeout(() => clearInterval(waitForStatus), 5000);
        
      }, 1500);
      
    } else if (attempts >= maxAttempts) {
      console.log('No printers found after timeout');
      clearInterval(checkInterval);
    }
  }, 200);
}

window.addEventListener('load', () => {
  setTimeout(autoSelectFirstPrinter, 1000);
});

// Save printer selection
document.addEventListener('click', (e) => {
  const printerCard = e.target.closest('.printer-card');
  if (printerCard) {
    document.querySelectorAll('.printer-card').forEach(p => p.classList.remove('active'));
    printerCard.classList.add('active');
    
    const printerId = printerCard.getAttribute('data-printer-id');
    if (printerId) {
      localStorage.setItem('lastSelectedPrinter', printerId);
    }
    
    if (window.innerWidth <= 992) {
      toggleSidebar();
    }
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  if (window.innerWidth > 992) {
    sidebar.classList.remove('show');
    sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// Bootstrap tooltips
(() => {
  'use strict'
  const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl)
  })
})()