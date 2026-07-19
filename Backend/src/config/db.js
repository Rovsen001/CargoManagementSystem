const sql = require('mssql');

// SQL Server qoşulma məlumatları
const config = {
    user: 'sa',
    password: 'MyCargoSql123',
    server: '127.0.0.1', // Həmişə lokal İP ünvanını yazmaq daha etibarlıdır
    database: 'CargoDB',
    options: {
        instanceName: 'SQLEXPRESS', // 👈 BU HİSSƏ ÇOX VACİBDİR!
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