const knex = require('knex');

const hostName = 'database-1.czakk208ua30.us-east-2.rds.amazonaws.com'

const dbUser=  process.env.RDS_DB_USER || "admin";
const password = process.env.RDS_DB_PASSWORD || "saikawa123";
const aqDatabase = process.env.RDS_DB_NAME || "Air_Quality";

async function RDSInstanceConnection() {
    try {
        console.log("Attempting to connect to AWS RDS MySQL instance at host " + hostName + "\n");

        return knex({
            client: 'mysql2',
            connection: {
                host: hostName,
                user: dbUser,
                password: password,
                database: aqDatabase,
                port: 3306,
                timezone: "+00:00",
            },
        });

    } catch (err) {
        console.log(err);
        throw err;
    }
}

async function closeAWSConnection(database) {
    await database.destroy();
}

module.exports = { RDSInstanceConnection, closeAWSConnection }
