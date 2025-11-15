-- Migration to add multiple images support
-- Run this after initial schema.sql

USE chitui_plugins;

-- Create plugin_images table
CREATE TABLE IF NOT EXISTS plugin_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plugin_id INT NOT NULL,
    image_filename VARCHAR(255) NOT NULL,
    image_order TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
    INDEX idx_plugin (plugin_id),
    INDEX idx_order (image_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing single images to new table
INSERT INTO plugin_images (plugin_id, image_filename, image_order)
SELECT id, image_filename, 1
FROM plugins
WHERE image_filename IS NOT NULL AND image_filename != '';

-- Note: We'll keep image_filename column in plugins for backward compatibility
-- It will now store the primary/first image filename
