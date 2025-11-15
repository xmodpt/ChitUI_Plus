<?php
require_once 'config.php';
requireAdmin();

echo "<!DOCTYPE html>";
echo "<html><head><title>Admin Test</title></head><body>";
echo "<h1>Admin Test Page</h1>";
echo "<p>If you see this, authentication is working!</p>";
echo "<p>Session info:</p>";
echo "<pre>";
print_r($_SESSION);
echo "</pre>";
echo "<p><a href='admin.php'>Back to Admin</a></p>";
echo "</body></html>";
?>
