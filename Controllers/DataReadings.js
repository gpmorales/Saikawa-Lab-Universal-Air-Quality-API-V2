const { RDSInstanceConnection, closeAWSConnection } = require("../Database-Config/RDSInstanceConnection");
const { getDateColumn, formatDateTime, compareSets } = require("../Utility/SensorSchemaUtility.js");
const { Parser } = require("json2csv");
const { pipeline } = require("stream/promises");
const Busboy = require("busboy");
const csv = require("csv-parser");


const MEASUREMENT_TYPES = ["RAW", "CORRECTED"];
const MEASUREMENT_TIME_INTERVALS = ["HOURLY", "DAILY", "OTHER"];


// GET data via date queries (as CSV)
async function exportSensorDataToCSV(request, response) {
    let RDSdatabase;

    // Extract parameters from the request
    const {
        sensor_brand,
        sensor_id,
        measurement_type,
        measurement_model,
        measurement_time_interval,
    } = request.params;

    let { start_date, end_date } = request.query;

    // Format start_date and end_date in this format YYYY-MM-DD HH:MM:SS
    try {
        start_date = formatDateTime(start_date);
        end_date = formatDateTime(start_date);
    } catch (err) {
        return response.status(400).json({ error: "Could not parse input dates: " + err });
    }

    if (!sensor_brand || !sensor_id) {
        return response
            .status(400)
            .json({ error: "Sensor brand and sensor ID are required." });
    }

    if (!MEASUREMENT_TYPES.includes(measurement_type)) {
        console.log(request.params);
        return response.status(400).json({
            error: `Invalid measurement type. Allowed values are: ${MEASUREMENT_TYPES.join(", ")}`
        });
    }

    if (!MEASUREMENT_TIME_INTERVALS.includes(measurement_time_interval)) {
        return response.status(400).json({
            error: `Invalid time interval. Allowed values are: ${MEASUREMENT_TIME_INTERVALS.join(", ")}`
        });
    }

    try {
        // Define the table name
        const AQ_DATA_TABLE = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        // Ensure table exists
        const tableExists = await RDSdatabase.schema.hasTable(AQ_DATA_TABLE);

        if (!tableExists) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not exist. Please ensure the parameters were correctly given.`
            });
        }

        // Get the date column
        const dateColumn = await getDateColumn(RDSdatabase, AQ_DATA_TABLE);

        if (!dateColumn) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not have any data OR is missing a Datetime column.`
            });
        }

        // Fetch all data from the constructed sensor table
        const sensor_data = await RDSdatabase(AQ_DATA_TABLE)
            .select("*")
            .where(dateColumn, ">=", start_date) // Using the dateColumn variable
            .andWhere(dateColumn, "<=", end_date); // Using the dateColumn variable

        await closeAWSConnection(RDSdatabase);

        if (!sensor_data || sensor_data.length === 0) {
            return response
                .status(400)
                .json({ error: "No data found for the specified sensor." });
        }

        // Convert JSON data array to CSV format using json2csv
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(sensor_data);

        response.header("Content-Type", "text/csv");
        response.header("Content-Disposition",`attachment; filename=${AQ_DATA_TABLE}.csv`);
        response.send(csv);

    } catch (err) {
        console.error("Error downloading sensor data: ", err);
        // Ensure the connection is closed in case of an error
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        response.status(500).json({
            error: `Error processing your request: ${err.sqlMessage || err.message}`
        });
    }
}


// POST data via CSV file
async function insertSensorDataFromCSV(request, response) {
    let RDSdatabase;

    const {
        sensor_brand,
        sensor_id,
        measurement_model,
        measurement_type,
        measurement_time_interval,
    } = request.params;

    if (!sensor_brand || !sensor_id) {
        return response
            .status(400)
            .json({ error: "Sensor brand and sensor ID are required." });
    }

    if (!MEASUREMENT_TYPES.includes(measurement_type)) {
        return response.status(400).json({
            error: `Invalid measurement type. Allowed values are: ${MEASUREMENT_TYPES.join(", ")}`
        });
    }

    if (!MEASUREMENT_TIME_INTERVALS.includes(measurement_time_interval)) {
        return response.status(400).json({
            error: `Invalid time interval. Allowed values are: ${MEASUREMENT_TIME_INTERVALS.join(", ")}`
        });
    }

    try {
        const AQ_DATA_TABLE = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        const tableExists = await RDSdatabase.schema.hasTable(AQ_DATA_TABLE);
        if (!tableExists) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not exist. Please ensure the parameters were correctly given.`
            });
        }

        const tableSchemaQuery = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = ? 
        `;

        const tableColumns = await RDSdatabase.raw(tableSchemaQuery, [AQ_DATA_TABLE]);

        const schemaColumns = new Set();
        tableColumns[0].forEach((column) => {
            if (column["COLUMN_NAME"] !== "id") {
                schemaColumns.add(column["COLUMN_NAME"]);
            }
        });

        let dateColumn = await getDateColumn(RDSdatabase, AQ_DATA_TABLE);

        if (!dateColumn) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not have any data OR is missing a datetime column.`
            });
        }

        const sensorData = [];
        const busboy = new Busboy({ headers: request.headers });

        busboy.on("file", (fieldname, file, filename) => {
            console.log(`Receiving file: ${filename}`);
            file
                .pipe(csv())
                .on("data", (row) => {
                    const incomingColumns = new Set(Object.keys(row));
                    if (!compareSets(incomingColumns, schemaColumns)) {
                        console.error("Incoming columns do not match schema.");
                        busboy.emit("error", new Error("Column validation failed."));
                        return;
                    }
                    if (row[dateColumn]) {
                        row[dateColumn] = formatDateTime(row[dateColumn]); 
                    }
                    sensorData.push(row);
                })
                .on("end", () => console.log("File parsing complete."))
                .on("error", (err) => {
                    console.error("Error parsing CSV:", err);
                    busboy.emit("error", err);
                });
        });

        busboy.on("error", (err) => {
            console.error("Busboy encountered an error:", err);
            return response.status(400).json({ error: err.message });
        });

        busboy.on("finish", async () => {
            console.log("Busboy finished processing.");

            if (sensorData.length === 0) {
                console.error("No valid data found in the CSV.");
                await closeAWSConnection(RDSdatabase);
                return response
                    .status(400)
                    .json({ error: "No valid data found in the CSV file." });
            }

            try {
                await RDSdatabase(AQ_DATA_TABLE).insert(sensorData);
                response.status(200).json({ message: "Data inserted successfully." });
            } catch (dbError) {
                console.error("Database insertion error:", dbError);
                response
                    .status(500)
                    .json({ error: "Failed to insert data into the database." });
            } finally {
                await closeAWSConnection(RDSdatabase);
            }
        });

        await pipeline(request, busboy);
    } catch (err) {
        console.error("Error processing sensor data:", err);
        response.status(500).json({ error: "Error processing your request." });
    } finally {
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
    }
}

// GET data via date queries (as JSON)
async function fetchSensorDataReadings(request, response) {
    let RDSdatabase;

    // Extract parameters from the request
    const {
        sensor_brand,
        sensor_id,
        measurement_model,
        measurement_type,
        measurement_time_interval,
    } = request.params;

    let { start_date, end_date } = request.query;

    // Format start_date and end_date in this format YYYY-MM-DD HH:MM:SS
    try {
        start_date = formatDateTime(start_date);
        end_date = formatDateTime(start_date);
    } catch (err) {
        return response.status(400).json({ error: "Could not parse input dates: " + err });
    }

    if (!sensor_brand || !sensor_id) {
        return response
            .status(400)
            .json({ error: "Sensor brand and sensor ID are required." });
    }

    if (!MEASUREMENT_TYPES.includes(measurement_type)) {
        return response.status(400).json({
            error: `Invalid measurement type. Allowed values are: ${MEASUREMENT_TYPES.join(", ")}.`
        });
    }

    if (!MEASUREMENT_TIME_INTERVALS.includes(measurement_time_interval)) {
        return response.status(400).json({
            error: `Invalid time interval. Allowed values are: ${MEASUREMENT_TIME_INTERVALS.join(", ")}.`
        });
    }

    try {
        // Define the table name
        const AQ_DATA_TABLE = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        // Ensure table exists
        const tableExists = await RDSdatabase.schema.hasTable(AQ_DATA_TABLE);

        if (!tableExists) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not exist. Please ensure the parameters were correctly given.`
            });
        }

        // Get the date column
        const dateColumn = await getDateColumn(RDSdatabase, AQ_DATA_TABLE);

        if (!dateColumn) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not have any data OR is missing a datetime column.`
            });
        }

        // Fetch all data from the constructed sensor table
        const all_data = await RDSdatabase(AQ_DATA_TABLE)
            .select("*")
            .where(dateColumn, ">", start_date) 
            .andWhere(dateColumn, "<", end_date);

        await closeAWSConnection(RDSdatabase);

        if (!all_data || all_data.length === 0) {
            return response
                .status(400)
                .json({ error: "No data found for the specified sensor." });
        }

        // Return JSON data array
        return response.status(200).json(all_data);

    } catch (err) {
        console.error("Error fetching sensor data: ", err);
        // Ensure the connection is closed in case of an error
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: "Error processing your request." });
    }
}


// POST data via JSON object
async function insertSensorDataReadings(request, response) {
    let RDSdatabase;

    // Extract parameters from the request
    const {
        sensor_brand,
        sensor_id,
        measurement_model,
        measurement_type,
        measurement_time_interval,
    } = request.params;

    const requestPayload = await request.body;

    // Validate required parameters
    if (!sensor_brand || !sensor_id) {
        return response
            .status(400)
            .json({ error: "Sensor brand and sensor ID are required." });
    }

    if (!MEASUREMENT_TYPES.includes(measurement_type)) {
        return response.status(400).json({
            error: `Invalid measurement type. Allowed values are: ${MEASUREMENT_TYPES.join(", ")}.`
        });
    }

    if (!MEASUREMENT_TIME_INTERVALS.includes(measurement_time_interval)) {
        return response.status(400).json({
            error: `Invalid time interval. Allowed values are: ${MEASUREMENT_TIME_INTERVALS.join(", ")}.`
        });
    }

    try {
        // Define the table name
        const AQ_DATA_TABLE = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        // Ensure table exists
        const tableExists = await RDSdatabase.schema.hasTable(AQ_DATA_TABLE);

        if (!tableExists) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not exist. Please ensure the parameters were correctly given.`
            });
        }

        // Fetch the schema for the specified table
        const tableSchemaQuery = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = ? 
        `;

        const tableColumns = await RDSdatabase.raw(tableSchemaQuery, [
            AQ_DATA_TABLE,
        ]);

        // Extract incoming column names from the request payload
        const incomingColumns = new Set(Object.keys(requestPayload[0]));

        // Compare incoming columns with table columns
        const schemaColumns = new Set();

        for (let i = 0; i < tableColumns[0].length; i++) {
            let columnPair = tableColumns[0][i];
            if (columnPair["COLUMN_NAME"] != "id") {
                schemaColumns.add(columnPair["COLUMN_NAME"]);
            }
        }

        // Get the date column
        const dateColumn = await getDateColumn(RDSdatabase, AQ_DATA_TABLE);

        if (!compareSets(incomingColumns, schemaColumns)) {
            return response.status(400).json({
                error: "Error processing your data. Column names or data types do not match table schema."
            });
        }

        // Ensure entire Date column has proper formatting
        for (let i = 0; i < requestPayload.length; i++) {
            const row = requestPayload[i];
            if (row[dateColumn]) {
                (requestPayload[i])[dateColumn] = formatDateTime(row[dateColumn]);
            }
        }

        // Insert data to Table
        const insertResult = await RDSdatabase(AQ_DATA_TABLE).insert(requestPayload);
        await closeAWSConnection(RDSdatabase);

        if (insertResult > 0) {
            return response.status(201).json({
                message: `Successfully inserted ${requestPayload.length} rows`
            });
        } else {
            return response.status(500).json({
                error: "Failed to insert air quality data into database."
            });
        }
    } catch (err) {
        console.error("Error processing sensor data: ", err);
        // Ensure the connection is closed
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response
            .status(500)
            .json({ error: "Error processing your request." });
    }
}


// GET last row of a table
async function getLastDataReading(request, response) {
    let RDSdatabase;

    // Extract parameters from the request
    const {
        sensor_brand,
        sensor_id,
        measurement_model,
        measurement_type,
        measurement_time_interval,
    } = request.params;

    if (!sensor_brand || !sensor_id) {
        return response
            .status(400)
            .json({ error: "Sensor brand and sensor ID are required." });
    }

    if (!MEASUREMENT_TYPES.includes(measurement_type)) {
        return response.status(400).json({
            error: `Invalid measurement type. Allowed values are: ${MEASUREMENT_TYPES.join(", ")}.`
        });
    }

    if (!MEASUREMENT_TIME_INTERVALS.includes(measurement_time_interval)) {
        return response.status(400).json({
            error: `Invalid time interval. Allowed values are: ${MEASUREMENT_TIME_INTERVALS.join(", ")}.`
        });
    }

    try {
        // Define the table name
        const AQ_DATA_TABLE = `${sensor_brand}_${sensor_id}_${measurement_model || "NIL-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        // Ensure table exists
        const tableExists = await RDSdatabase.schema.hasTable(AQ_DATA_TABLE);

        if (!tableExists) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not exist. Please ensure the parameters were correctly given.`
            });
        }

        // Get the date column
        const dateColumn = await getDateColumn(RDSdatabase, AQ_DATA_TABLE);

        if (!dateColumn) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({
                error: `Table '${AQ_DATA_TABLE}' does not have any data OR is missing a datetime column.`
            });
        }

        // Fetch all data from the constructed sensor table
        const last_row = await RDSdatabase(AQ_DATA_TABLE)
            .select("*")
            .orderBy(dateColumn, "desc")
            .limit(1);

        if (!last_row || last_row.length === 0) {
            return response
                .status(400)
                .json({ error: "No data found for the specified sensor." });
        }

        await closeAWSConnection(RDSdatabase);
        response.status(200).json(last_row);

    } catch (err) {
        console.error("Error fetching last row of sensor data readings: ", err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        response.status(500).json({ error: "Error processing your request." });
    }
}


module.exports = {
  exportSensorDataToCSV,
  insertSensorDataFromCSV,
  fetchSensorDataReadings,
  insertSensorDataReadings,
  getLastDataReading,
};
