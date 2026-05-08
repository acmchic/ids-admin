import mysql from 'mysql2/promise';

const parseDatabaseUrl = () => {
    if (!process.env.DATABASE_URL) return {};

    try {
        const url = new URL(process.env.DATABASE_URL);
        return {
            host: url.hostname,
            port: url.port ? Number(url.port) : undefined,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace(/^\//, ''),
        };
    } catch (error) {
        console.warn('⚠️ DATABASE_URL không hợp lệ:', error instanceof Error ? error.message : error);
        return {};
    }
};

const databaseUrlConfig = parseDatabaseUrl();
const dbHost = process.env.DB_HOST || databaseUrlConfig.host || 'localhost';
const dbPort = Number(process.env.DB_PORT || databaseUrlConfig.port || 3306);
const dbUser = process.env.DB_USER || process.env.DB_USERNAME || databaseUrlConfig.user || 'root';
const dbPassword = process.env.DB_PASSWORD ?? databaseUrlConfig.password ?? '';
const dbName = process.env.DB_NAME || process.env.DB_DATABASE || databaseUrlConfig.database || 'ids';

console.log(`📡 Đang kết nối MySQL tại ${dbHost}:${dbPort}`);

// Create MySQL connection pool
export const db = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
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




