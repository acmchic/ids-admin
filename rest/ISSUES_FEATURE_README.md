# Issues Management Feature

## Tổng quan

Chức năng quản lý issues cho orders đã được thêm vào hệ thống. Feature này cho phép tạo và quản lý các vấn đề liên quan đến orders như thay đổi địa chỉ giao hàng, thay đổi variation sản phẩm, hoặc replace orders.

## Cài đặt

### 1. Chạy Migration để tạo bảng `issues`

**QUAN TRỌNG:** Bảng `issues` cần được tạo trong database trước khi sử dụng feature.

```bash
cd admin/rest

# Chạy migration SQL trực tiếp
# Kết nối vào MySQL và chạy file:
mysql -u your_username -p your_database < prisma/migrations/20241106_create_issues/migration.sql

# HOẶC sử dụng Prisma
npx prisma migrate dev --name create_issues

# Sau đó generate Prisma Client
npx prisma generate
```

### 2. Khởi động lại server

```bash
npm run dev
```

## Cấu trúc bảng `issues`

```sql
CREATE TABLE `issues` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `issue_type` ENUM('change_shipping_address', 'change_variation', 'replace'),
  `status` ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  `old_data` JSON NULL,
  `new_data` JSON NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(191) NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
);
```

## Các API Endpoints đã tạo

### 1. Create Issue
- **Path:** `/api/issues/create`
- **Method:** POST
- **Body:**
```json
{
  "order_id": "123",
  "issue_type": "change_shipping_address",
  "old_data": {...},
  "new_data": {...},
  "notes": "Optional notes",
  "created_by": "admin"
}
```

### 2. Update Issue Status
- **Path:** `/api/issues/update-status`
- **Method:** PUT
- **Body:**
```json
{
  "issue_id": "1",
  "status": "resolved",
  "notes": "Issue resolved"
}
```

### 3. Update Shipping Address
- **Path:** `/api/orders/update-shipping-address`
- **Method:** PUT
- **Body:**
```json
{
  "order_id": "123",
  "shipping_address": {
    "shipping_name": "John Doe",
    "shipping_email": "john@example.com",
    "shipping_address1": "123 Main St",
    "shipping_address2": "Apt 4",
    "shipping_city": "New York",
    "shipping_zipcode": "10001",
    "shipping_phone": "+1234567890",
    "shipping_province_code": "NY"
  }
}
```

### 4. Update Product Variation
- **Path:** `/api/orders/update-variation`
- **Method:** PUT
- **Body:**
```json
{
  "order_product_id": "456",
  "variation": {
    "name": "Premium T-Shirt",
    "size": "L",
    "color": "Blue",
    "price": 32,
    "extra_price": "0",
    "side": "Front"
  }
}
```

### 5. Update Email Sent Status
- **Path:** `/api/orders/update-email-sent`
- **Method:** PUT
- **Body:**
```json
{
  "order_id": "123",
  "email_send": 0
}
```

### 6. Get Order Details
- **Path:** `/api/orders/get-order-details?order_id=123`
- **Method:** GET

## Cách sử dụng trong UI

### 1. Mở Modal Create Issue

Trong trang Orders (`/orders`), mỗi row sẽ có button **📋** (màu tím) trong cột "Fulfill".

Click vào button này để mở modal tạo issue.

### 2. Các loại Issue

#### A. Change Shipping Address
1. Chọn "Change Shipping Address" từ dropdown
2. Form sẽ tự động load địa chỉ hiện tại
3. Chỉnh sửa các trường cần thiết (Name, Address, City, Zipcode, etc.)
4. Click "Create & Resolve Issue"

#### B. Change Size/Color/Side (Variation)
1. Chọn "Change Size/Color/Side" từ dropdown
2. Chọn product cần thay đổi từ dropdown
3. Form sẽ hiện variation hiện tại
4. Chỉnh sửa Size, Color, Side, Price
5. Click "Create & Resolve Issue"

#### C. Replace
1. Chọn "Replace" từ dropdown
2. Chọn phương thức fulfill: **Merchize**, **Mango**, **Burger**, hoặc **Fulfil**
3. Click "Create & Resolve Issue"
4. System sẽ:
   - Update order status theo phương thức đã chọn
   - Set `email_send = 0` để trigger email lại
   - Tạo issue record để tracking

### 3. Notes (Optional)
Với tất cả các loại issue, bạn có thể thêm notes để ghi chú thêm thông tin.

## Components đã tạo

1. **CreateIssueModal** (`admin/rest/src/components/order/create-issue-modal.tsx`)
   - Modal component với form động tùy theo issue type
   - Tự động load order details và pre-fill data
   - Validation và error handling
   - Toast notifications

2. **Modified OrderList** (`admin/rest/src/components/order/order-list.tsx`)
   - Thêm button Create Issue (📋)
   - State management cho modal
   - Integration với CreateIssueModal

## Lưu ý quan trọng

1. **BigInt Serialization:** Các API đã xử lý BigInt từ Prisma thành String để tránh lỗi JSON serialization.

2. **Cascade Delete:** Issues sẽ tự động bị xóa khi order bị xóa (CASCADE).

3. **Email Send:** Khi replace order, `email_send` được set về 0 để system có thể gửi email tracking mới.

4. **Old/New Data:** Tất cả thay đổi được lưu vào `old_data` và `new_data` dưới dạng JSON để audit trail.

## Troubleshooting

### Migration failed
```bash
# Nếu migration bị lỗi, có thể chạy trực tiếp SQL:
mysql -u root -p your_database

# Sau đó paste nội dung từ file migration.sql
```

### Prisma Client outdated
```bash
npx prisma generate
```

### API returns 500
- Check console logs trong terminal dev server
- Verify database connection trong `.env` hoặc `DATABASE_URL`
- Ensure bảng `issues` đã được tạo

## Future Enhancements

Có thể mở rộng:
- Thêm trang Issues Dashboard để xem tất cả issues
- Filter issues theo status, type
- Assign issues cho staff
- Comment/History timeline cho issues
- Email notifications khi tạo issue

## Files đã tạo/sửa

**Mới tạo:**
- `admin/rest/prisma/migrations/20241106_create_issues/migration.sql`
- `admin/rest/src/pages/api/issues/create.ts`
- `admin/rest/src/pages/api/issues/update-status.ts`
- `admin/rest/src/pages/api/orders/update-shipping-address.ts`
- `admin/rest/src/pages/api/orders/update-variation.ts`
- `admin/rest/src/pages/api/orders/update-email-sent.ts`
- `admin/rest/src/pages/api/orders/get-order-details.ts`
- `admin/rest/src/components/order/create-issue-modal.tsx`

**Đã sửa:**
- `admin/rest/prisma/schema.prisma` (thêm model issues)
- `admin/rest/src/components/order/order-list.tsx` (thêm button và modal)


