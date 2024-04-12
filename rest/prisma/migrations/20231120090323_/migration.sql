-- CreateTable
CREATE TABLE `catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `mockup_img` VARCHAR(191) NOT NULL,
    `print_areas` JSON NOT NULL,
    `variants` JSON NOT NULL,
    `status` BOOLEAN NOT NULL,
    `is_home_page` BOOLEAN NOT NULL,

    UNIQUE INDEX `catalog_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type_id` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL DEFAULT 10,
    `sale_price` DOUBLE NOT NULL DEFAULT 10,
    `sku` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 10,
    `in_stock` BOOLEAN NOT NULL DEFAULT true,
    `is_taxable` BOOLEAN NOT NULL DEFAULT false,
    `shipping_class_id` INTEGER NULL,
    `shop_id` INTEGER NOT NULL DEFAULT 2,
    `status` VARCHAR(191) NOT NULL DEFAULT 'publish',
    `product_type` VARCHAR(191) NOT NULL DEFAULT 'simple',
    `unit` VARCHAR(191) NOT NULL,
    `height` VARCHAR(191) NULL,
    `width` VARCHAR(191) NULL,
    `length` VARCHAR(191) NULL,
    `image` JSON NULL,
    `gallery` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
