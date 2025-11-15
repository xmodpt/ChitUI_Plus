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
    <a href='diagnostic.php' class='btn btn-warning'>Run Diagnostic</a>
    </div></div></body></html>
    ");
}

requireAdmin();

// Fetch statistics
$stats = $pdo->query("
    SELECT
        COUNT(*) as total_plugins,
        SUM(downloads) as total_downloads,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_plugins
    FROM plugins
")->fetch();

// Fetch all plugins
$plugins = $pdo->query("SELECT * FROM plugins ORDER BY created_at DESC")->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - Simple Version</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <style>
        body { padding: 20px; }
        .admin-thumb { width: 50px; height: 50px; object-fit: cover; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <h1>Admin Panel - Simple Version</h1>
        <p>Logged in as: <?php echo escape($_SESSION['admin_username'] ?? 'Unknown'); ?></p>
        <a href="logout.php" class="btn btn-warning mb-3">Logout</a>
        <a href="admin.php" class="btn btn-primary mb-3">Full Admin Panel</a>

        <h2>Statistics</h2>
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="alert alert-primary">
                    <strong>Total Plugins:</strong> <?php echo $stats['total_plugins']; ?>
                </div>
            </div>
            <div class="col-md-4">
                <div class="alert alert-success">
                    <strong>Active Plugins:</strong> <?php echo $stats['active_plugins']; ?>
                </div>
            </div>
            <div class="col-md-4">
                <div class="alert alert-info">
                    <strong>Total Downloads:</strong> <?php echo number_format($stats['total_downloads']); ?>
                </div>
            </div>
        </div>

        <h2>Plugins List</h2>
        <table class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Author</th>
                    <th>Downloads</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($plugins)): ?>
                    <tr>
                        <td colspan="8" class="text-center">No plugins yet</td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($plugins as $plugin): ?>
                        <tr>
                            <td><?php echo $plugin['id']; ?></td>
                            <td>
                                <?php if ($plugin['image_filename']): ?>
                                    <img src="uploads/images/<?php echo escape($plugin['image_filename']); ?>"
                                         class="admin-thumb" alt="Thumb">
                                <?php else: ?>
                                    <i class="bi bi-image"></i>
                                <?php endif; ?>
                            </td>
                            <td><?php echo escape($plugin['name']); ?></td>
                            <td><?php echo escape($plugin['version']); ?></td>
                            <td><?php echo escape($plugin['author']); ?></td>
                            <td><?php echo number_format($plugin['downloads']); ?></td>
                            <td>
                                <?php if ($plugin['is_active']): ?>
                                    <span class="badge bg-success">Active</span>
                                <?php else: ?>
                                    <span class="badge bg-secondary">Inactive</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <a href="plugin.php?id=<?php echo $plugin['id']; ?>"
                                   class="btn btn-sm btn-info" target="_blank">View</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <hr>
        <h2>Add New Plugin</h2>
        <p><a href="admin.php" class="btn btn-success">Go to Full Admin Panel to Add Plugins</a></p>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
