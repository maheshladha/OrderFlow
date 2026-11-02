const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

const config = {
  server: process.env.SQL_SERVER || 'MAHESH-RANCE\\SQL2019',
  database: process.env.SQL_DATABASE || 'NEWDEMO',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: process.env.SQL_TRUSTED_CONNECTION !== 'false',
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 60000
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

module.exports = { sql, getPool, config };
