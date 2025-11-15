<?php
require_once 'config.php';

// Check if database connection is available
if ($pdo === null) {
    die("
    <!DOCTYPE html>
    <html><head><title>Database Error</title>
    <link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css' rel='stylesheet'></head>
    <body><div class='container mt-5'><div class='alert alert-danger'>
    <h1>Database Connection Error</h1><hr>
    <p>Cannot access admin panel - database connection failed.</p>
    <p><strong>Error:</strong> " . escape($_SESSION['db_error'] ?? 'Unknown error') . "</p>
    <a href='diagnostic.php' class='btn btn-warning'>Run Diagnostic</a>
    <a href='QUICKSTART.md' class='btn btn-info'>Setup Guide</a>
    </div></div></body></html>
    ");
}

requireAdmin();

$message = '';
$error = '';

// Handle plugin addition
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'add_plugin') {
        try {
            // Validate required fields
            $name = trim($_POST['name'] ?? '');
            $version = trim($_POST['version'] ?? '');
            $author = trim($_POST['author'] ?? '');
            $description = trim($_POST['description'] ?? '');
            $long_description = trim($_POST['long_description'] ?? '');

            if (!$name || !$version || !$author || !$description) {
                throw new Exception('Please fill in all required fields');
            }

            // Handle plugin file upload
            $pluginFilename = null;
            $fileSize = null;

            if (isset($_FILES['plugin_file']) && $_FILES['plugin_file']['error'] === UPLOAD_ERR_OK) {
                $fileExt = strtolower(pathinfo($_FILES['plugin_file']['name'], PATHINFO_EXTENSION));

                if (!in_array($fileExt, ALLOWED_PLUGIN_TYPES)) {
                    throw new Exception('Invalid plugin file type. Only ZIP files allowed.');
                }

                if ($_FILES['plugin_file']['size'] > MAX_PLUGIN_SIZE) {
                    throw new Exception('Plugin file is too large. Maximum size: ' . formatFileSize(MAX_PLUGIN_SIZE));
                }

                $pluginFilename = uniqid('plugin_') . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', basename($_FILES['plugin_file']['name']));
                $uploadPath = PLUGINS_PATH . $pluginFilename;

                if (!move_uploaded_file($_FILES['plugin_file']['tmp_name'], $uploadPath)) {
                    throw new Exception('Failed to upload plugin file');
                }

                $fileSize = $_FILES['plugin_file']['size'];
            }

            // Handle multiple image uploads (up to 3)
            $uploadedImages = [];
            $imageFilename = null; // Primary image for backward compatibility

            for ($i = 1; $i <= 3; $i++) {
                $fieldName = 'image_file_' . $i;

                if (isset($_FILES[$fieldName]) && $_FILES[$fieldName]['error'] === UPLOAD_ERR_OK) {
                    $imageExt = strtolower(pathinfo($_FILES[$fieldName]['name'], PATHINFO_EXTENSION));

                    if (!in_array($imageExt, ALLOWED_IMAGE_TYPES)) {
                        throw new Exception("Image $i: Invalid image type. Allowed: " . implode(', ', ALLOWED_IMAGE_TYPES));
                    }

                    if ($_FILES[$fieldName]['size'] > MAX_IMAGE_SIZE) {
                        throw new Exception("Image $i: File too large. Maximum: " . formatFileSize(MAX_IMAGE_SIZE));
                    }

                    $filename = uniqid('img_') . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', basename($_FILES[$fieldName]['name']));
                    $uploadPath = IMAGES_PATH . $filename;

                    if (!move_uploaded_file($_FILES[$fieldName]['tmp_name'], $uploadPath)) {
                        throw new Exception("Image $i: Failed to upload");
                    }

                    $uploadedImages[] = ['filename' => $filename, 'order' => $i];

                    // Set first image as primary
                    if ($i == 1) {
                        $imageFilename = $filename;
                    }
                }
            }

            // Prepare dependencies JSON
            $dependencies = trim($_POST['dependencies'] ?? '');
            $dependenciesJson = $dependencies ? json_encode(array_map('trim', explode(',', $dependencies))) : null;

            // Insert into database
            $stmt = $pdo->prepare("
                INSERT INTO plugins (
                    name, version, author, description, long_description,
                    dependencies, ui_type, ui_location, icon,
                    image_filename, plugin_filename, file_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $name,
                $version,
                $author,
                $description,
                $long_description ?: null,
                $dependenciesJson,
                $_POST['ui_type'] ?? null,
                $_POST['ui_location'] ?? null,
                $_POST['icon'] ?? null,
                $imageFilename,
                $pluginFilename,
                $fileSize
            ]);

            // Get the new plugin ID
            $newPluginId = $pdo->lastInsertId();

            // Insert all uploaded images into plugin_images table
            foreach ($uploadedImages as $img) {
                addPluginImage($newPluginId, $img['filename'], $img['order']);
            }

            $message = 'Plugin added successfully!' . (!empty($uploadedImages) ? ' (' . count($uploadedImages) . ' image(s) uploaded)' : '');
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    } elseif ($_POST['action'] === 'delete_plugin') {
        try {
            $pluginId = intval($_POST['plugin_id'] ?? 0);
            if (!$pluginId) {
                throw new Exception('Invalid plugin ID');
            }

            // Get plugin info
            $stmt = $pdo->prepare("SELECT * FROM plugins WHERE id = ?");
            $stmt->execute([$pluginId]);
            $plugin = $stmt->fetch();

            if ($plugin) {
                // Delete plugin file
                if ($plugin['plugin_filename'] && file_exists(PLUGINS_PATH . $plugin['plugin_filename'])) {
                    unlink(PLUGINS_PATH . $plugin['plugin_filename']);
                }

                // Delete all plugin images (from plugin_images table)
                deletePluginImages($pluginId);

                // Delete old single image if exists (backward compatibility)
                if ($plugin['image_filename'] && file_exists(IMAGES_PATH . $plugin['image_filename'])) {
                    unlink(IMAGES_PATH . $plugin['image_filename']);
                }

                // Delete from database (this will cascade delete plugin_images due to FK)
                $deleteStmt = $pdo->prepare("DELETE FROM plugins WHERE id = ?");
                $deleteStmt->execute([$pluginId]);

                $message = 'Plugin deleted successfully!';
            }
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
}

// Fetch all plugins
$plugins = $pdo->query("SELECT * FROM plugins ORDER BY created_at DESC")->fetchAll();

// Get statistics
$stats = $pdo->query("
    SELECT
        COUNT(*) as total_plugins,
        SUM(downloads) as total_downloads,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_plugins
    FROM plugins
")->fetch();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - <?php echo escape(SITE_NAME); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="index.php">
                <i class="bi bi-plugin"></i> <?php echo escape(SITE_NAME); ?>
            </a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="index.php">Browse Plugins</a>
                <a class="nav-link active" href="admin.php">Admin Panel</a>
                <a class="nav-link" href="logout.php">Logout</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <h1 class="mb-4"><i class="bi bi-gear-fill"></i> Admin Panel</h1>

        <?php if ($message): ?>
            <div class="alert alert-success alert-dismissible fade show">
                <i class="bi bi-check-circle"></i> <?php echo escape($message); ?>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="alert alert-danger alert-dismissible fade show">
                <i class="bi bi-exclamation-triangle"></i> <?php echo escape($error); ?>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endif; ?>

        <!-- Statistics Cards -->
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <h5 class="card-title">Total Plugins</h5>
                        <h2 class="mb-0"><?php echo $stats['total_plugins']; ?></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h5 class="card-title">Active Plugins</h5>
                        <h2 class="mb-0"><?php echo $stats['active_plugins']; ?></h2>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <h5 class="card-title">Total Downloads</h5>
                        <h2 class="mb-0"><?php echo number_format($stats['total_downloads']); ?></h2>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add Plugin Form -->
        <div class="card mb-4">
            <div class="card-header bg-success text-white">
                <h5 class="mb-0"><i class="bi bi-plus-circle"></i> Add New Plugin</h5>
            </div>
            <div class="card-body">
                <form method="POST" enctype="multipart/form-data">
                    <input type="hidden" name="action" value="add_plugin">

                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Plugin Name *</label>
                                <input type="text" class="form-control" name="name" required>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="mb-3">
                                <label class="form-label">Version *</label>
                                <input type="text" class="form-control" name="version" placeholder="1.0.0" required>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="mb-3">
                                <label class="form-label">Author *</label>
                                <input type="text" class="form-control" name="author" required>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Short Description *</label>
                        <input type="text" class="form-control" name="description" maxlength="255" required>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Long Description</label>
                        <textarea class="form-control" name="long_description" rows="4"></textarea>
                    </div>

                    <div class="row">
                        <div class="col-md-4">
                            <div class="mb-3">
                                <label class="form-label">UI Type</label>
                                <select class="form-select" name="ui_type">
                                    <option value="">Select...</option>
                                    <option value="toolbar">Toolbar</option>
                                    <option value="card">Card</option>
                                    <option value="modal">Modal</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <label class="form-label">UI Location</label>
                                <select class="form-select" name="ui_location">
                                    <option value="">Select...</option>
                                    <option value="top">Top</option>
                                    <option value="main">Main</option>
                                    <option value="sidebar">Sidebar</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <label class="form-label">Icon (Bootstrap Icon name)</label>
                                <input type="text" class="form-control" name="icon" placeholder="puzzle">
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Dependencies (comma-separated)</label>
                        <input type="text" class="form-control" name="dependencies" placeholder="RPi.GPIO, requests">
                    </div>

                    <div class="row">
                        <div class="col-md-12">
                            <div class="mb-3">
                                <label class="form-label">Plugin File (ZIP)</label>
                                <input type="file" class="form-control" name="plugin_file" accept=".zip">
                                <small class="text-muted">Max size: <?php echo formatFileSize(MAX_PLUGIN_SIZE); ?></small>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Plugin Images (Upload up to 3 images)</label>
                        <div class="row">
                            <div class="col-md-4">
                                <label class="form-label small text-muted">Image 1</label>
                                <input type="file" class="form-control" name="image_file_1" accept="image/*">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small text-muted">Image 2</label>
                                <input type="file" class="form-control" name="image_file_2" accept="image/*">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small text-muted">Image 3</label>
                                <input type="file" class="form-control" name="image_file_3" accept="image/*">
                            </div>
                        </div>
                        <small class="text-muted">Max size per image: <?php echo formatFileSize(MAX_IMAGE_SIZE); ?>. Images will scroll in a carousel.</small>
                    </div>

                    <button type="submit" class="btn btn-success">
                        <i class="bi bi-plus-circle"></i> Add Plugin
                    </button>
                </form>
            </div>
        </div>

        <!-- Plugins List -->
        <div class="card">
            <div class="card-header bg-dark text-white">
                <h5 class="mb-0"><i class="bi bi-list"></i> Manage Plugins</h5>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Version</th>
                                <th>Author</th>
                                <th>Downloads</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($plugins as $plugin): ?>
                                <tr>
                                    <td><?php echo $plugin['id']; ?></td>
                                    <td>
                                        <?php if ($plugin['image_filename']): ?>
                                            <img src="uploads/images/<?php echo escape($plugin['image_filename']); ?>"
                                                 class="admin-thumb" alt="Thumbnail">
                                        <?php else: ?>
                                            <i class="bi bi-image text-muted"></i>
                                        <?php endif; ?>
                                    </td>
                                    <td><strong><?php echo escape($plugin['name']); ?></strong></td>
                                    <td><span class="badge bg-primary"><?php echo escape($plugin['version']); ?></span></td>
                                    <td><?php echo escape($plugin['author']); ?></td>
                                    <td><?php echo number_format($plugin['downloads']); ?></td>
                                    <td>
                                        <?php if ($plugin['is_active']): ?>
                                            <span class="badge bg-success">Active</span>
                                        <?php else: ?>
                                            <span class="badge bg-secondary">Inactive</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo date('Y-m-d', strtotime($plugin['created_at'])); ?></td>
                                    <td>
                                        <a href="plugin.php?id=<?php echo $plugin['id']; ?>"
                                           class="btn btn-sm btn-info" target="_blank">
                                            <i class="bi bi-eye"></i>
                                        </a>
                                        <form method="POST" class="d-inline"
                                              onsubmit="return confirm('Are you sure you want to delete this plugin?');">
                                            <input type="hidden" name="action" value="delete_plugin">
                                            <input type="hidden" name="plugin_id" value="<?php echo $plugin['id']; ?>">
                                            <button type="submit" class="btn btn-sm btn-danger">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
