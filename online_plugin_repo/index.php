<?php
require_once 'config.php';

// Get current page
$page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$offset = ($page - 1) * PLUGINS_PER_PAGE;

// Get search query if exists
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

// Build query
if ($search) {
    $stmt = $pdo->prepare("
        SELECT * FROM plugins
        WHERE is_active = 1
        AND (name LIKE ? OR description LIKE ? OR author LIKE ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $searchTerm = "%$search%";
    $stmt->execute([$searchTerm, $searchTerm, $searchTerm, PLUGINS_PER_PAGE, $offset]);

    $countStmt = $pdo->prepare("
        SELECT COUNT(*) FROM plugins
        WHERE is_active = 1
        AND (name LIKE ? OR description LIKE ? OR author LIKE ?)
    ");
    $countStmt->execute([$searchTerm, $searchTerm, $searchTerm]);
} else {
    $stmt = $pdo->prepare("
        SELECT * FROM plugins
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([PLUGINS_PER_PAGE, $offset]);

    $countStmt = $pdo->query("SELECT COUNT(*) FROM plugins WHERE is_active = 1");
}

$plugins = $stmt->fetchAll();
$totalPlugins = $countStmt->fetchColumn();
$totalPages = ceil($totalPlugins / PLUGINS_PER_PAGE);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo escape(SITE_NAME); ?> - Browse Plugins</title>
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
                        <a class="nav-link active" href="index.php">Browse Plugins</a>
                    </li>
                    <?php if (isAdmin()): ?>
                        <li class="nav-item">
                            <a class="nav-link" href="admin.php">Admin Panel</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="logout.php">Logout</a>
                        </li>
                    <?php else: ?>
                        <li class="nav-item">
                            <a class="nav-link" href="login.php">Admin Login</a>
                        </li>
                    <?php endif; ?>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container mt-5">
        <div class="row mb-4">
            <div class="col-md-8">
                <h1><i class="bi bi-collection"></i> Browse Plugins</h1>
                <p class="text-muted">Discover and download plugins for ChitUI</p>
            </div>
            <div class="col-md-4">
                <form method="GET" action="index.php" class="d-flex">
                    <input type="search" name="search" class="form-control me-2"
                           placeholder="Search plugins..." value="<?php echo escape($search); ?>">
                    <button type="submit" class="btn btn-primary">
                        <i class="bi bi-search"></i>
                    </button>
                </form>
            </div>
        </div>

        <?php if ($search): ?>
            <div class="alert alert-info">
                Showing results for "<strong><?php echo escape($search); ?></strong>"
                (<?php echo $totalPlugins; ?> plugin<?php echo $totalPlugins != 1 ? 's' : ''; ?> found)
                <a href="index.php" class="alert-link float-end">Clear search</a>
            </div>
        <?php endif; ?>

        <?php if (empty($plugins)): ?>
            <div class="alert alert-warning text-center">
                <i class="bi bi-exclamation-triangle"></i>
                <?php echo $search ? 'No plugins found matching your search.' : 'No plugins available yet.'; ?>
            </div>
        <?php else: ?>
            <div class="row">
                <?php foreach ($plugins as $plugin): ?>
                    <?php
                    // Get all images for this plugin
                    $pluginImages = getPluginImages($plugin['id']);
                    ?>
                    <div class="col-md-4 col-lg-3 mb-4">
                        <div class="card plugin-card h-100">
                            <?php if (!empty($pluginImages)): ?>
                                <!-- Image Carousel -->
                                <div id="carousel-<?php echo $plugin['id']; ?>" class="carousel slide" data-bs-ride="false">
                                    <div class="carousel-inner">
                                        <?php foreach ($pluginImages as $index => $img): ?>
                                            <div class="carousel-item <?php echo $index === 0 ? 'active' : ''; ?>">
                                                <img src="uploads/images/<?php echo escape($img['image_filename']); ?>"
                                                     class="d-block w-100 plugin-image"
                                                     alt="<?php echo escape($plugin['name']); ?> - Image <?php echo ($index + 1); ?>">
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                    <?php if (count($pluginImages) > 1): ?>
                                        <button class="carousel-control-prev" type="button" data-bs-target="#carousel-<?php echo $plugin['id']; ?>" data-bs-slide="prev">
                                            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                                            <span class="visually-hidden">Previous</span>
                                        </button>
                                        <button class="carousel-control-next" type="button" data-bs-target="#carousel-<?php echo $plugin['id']; ?>" data-bs-slide="next">
                                            <span class="carousel-control-next-icon" aria-hidden="true"></span>
                                            <span class="visually-hidden">Next</span>
                                        </button>
                                        <!-- Image indicators -->
                                        <div class="carousel-indicators">
                                            <?php foreach ($pluginImages as $index => $img): ?>
                                                <button type="button" data-bs-target="#carousel-<?php echo $plugin['id']; ?>"
                                                        data-bs-slide-to="<?php echo $index; ?>"
                                                        <?php echo $index === 0 ? 'class="active"' : ''; ?>
                                                        aria-label="Slide <?php echo ($index + 1); ?>"></button>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            <?php else: ?>
                                <div class="card-img-top plugin-image-placeholder">
                                    <i class="bi bi-puzzle display-1"></i>
                                </div>
                            <?php endif; ?>
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title"><?php echo escape($plugin['name']); ?></h5>
                                <p class="text-muted small mb-2">
                                    <i class="bi bi-person"></i> <?php echo escape($plugin['author']); ?>
                                </p>
                                <p class="card-text flex-grow-1"><?php echo escape($plugin['description']); ?></p>
                                <div class="plugin-meta">
                                    <span class="badge bg-primary">v<?php echo escape($plugin['version']); ?></span>
                                    <span class="badge bg-secondary">
                                        <i class="bi bi-download"></i> <?php echo number_format($plugin['downloads']); ?>
                                    </span>
                                </div>
                                <a href="plugin.php?id=<?php echo $plugin['id']; ?>"
                                   class="btn btn-primary w-100 mt-3">
                                    <i class="bi bi-info-circle"></i> View Details
                                </a>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>

            <!-- Pagination -->
            <?php if ($totalPages > 1): ?>
                <nav aria-label="Plugin pagination" class="mt-4">
                    <ul class="pagination justify-content-center">
                        <?php if ($page > 1): ?>
                            <li class="page-item">
                                <a class="page-link" href="?page=<?php echo $page - 1; ?><?php echo $search ? '&search=' . urlencode($search) : ''; ?>">
                                    <i class="bi bi-chevron-left"></i> Previous
                                </a>
                            </li>
                        <?php endif; ?>

                        <?php for ($i = max(1, $page - 2); $i <= min($totalPages, $page + 2); $i++): ?>
                            <li class="page-item <?php echo $i == $page ? 'active' : ''; ?>">
                                <a class="page-link" href="?page=<?php echo $i; ?><?php echo $search ? '&search=' . urlencode($search) : ''; ?>">
                                    <?php echo $i; ?>
                                </a>
                            </li>
                        <?php endfor; ?>

                        <?php if ($page < $totalPages): ?>
                            <li class="page-item">
                                <a class="page-link" href="?page=<?php echo $page + 1; ?><?php echo $search ? '&search=' . urlencode($search) : ''; ?>">
                                    Next <i class="bi bi-chevron-right"></i>
                                </a>
                            </li>
                        <?php endif; ?>
                    </ul>
                </nav>
            <?php endif; ?>
        <?php endif; ?>
    </div>

    <footer class="bg-dark text-white mt-5 py-4">
        <div class="container text-center">
            <p class="mb-0">
                <i class="bi bi-plugin"></i> <?php echo escape(SITE_NAME); ?> |
                Total Plugins: <?php echo $totalPlugins; ?>
            </p>
            <p class="text-muted small mb-0">
                Made with <i class="bi bi-heart-fill text-danger"></i> for the ChitUI community
            </p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
