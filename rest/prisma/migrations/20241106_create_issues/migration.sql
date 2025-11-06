-- CreateTable
CREATE TABLE `issues` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `issue_type` ENUM('change_shipping_address', 'change_variation', 'replace') NOT NULL,
  `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  `old_data` JSON NULL,
  `new_data` JSON NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(191) NULL,
  `resolved_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NULL,
  `updated_at` TIMESTAMP(0) NULL,
  PRIMARY KEY (`id`),
  INDEX `issues_order_id_foreign` (`order_id`),
  INDEX `issues_status_index` (`status`),
  INDEX `issues_issue_type_index` (`issue_type`),
  CONSTRAINT `issues_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

