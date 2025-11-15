<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnostic Page</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
</head>
<body>
    <div class="container mt-5">
        <h1><i class="bi bi-check-circle text-success"></i> Diagnostic Page</h1>

        <div class="alert alert-info">
            <strong>If you can see this page styled properly, Bootstrap is loading correctly.</strong>
        </div>

        <h2>PHP Information</h2>
        <table class="table table-bordered">
            <tr>
                <td>PHP Version</td>
                <td><?php echo phpversion(); ?></td>
            </tr>
            <tr>
                <td>Server Software</td>
                <td><?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'; ?></td>
            </tr>
            <tr>
                <td>Document Root</td>
                <td><?php echo $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown'; ?></td>
            </tr>
        </table>

        <h2>Required Extensions</h2>
        <table class="table table-bordered">
            <tr>
                <td>PDO</td>
                <td>
                    <?php if (extension_loaded('pdo')): ?>
                        <span class="badge bg-success">Loaded</span>
                    <?php else: ?>
                        <span class="badge bg-danger">Missing</span>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <td>PDO MySQL</td>
                <td>
                    <?php if (extension_loaded('pdo_mysql')): ?>
                        <span class="badge bg-success">Loaded</span>
                    <?php else: ?>
                        <span class="badge bg-danger">Missing</span>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <td>GD</td>
                <td>
                    <?php if (extension_loaded('gd')): ?>
                        <span class="badge bg-success">Loaded</span>
                    <?php else: ?>
                        <span class="badge bg-warning">Optional</span>
                    <?php endif; ?>
                </td>
            </tr>
        </table>

        <h2>Directory Permissions</h2>
        <table class="table table-bordered">
            <tr>
                <td>uploads/</td>
                <td>
                    <?php
                    $uploadsDir = __DIR__ . '/uploads';
                    if (is_writable($uploadsDir)) {
                        echo '<span class="badge bg-success">Writable</span>';
                    } else {
                        echo '<span class="badge bg-danger">Not Writable</span>';
                    }
                    ?>
                </td>
            </tr>
            <tr>
                <td>uploads/plugins/</td>
                <td>
                    <?php
                    $pluginsDir = __DIR__ . '/uploads/plugins';
                    if (is_writable($pluginsDir)) {
                        echo '<span class="badge bg-success">Writable</span>';
                    } else {
                        echo '<span class="badge bg-danger">Not Writable</span>';
                    }
                    ?>
                </td>
            </tr>
            <tr>
                <td>uploads/images/</td>
                <td>
                    <?php
                    $imagesDir = __DIR__ . '/uploads/images';
                    if (is_writable($imagesDir)) {
                        echo '<span class="badge bg-success">Writable</span>';
                    } else {
                        echo '<span class="badge bg-danger">Not Writable</span>';
                    }
                    ?>
                </td>
            </tr>
        </table>

        <h2>Database Connection Test</h2>
        <?php
        try {
            require_once 'config.php';
            echo '<div class="alert alert-success">';
            echo '<i class="bi bi-check-circle"></i> Database connection successful!';
            echo '</div>';

            // Test query
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM plugins");
            $result = $stmt->fetch();
            echo '<p>Plugins in database: ' . $result['count'] . '</p>';

        } catch (Exception $e) {
            echo '<div class="alert alert-danger">';
            echo '<i class="bi bi-x-circle"></i> Database connection failed: ' . htmlspecialchars($e->getMessage());
            echo '</div>';
        }
        ?>

        <h2>JavaScript Test</h2>
        <button id="testButton" class="btn btn-primary">Click Me to Test JavaScript</button>
        <div id="jsResult" class="mt-2"></div>

        <script>
            document.getElementById('testButton').addEventListener('click', function() {
                document.getElementById('jsResult').innerHTML = '<div class="alert alert-success">JavaScript is working!</div>';
            });

            // Test Bootstrap JavaScript
            console.log('Bootstrap version:', window.bootstrap ? 'Loaded' : 'Not loaded');
        </script>

        <hr>
        <p><a href="index.php" class="btn btn-secondary">Back to Home</a></p>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
