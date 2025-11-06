# Database Setup Guide

## Cấu hình Database

Thêm các biến sau vào file `.env` trong thư mục `admin/rest/`:

```env
# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=ids_ac
DB_PASSWORD=Chila88@
DB_NAME=ids

# Legacy DATABASE_URL (vẫn cần cho Prisma nếu dùng)
DATABASE_URL="mysql://ids_ac:Chila88@@db:3306/ids"
```

## Lưu ý

- **DB_HOST**: Dùng `localhost` khi chạy từ Windows
- **DB_PASSWORD**: Password có thể chứa ký tự đặc biệt như `@`
- File `src/config/database.ts` sẽ tự động kết nối khi server khởi động

## Test Connection

Khi chạy `npm run dev`, terminal sẽ hiển thị:

```
📡 Đang kết nối MySQL tại localhost:3306
✅ MySQL connected successfully
```

Nếu lỗi, kiểm tra:
1. MySQL service đang chạy
2. Username/password đúng
3. Database `ids` đã tồn tại
4. Port 3306 không bị block

## Migration

Tạo bảng `issues`:

```sql
-- Chạy file migration
mysql -u ids_ac -p ids < prisma/migrations/20241106_create_issues/migration.sql
```

Hoặc xem nội dung SQL trong file migration để chạy thủ công.

