<?php
/**
 * ChitUI Plugin Repository - Configuration File
 *
 * IMPORTANT: Update these settings for your server environment
 */

// Database Configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'chitui_plugins');
define('DB_USER', 'root');  // Change this to your MySQL username
define('DB_PASS', '');      // Change this to your MySQL password

// Site Configuration
define('SITE_NAME', 'ChitUI Plugin Repository');
define('SITE_URL', 'http://localhost/chitui_plugins');  // Change to your domain
define('UPLOAD_PATH', __DIR__ . '/uploads/');
define('PLUGINS_PATH', UPLOAD_PATH . 'plugins/');
define('IMAGES_PATH', UPLOAD_PATH . 'images/');

// File Upload Settings
define('MAX_PLUGIN_SIZE', 50 * 1024 * 1024); // 50MB
define('MAX_IMAGE_SIZE', 5 * 1024 * 1024);   // 5MB
define('ALLOWED_PLUGIN_TYPES', ['zip']);
define('ALLOWED_IMAGE_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'webp']);

// Pagination
define('PLUGINS_PER_PAGE', 12);

// Session Configuration
session_start();

// Database Connection
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

/**
 * Helper function to sanitize output
 */
function escape($string) {
    return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
}

/**
 * Helper function to format file size
 */
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        return number_format($bytes / 1024, 2) . ' KB';
    } else {
        return $bytes . ' bytes';
    }
}

/**
 * Check if user is logged in as admin
 */
function isAdmin() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

/**
 * Require admin login
 */
function requireAdmin() {
    if (!isAdmin()) {
        header('Location: login.php');
        exit;
    }
}
