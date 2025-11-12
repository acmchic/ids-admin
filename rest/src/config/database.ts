import mysql from 'mysql2/promise';

console.log(`📡 Đang kết nối MySQL tại ${process.env.DB_HOST}:${process.env.DB_PORT}`);

// Create MySQL connection pool
export const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ids',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
db.getConnection()
    .then(connection => {
        console.log('✅ MySQL connected successfully');
        connection.release();
    })
    .catch(error => {
        console.error('❌ MySQL connection failed:', error.message);
    });


