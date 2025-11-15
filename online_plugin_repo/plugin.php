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
    <p>Cannot view plugin - database connection failed.</p>
    <a href='diagnostic.php' class='btn btn-warning'>Run Diagnostic</a>
    <a href='index.php' class='btn btn-primary'>Back to Home</a>
    </div></div></body></html>
    ");
}

// Get plugin ID
$pluginId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if (!$pluginId) {
    header('Location: index.php');
    exit;
}

// Fetch plugin details
$stmt = $pdo->prepare("SELECT * FROM plugins WHERE id = ? AND is_active = 1");
$stmt->execute([$pluginId]);
$plugin = $stmt->fetch();

if (!$plugin) {
    header('Location: index.php');
    exit;
}

// Parse dependencies
$dependencies = $plugin['dependencies'] ? json_decode($plugin['dependencies'], true) : [];
if (!is_array($dependencies)) {
    $dependencies = $plugin['dependencies'] ? explode(',', $plugin['dependencies']) : [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo escape($plugin['name']); ?> - <?php echo escape(SITE_NAME); ?></title>
    <link rel="stylesheet" href="css/style.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="index.php">
                <i class="bi bi-plugin"></i> <?php echo escape(SITE_NAME); ?>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="index.php">Browse Plugins</a>
                    </li>
                    <?php if (isAdmin()): ?>
                        <li class="nav-item">
                            <a class="nav-link" href="admin.php">Admin Panel</a>
                        </li>
                    <?php endif; ?>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container mt-5">
        <nav aria-label="breadcrumb">
            <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="index.php">Plugins</a></li>
                <li class="breadcrumb-item active"><?php echo escape($plugin['name']); ?></li>
            </ol>
        </nav>

        <div class="row">
            <!-- Main Content -->
            <div class="col-lg-8">
                <!-- Plugin Header -->
                <div class="plugin-header mb-4">
                    <h1 class="display-5">
                        <?php if ($plugin['icon']): ?>
                            <i class="bi bi-<?php echo escape($plugin['icon']); ?>"></i>
                        <?php else: ?>
                            <i class="bi bi-puzzle"></i>
                        <?php endif; ?>
                        <?php echo escape($plugin['name']); ?>
                    </h1>
                    <p class="lead text-muted"><?php echo escape($plugin['description']); ?></p>
                </div>

                <!-- Plugin Images Carousel -->
                <?php
                // Get all images for this plugin
                $pluginImages = getPluginImages($plugin['id']);
                ?>
                <?php if (!empty($pluginImages)): ?>
                    <div class="card mb-4">
                        <div id="carousel-detail-<?php echo $plugin['id']; ?>" class="carousel slide" data-bs-ride="false">
                            <div class="carousel-inner">
                                <?php foreach ($pluginImages as $index => $img): ?>
                                    <div class="carousel-item <?php echo $index === 0 ? 'active' : ''; ?>">
                                        <img src="uploads/images/<?php echo escape($img['image_filename']); ?>"
                                             class="d-block w-100 plugin-detail-image"
                                             alt="<?php echo escape($plugin['name']); ?> - Image <?php echo ($index + 1); ?>">
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <?php if (count($pluginImages) > 1): ?>
                                <button class="carousel-control-prev" type="button" data-bs-target="#carousel-detail-<?php echo $plugin['id']; ?>" data-bs-slide="prev">
                                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                                    <span class="visually-hidden">Previous</span>
                                </button>
                                <button class="carousel-control-next" type="button" data-bs-target="#carousel-detail-<?php echo $plugin['id']; ?>" data-bs-slide="next">
                                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                                    <span class="visually-hidden">Next</span>
                                </button>
                                <!-- Image indicators -->
                                <div class="carousel-indicators">
                                    <?php foreach ($pluginImages as $index => $img): ?>
                                        <button type="button" data-bs-target="#carousel-detail-<?php echo $plugin['id']; ?>"
                                                data-bs-slide-to="<?php echo $index; ?>"
                                                <?php echo $index === 0 ? 'class="active"' : ''; ?>
                                                aria-label="Slide <?php echo ($index + 1); ?>"></button>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- Long Description -->
                <div class="card mb-4">
                    <div class="card-header bg-primary text-white">
                        <i class="bi bi-file-text"></i> Description
                    </div>
                    <div class="card-body">
                        <?php if ($plugin['long_description']): ?>
                            <div class="plugin-description">
                                <?php echo nl2br(escape($plugin['long_description'])); ?>
                            </div>
                        <?php else: ?>
                            <p class="text-muted">No detailed description available.</p>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <!-- Sidebar -->
            <div class="col-lg-4">
                <!-- Download Card -->
                <div class="card mb-4 shadow">
                    <div class="card-header bg-success text-white">
                        <i class="bi bi-download"></i> Download
                    </div>
                    <div class="card-body text-center">
                        <div class="mb-3">
                            <h3 class="text-success mb-0">
                                <i class="bi bi-download"></i>
                                <?php echo number_format($plugin['downloads']); ?>
                            </h3>
                            <small class="text-muted">Total Downloads</small>
                        </div>
                        <?php if ($plugin['plugin_filename']): ?>
                            <a href="download.php?id=<?php echo $plugin['id']; ?>"
                               class="btn btn-success btn-lg w-100 mb-2">
                                <i class="bi bi-download"></i> Download Plugin
                            </a>
                            <?php if ($plugin['file_size']): ?>
                                <small class="text-muted">
                                    Size: <?php echo formatFileSize($plugin['file_size']); ?>
                                </small>
                            <?php endif; ?>
                        <?php else: ?>
                            <button class="btn btn-secondary btn-lg w-100" disabled>
                                <i class="bi bi-x-circle"></i> Not Available
                            </button>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Plugin Info Card -->
                <div class="card mb-4">
                    <div class="card-header bg-dark text-white">
                        <i class="bi bi-info-circle"></i> Plugin Information
                    </div>
                    <div class="card-body">
                        <table class="table table-sm table-borderless mb-0">
                            <tr>
                                <td class="text-muted"><i class="bi bi-tag"></i> Version</td>
                                <td class="text-end"><strong><?php echo escape($plugin['version']); ?></strong></td>
                            </tr>
                            <tr>
                                <td class="text-muted"><i class="bi bi-person"></i> Author</td>
                                <td class="text-end"><?php echo escape($plugin['author']); ?></td>
                            </tr>
                            <tr>
                                <td class="text-muted"><i class="bi bi-calendar"></i> Created</td>
                                <td class="text-end"><?php echo date('M j, Y', strtotime($plugin['created_at'])); ?></td>
                            </tr>
                            <tr>
                                <td class="text-muted"><i class="bi bi-clock"></i> Updated</td>
                                <td class="text-end"><?php echo date('M j, Y', strtotime($plugin['updated_at'])); ?></td>
                            </tr>
                            <?php if ($plugin['ui_type']): ?>
                                <tr>
                                    <td class="text-muted"><i class="bi bi-layout-sidebar"></i> UI Type</td>
                                    <td class="text-end">
                                        <span class="badge bg-info"><?php echo escape($plugin['ui_type']); ?></span>
                                    </td>
                                </tr>
                            <?php endif; ?>
                            <?php if ($plugin['ui_location']): ?>
                                <tr>
                                    <td class="text-muted"><i class="bi bi-geo-alt"></i> Location</td>
                                    <td class="text-end">
                                        <span class="badge bg-secondary"><?php echo escape($plugin['ui_location']); ?></span>
                                    </td>
                                </tr>
                            <?php endif; ?>
                        </table>
                    </div>
                </div>

                <!-- Dependencies Card -->
                <?php if (!empty($dependencies)): ?>
                    <div class="card mb-4">
                        <div class="card-header bg-warning">
                            <i class="bi bi-box-seam"></i> Dependencies
                        </div>
                        <div class="card-body">
                            <ul class="list-unstyled mb-0">
                                <?php foreach ($dependencies as $dep): ?>
                                    <li class="mb-1">
                                        <i class="bi bi-check-circle text-success"></i>
                                        <code><?php echo escape(trim($dep)); ?></code>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- Installation Instructions -->
                <div class="card mb-4">
                    <div class="card-header bg-info text-white">
                        <i class="bi bi-gear"></i> Installation
                    </div>
                    <div class="card-body">
                        <ol class="mb-0 small">
                            <li>Download the plugin file</li>
                            <li>Extract to <code>plugins/</code> directory</li>
                            <li>Restart ChitUI</li>
                            <li>Enable in Plugin Manager</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <footer class="bg-dark text-white mt-5 py-4">
        <div class="container text-center">
            <p class="mb-0">
                <i class="bi bi-plugin"></i> <?php echo escape(SITE_NAME); ?>
            </p>
            <p class="text-muted small mb-0">
                Made with <i class="bi bi-heart-fill text-danger"></i> for the ChitUI community
            </p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
