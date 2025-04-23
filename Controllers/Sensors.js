const { RDSInstanceConnection, closeAWSConnection } = require("../Database/RDSInstanceConnection");
const Joi = require("joi");


// GLOBAL VARS, ENUMS, & SCHEMAS
const SENSOR_TABLE = process.env.SENSOR_TABLE || "SENSORS";

const sensorUploadSchema = Joi.object({
    sensor_id: Joi.string().required(),
    sensor_brand: Joi.string().required(),
    sensor_latitude: Joi.number().min(-90).max(90).required(),
    sensor_longitude: Joi.number().min(-180).max(180).required(),
});


// Get all Sensors and their information
async function getAllSensors(request, response) {
    let RDSdatabase;

    try {
        RDSdatabase = await RDSInstanceConnection();
        const sensors = await RDSdatabase(SENSOR_TABLE).select("*")
        await closeAWSConnection(RDSdatabase);

        return response.status(200).json({
            data: sensors,
            message: sensors.length ? "Successfully returned all registered Sensors.": "No Sensors have been registered at this moment."
        });

    } catch (err) {
        console.error('Error fetching sensors:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `An error occurred while fetching sensors: ${err.sqlMessage}` });
    }
}


// Add a sensor 
async function addNewSensor(request, response) {
    let RDSdatabase;
    let given_sensor_id;
    let given_sensor_brand;

    try {
        RDSdatabase = await RDSInstanceConnection();

        const payload = {
            sensor_brand: request.params.sensor_brand,
            sensor_id: request.params.sensor_id,
            sensor_latitude: parseFloat(request.query.sensor_latitude),
            sensor_longitude: parseFloat(request.query.sensor_longitude)
        };

        const { error, value } = sensorUploadSchema.validate(payload, { abortEarly: false });

        if (error) {
            return response.status(400).json({ error: error.details.map(detail => detail.message) });
        }

        // Deconstruct the validated payload
        const { 
            sensor_id,
            sensor_brand,
            sensor_latitude,
            sensor_longitude,
        } = value;

        given_sensor_id = sensor_id
        given_sensor_brand = sensor_brand; 

        // Define additional fields for insertion
        const date_uploaded = RDSdatabase.fn.now();
        const last_location_update = RDSdatabase.fn.now(); 
        const is_active = true;

        // Insert the new sensor into the SENSORS table
        await RDSdatabase(SENSOR_TABLE).insert({
            sensor_id,
            sensor_brand,
            sensor_latitude,
            sensor_longitude,
            last_location_update,
            is_active,
            date_uploaded,
        });

        await closeAWSConnection(RDSdatabase);

        // Respond with success
        return response.status(201).json({ message: "Sensor successfully added to the SENSORS table." });

    } catch (err) {
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        console.error('Error adding sensor:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return response.status(400).json({ error: `Error: A sensor with ID '${given_sensor_id}' and brand '${given_sensor_brand}' already exists.`});
        }
        return response.status(500).json({ error: `An error occurred while adding the sensor: ` + err.sqlMessage });
    }
}


// Get a particular sensor's meta data and information
async function getSensorInfo(request, response) {
    let RDSdatabase;

    const { sensor_brand, sensor_id } = request.params;

    if (!sensor_brand || sensor_brand === "" || !sensor_id || sensor_id === "") {
        return response.status(400).json({ error: 'sensor_brand and sensor_id are required parameters.' });
    }

    try {
        RDSdatabase = await RDSInstanceConnection();

        const sensor_info = await RDSdatabase(SENSOR_TABLE)
            .select("*")
            .where("sensor_brand", sensor_brand)
            .andWhere("sensor_id", sensor_id);

        await closeAWSConnection(RDSdatabase);

        if (sensor_info.length === 0) {
            return response.status(200).json({ message: `Sensor with ID '${sensor_id}' of brand '${sensor_brand}', has not been registered!`});
        }

        return response.status(200).json(sensor_info);

    } catch (err) {
        console.error('Error fetching sensors:', err);
        if (RDSdatabase) {
            try {
                await closeAWSConnection(RDSdatabase);
            } catch (closeErr) {
                console.error('Error closing database connection:', closeErr);
            }
        }
        return response.status(500).json({ error: `An error occurred while fetching this sensors data : ${err.sqlMessage}` });
    } 
}


// Update a sensors location 
async function updateSensorLocation(request, response) {
    let RDSdatabase;

    const { sensor_brand, sensor_id, } = request.params;
    const { new_latitude, new_longitude } = request.query;

    if (!sensor_brand || sensor_brand === "" || !sensor_id || sensor_id === "") {
        return response.status(400).json({ error: 'sensor_brand and sensor_id are required parameters.' });
    }

    // Check if new_latitude (sic) and new_longitude are provided
    if (new_latitude === undefined || new_longitude === undefined) {
        return response.status(400).json({ error: 'new_latitude and new_longitude are required parameters.' });
    }

    // Parse and validate latitude and longitude
    const newLatitude = parseFloat(new_latitude);
    const newLongitude = parseFloat(new_longitude);

    if (isNaN(newLatitude) || isNaN(newLongitude) || 
        newLatitude < -90 || newLatitude > 90 || 
        newLongitude < -180 || newLongitude > 180) {
        return response.status(400).json({ error: 'Invalid latitude or longitude values.' });
    }

    try {
        RDSdatabase = await RDSInstanceConnection();

        // Check if the sensor exists
        const sensorExists = await RDSdatabase(SENSOR_TABLE)
            .where({ sensor_brand, sensor_id })
            .first();

        if (!sensorExists) {
            await closeAWSConnection(RDSdatabase);
            return response.status(400).json({ error: 'Sensor not found.' });
        }

        // Update the sensor's location
        const updatedRows = await RDSdatabase(SENSOR_TABLE)
            .where({ sensor_brand, sensor_id })
            .update({
                sensor_latitude: newLatitude,
                sensor_longitude: newLongitude,
                last_location_update: RDSdatabase.fn.now()
            });

        await closeAWSConnection(RDSdatabase);

        if (updatedRows === 0) {
            return response.status(500).json({ error: 'Failed to update sensor location.' });
        }

        return response.status(200).json({ 
            message: 'Sensor location updated successfully.',
            updated: {
                sensor_brand,
                sensor_id,
                new_latitude: newLatitude,
                new_longitude: newLongitude,
                previous_latitude: sensorExists.sensor_latitude,
                previous_longitude: sensorExists.sensor_longitude
            }
        });

    } catch (err) {
        console.error('Error updating sensor location:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `An error occurred while updating the sensor location: ${err.sqlMessage || err.message}`});
    }
}


// Flag a sensor inactive but do not remove its data
async function deprecateSensor(request, response) {
    let RDSdatabase;

    const { sensor_brand, sensor_id } = request.params;

    if (!sensor_brand || sensor_brand === "" || !sensor_id || sensor_id === "") {
        return response.status(400).json({ error: 'sensor_brand and sensor_id are required parameters.' });
    }

    try {
        RDSdatabase = await RDSInstanceConnection();

        const sensorExists = await RDSdatabase(SENSOR_TABLE)
            .where({ sensor_brand, sensor_id })
            .first();

        if (!sensorExists) {
            return response.status(400).json({ error: 'Sensor not found.' });
        }

        // Update the sensor to inactive
        const updatedRows = await RDSdatabase(SENSOR_TABLE)
            .where({ sensor_brand, sensor_id })
            .update({ is_active: false });

        await closeAWSConnection(RDSdatabase);

        if (updatedRows === 0) {
            return response.status(500).json({ error: 'Failed to update sensor status.' });
        }

        return response.status(200).json({ message: 'Sensor successfully marked as inactive.' });

    } catch (err) {
        console.error('Error deprecating sensor:', err);
        if (RDSdatabase) {
            await closeAWSConnection(RDSdatabase);
        }
        return response.status(500).json({ error: `An error occurred while deprecating the sensor: ${err.sqlMessage || err.message}` });
    }
}


// Get all Sensors of the same brand and their information
async function getSensorsByBrand(request, response) {
    let RDSdatabase;
    const { sensor_brand } = request.params;

    if (!sensor_brand || sensor_brand === "") {
        return response.status(400).json({ error: 'sensor_brand is a required parameter.' });
    }

    try {
        RDSdatabase = await RDSInstanceConnection();

        const brand_sensors = await RDSdatabase(SENSOR_TABLE)
            .select("*")
            .where("sensor_brand", request.params.sensor_brand);

        await closeAWSConnection(RDSdatabase);

        if (!brand_sensors || brand_sensors.length === 0) {
            return response.status(500).json({ 
                error: `No sensors found for brand '${sensor_brand}'` 
            });
        }

        return response.status(200).json(brand_sensors);

    } catch (err) {
        console.error('Error fetching sensors:', err);
        if (RDSdatabase) {
            try {
                await closeAWSConnection(RDSdatabase);
            } catch (closeErr) {
                console.error('Error closing database connection:', closeErr);
            }
        }
        return response.status(500).json({ error: `An error occurred while fetching sensors ${err.sqlMessage || err.message}` });
    }
}


module.exports = {
    getAllSensors,
    addNewSensor,
    updateSensorLocation, 
    deprecateSensor,
    getSensorInfo,
    getSensorsByBrand,
};
