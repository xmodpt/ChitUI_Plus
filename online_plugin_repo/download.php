<?php
require_once 'config.php';

// Get plugin ID
$pluginId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if (!$pluginId) {
    die('Invalid plugin ID');
}

// Fetch plugin
$stmt = $pdo->prepare("SELECT * FROM plugins WHERE id = ? AND is_active = 1");
$stmt->execute([$pluginId]);
$plugin = $stmt->fetch();

if (!$plugin || !$plugin['plugin_filename']) {
    die('Plugin not found or file not available');
}

$filePath = PLUGINS_PATH . $plugin['plugin_filename'];

if (!file_exists($filePath)) {
    die('Plugin file not found on server');
}

// Log the download
try {
    $logStmt = $pdo->prepare("
        INSERT INTO download_logs (plugin_id, ip_address, user_agent)
        VALUES (?, ?, ?)
    ");
    $logStmt->execute([
        $pluginId,
        $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ]);

    // Increment download counter
    $updateStmt = $pdo->prepare("UPDATE plugins SET downloads = downloads + 1 WHERE id = ?");
    $updateStmt->execute([$pluginId]);
} catch (PDOException $e) {
    // Log error but continue with download
    error_log("Download logging failed: " . $e->getMessage());
}

// Force download
header('Content-Description: File Transfer');
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . basename($plugin['plugin_filename']) . '"');
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: must-revalidate');
header('Pragma: public');

// Clear output buffer
ob_clean();
flush();

// Read and output file
readfile($filePath);
exit;
