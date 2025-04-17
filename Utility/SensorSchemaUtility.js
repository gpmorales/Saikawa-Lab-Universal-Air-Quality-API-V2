/* UTILITY FUNCTIONS */

async function createSensorMeasurementTable(database, tableName, schema) {
    try {
        const tableExists = await database.schema.hasTable(tableName);

        if (tableExists) {
            return { success: false, message: `Table ${tableName} already exists.` };
        }

        // Check for date/datetime columns
        const dateColumns = Object.entries(schema).filter(
            ([_, dataType]) => dataType.toLowerCase() === "date" || dataType.toLowerCase() === "datetime"
        );

        if (dateColumns.length !== 1) {
            throw new Error(
                `Table must contain exactly one date or datetime column, found ${dateColumns.length}.`
            );
        }

        const [dateColumnName, dateType] = dateColumns[0]; // Get the name of the date column

        // Create the table
        await database.schema.createTable(tableName, (table) => {
            table.increments("id").primary();
            for (const [columnName, dataType] of Object.entries(schema)) {
                switch (dataType.toLowerCase()) {
                    case "string":
                        table.string(columnName);
                        break;
                    case "number":
                    case "float":
                        table.float(columnName);
                        break;
                    case "integer":
                        table.integer(columnName);
                        break;
                    case "date":
                        table.date(columnName);
                        table.unique([columnName], `uq_${columnName}`);
                        break;
                    case "datetime":
                        table.datetime(columnName);
                        table.unique([columnName], `uq_${columnName}`);
                        break;
                    default:
                        table.text(columnName);
                }
            }
            // Create an index on the date column for ordering
            table.index(dateColumnName); // Index for efficient ordering -> AUTO for primary key
        });

        return {
            success: true,
            message: `Sensor Measurement Table ${tableName} created successfully.`,
        };
    } catch (error) {
        console.error(`Error creating table ${tableName}:`, error);
        throw error; // Optionally, rethrow the error or handle it as needed
    }
}


function createPayload(request) {
    return {
        sensor_brand: request.params.sensor_brand,
        sensor_id: request.params.sensor_id,
        sensor_data_schema: request.body.sensor_data_schema,
        measurement_model: request.params.measurement_model,
        measurement_type: request.params.measurement_type,
        measurement_time_interval: request.params.measurement_time_interval,
    };
}


async function getDateColumn(RDSdatabase, aq_table) {
    const dateColumnsQuery = `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ? 
        AND (DATA_TYPE = 'date' OR DATA_TYPE = 'datetime')
    `;

    // Fetching date columns
    const columns = await RDSdatabase.raw(dateColumnsQuery, [aq_table]);
    const dateColumns = columns[0];

    // Assert that there is exactly one date column
    if (!dateColumns || dateColumns.length !== 1) {
        return undefined;
    }

    return dateColumns[0].COLUMN_NAME; // Return the column name
}


function formatDateTime(inputDate) {
    try {
        // Handle both string input and Date objects
        const date = inputDate instanceof Date ? inputDate : new Date(inputDate);

        // Validate if the date is valid
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
        }

        // Format date components
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        // Return formatted datetime string --> YYYY-MM-DD HH:MM:SS
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error(`Error formatting date: ${error.message}`);
        throw error;
    }
}


// Helper function to compare two sets
function compareSets(setA, setB) {
    return setA.size === setB.size && [...setA].every(x => setB.has(x));
}


module.exports = {
    createSensorMeasurementTable,
    createPayload,
    getDateColumn,
    compareSets,
    formatDateTime
};
