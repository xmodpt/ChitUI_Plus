-- Fix admin password to "admin123"
-- Run this if you can't login with admin/admin123

USE chitui_plugins;

-- Update the admin password hash to the correct value for "admin123"
UPDATE admin_users
SET password_hash = '$2y$12$oaFl6QSSd2zww85TeMf.4ekv2qxfdGTUr9bFDPrI6ozBmcYwDVXjK'
WHERE username = 'admin';

-- Verify the update
SELECT username, email, created_at FROM admin_users WHERE username = 'admin';
