const knex = require('knex');

const hostName = 'database-1.czakk208ua30.us-east-2.rds.amazonaws.com'

const dbUser=  process.env.RDS_DB_USER || "admin";
const password = process.env.RDS_DB_PASSWORD || "saikawa123";
const aqDatabase = process.env.RDS_DB_NAME || "Air_Quality";

let singletonDatabase;

async function RDSInstanceConnection() {
    try {
        if (!singletonDatabase) {
            singletonDatabase = knex({
                client: 'mysql2',
                connection: {
                    host: hostName,
                    user: dbUser,
                    password: password,
                    database: aqDatabase,
                    port: 3306,
                    timezone: "+00:00",
                },
                pool: { 
                    min: 0, 
                    max: 5,
                    idleTimeoutMillis: 30000
                },
            });
        }

        return singletonDatabase;

    } catch (err) {
        console.log(err);
        throw err;
    }
}

module.exports = { RDSInstanceConnection }
