const sql = require('mssql');

// SQL Server qoşulma məlumatları
const config = {
    user: 'sa', // İndi artıq sa istifadəçimiz aktivdir
    password: 'MyCargoSql123', // Az əvvəl SSMS-də qoyduğunuz şifrə
    server: 'HONOR\\SQLEXPRESS',
    database: 'CargoDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('🔌 Microsoft SQL Server-ə uğurla qoşulduq!');
        return pool;
    })
    .catch(err => {
        console.error('❌ Baza bağlantısı qurularkən xəta baş verdi: ', err);
    });

module.exports = {
    sql,
    poolPromise
};