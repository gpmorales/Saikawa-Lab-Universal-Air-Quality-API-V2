const { createSensorMeasurementTable, createPayload } = require("../Utility/SensorSchemaUtility.js")
const { RDSInstanceConnection, closeAWSConnection } = require("../Database-Config/RDSInstanceConnection");
const { Parser } = require("json2csv");
const Joi = require("joi");


// GLOBAL VARS, ENUMS, & SCHEMAS
const AQ_DATABASE = process.env.RDS_DB_NAME || "Air_Quality";
const SENSOR_TABLE = process.env.SENSOR_TABLE || "SENSORS";
const SENSOR_MODELS_TABLE = process.env.SENSOR_MODELS_TABLE || "SENSOR_MODELS";
const MEASUREMENT_TYPES = ["RAW", "CORRECTED"] 
const MEASUREMENT_TIME_INTERVALS = ["HOURLY", "DAILY", "OTHER"];

const sensorMeasurementSchema = Joi.object({
    sensor_id: Joi.string().required(),
    sensor_brand: Joi.string().required(),
    sensor_data_schema: Joi.object().required(),
    measurement_model: Joi.string(),
    measurement_type: Joi.string().required().valid(...MEASUREMENT_TYPES),
    measurement_time_interval: Joi.string().required().valid(...MEASUREMENT_TIME_INTERVALS),
});


// Get all Sensor Models
async function getAllSensorModels(request, response) {
    let RDSdatabase;

    try {
        RDSdatabase = await RDSInstanceConnection();
        const all_sensor_models = await RDSdatabase(SENSOR_MODELS_TABLE).select("*")
        await closeAWSConnection(RDSdatabase);

        return response.status(200).json({
            data: all_sensor_models,
            message: all_sensor_models.length ? "Successfully returned all Sensor Models." : "No Sensor Models have been registered at this moment."
        });
    } catch (err) {
        console.error('Error fetching sensor models:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `An error occurred while fetching Sensor Models: ${err.sqlMessage || err.message}` });
    }
}


// Add a sensor model (via swagger or programmatically) assuming the sensor is already present in Sensor Table
async function addSensorModel(request, response) {
    let RDSdatabase;
    let sncr_brand;
    let sncr_id;

    try {
        RDSdatabase = await RDSInstanceConnection();

        const payload = createPayload(request);
        const { error, value } = sensorMeasurementSchema.validate(payload, { abortEarly: false });

        if (error) {
            return response.status(400).json(
                { error: "Request parameters incorrect: " + error.details.map(detail => detail.message) }
            );
        }

        // Deconstruct the validated payload
        const { 
            sensor_id,
            sensor_brand,
            sensor_data_schema,
            measurement_model,
            measurement_type,
            measurement_time_interval,
        } = value;

        // For http response
        sncr_id = sensor_id;
        sncr_brand = sensor_brand;

        const sensor_table_name = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        // First, insert this row into SENSOR_MODEL_TABLE table
        const [insertedId] = await RDSdatabase(SENSOR_MODELS_TABLE).insert({
            sensor_id,
            sensor_brand,
            sensor_table_name,
            sensor_data_schema: JSON.stringify(sensor_data_schema),
            measurement_model,
            measurement_type,
            measurement_time_interval,
        });

        // Then try and create corresponding model measurement table
        const tableCreationResult = await createSensorMeasurementTable(RDSdatabase, sensor_table_name, sensor_data_schema);

        await closeAWSConnection(RDSdatabase);

        if (!tableCreationResult.success) {
            return response.status(400).json({ error: tableCreationResult.message });
        } 

        if (insertedId) {
            return response.status(201).json({
                message: `Sensor Model successfully added with row ID ${insertedId} and corresponding Measurement table '${sensor_table_name}' has been created. You can now upload data.`
            });
        }

    } catch (err) {
        console.error('Error adding Sensor Model:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }

        if (err.code === "ER_NO_REFERENCED_ROW_2") {
            return response.status(500).json({ error: `The Sensor associated with this model has NOT been registered yet. Register a sensor of brand '${sncr_brand}' and serial number '${sncr_id}' first using the POST '/api/v2/sensors/{sensor_brand}/{sensor_id}' endpoint`});
        } else {
            return response.status(500).json({ error: `An error occurred while adding the sensor: ${err.sqlMessage || err.message}` });
        }
    }
}


// Get the Schema of a particular table
async function getSensorModelDataSchema(request, response) {
    let RDSdatabase;

    // Extract parameters from the request
    const { 
        sensor_brand,
        sensor_id, 
        measurement_model,
        measurement_type,
        measurement_time_interval
    } = request.params;

    if (!sensor_brand || !sensor_id) {
        return response.status(400).json({ error: 'Sensor brand and sensor ID are required.' });
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
        const sensor_table_name = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        const columns = await RDSdatabase
            .select('COLUMN_NAME', 'DATA_TYPE')
            .from('information_schema.COLUMNS')
            .where('TABLE_SCHEMA', AQ_DATABASE)
            .andWhere('TABLE_NAME', sensor_table_name);

        await closeAWSConnection(RDSdatabase);

        const tableSchema = columns.reduce((schema, column) => {
            schema[column.COLUMN_NAME] = column.DATA_TYPE;
            return schema;
        }, {});

        if (Object.keys(tableSchema).length === 0) {
            return response.status(500).json({ error: `The Sensor associated with this model has NOT been registered yet. Register a sensor of brand '${sensor_brand}' and serial number '${sensor_id}' first using the POST '/api/v2/sensors{sensor_brand}/{sensor_id}' endpoint`});
        }

        return response.status(200).json(tableSchema);

    } catch (err) {
        console.error('Error fetching Sensor Model`s Schema:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `An error occurred while fetching this Model's schema: ${err.sqlMessage || err.message}` });
    }
}


// Get the Measurement Tables + All Models of a particular Sensor
async function getSensorModels(request, response) {
    let RDSdatabase;

    const { sensor_brand, sensor_id } = request.params;

    // If either parameter is missing or empty, return a 400 response
    if (!sensor_brand || sensor_brand === "" || !sensor_id || sensor_id === "") {
        return response.status(400).json({ error: 'sensor_brand and sensor_id are required parameters.' });
    }

    try {
        RDSdatabase = await RDSInstanceConnection();

        const sensor_models = await RDSdatabase(SENSOR_MODELS_TABLE)
            .select("*")
            .where("sensor_brand", sensor_brand)
            .andWhere("sensor_id", sensor_id);

        await closeAWSConnection(RDSdatabase);

        if (sensor_models.length === 0) {
            return response.status(404).json({ error: "No Models associated with this Sensor Brand and ID have been created yet."});
        }

        return response.status(200).json(sensor_models);

    } catch (err) {
        console.error('Error fetching sensors:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `Error processing your request. ${err.sqlMessage}` });
    }
}


async function downloadSensorModelReadings(request, response) {
    let RDSdatabase;

    try {
        // Extract parameters from the request
        const { 
            sensor_brand,
            sensor_id, 
            measurement_model,
            measurement_type,
            measurement_time_interval
        } = request.params;

        if (!sensor_brand || !sensor_id) {
            return response.status(400).json({ error: 'Sensor brand and sensor ID are required.' });
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

        // Define the table name
        const sensor_table = `${sensor_brand}_${sensor_id}_${measurement_model || "RAW-MODEL"}_${measurement_type}_${measurement_time_interval}`;

        RDSdatabase = await RDSInstanceConnection();

        // Fetch all data from the constructed sensor table
        const sensor_data = await RDSdatabase(sensor_table).select("*");

        // Check if data exists
        if (!sensor_data || sensor_data.length === 0) {
            return response.status(400).json({ error: 'No data has been logged under the specified Sensor Model.' });
        }

        await closeAWSConnection(RDSdatabase);

        // Convert JSON data array to CSV format using json2csv
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(sensor_data);

        response.header('Content-Type', 'text/csv');
        response.header('Content-Disposition', `attachment; filename=${sensor_table}.csv`);
        response.send(csv);

    } catch (err) {
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `Error processing your request: ${err.sqlMessage}` });
    }
}


module.exports = {
    getAllSensorModels,
    addSensorModel,
    getSensorModels,
    getSensorModelDataSchema,
    downloadSensorModelReadings,
};
