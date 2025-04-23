const express = require("express");
const SensorModelRouter = express.Router();

const {
    getAllSensorModels,
    addSensorModel,
    getSensorModels,
    getSensorModelDataSchema,
    downloadSensorModelReadings,
} = require("../Controllers/SensorModels.js");


/**
 * @swagger
 * /api/v2/sensor-models:
 *   get:
 *     summary: Retrieve all sensors models
 *     description: Fetch an array of all uploaded Sensor Models and their Tables.
 *     tags:
 *       - Sensor Models
 *     responses:
 *       200:
 *         description: An array of sensors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   sensor_id:
 *                     type: string
 *                     description: Unique identifier for the sensor (Serial Number)
 *                   sensor_brand:
 *                     type: string
 *                     description: Brand of the sensor
 *                   sensor_table_name:
 *                     type: string
 *                     description: Table name for the sensor data table
 *                   sensor_data_schema:
 *                     type: object
 *                     description: Schema for the sensors data
 *                   measurement_model:
 *                     type: string
 *                     description: The name of the model applied to the measurements (this ONLY applies to CORRECTED data) 
 *                   measurement_type:
 *                     type: string
 *                     description: Type of measurement the sensor performs
 *                   measurement_time_interval:
 *                     type: string
 *                     description: Time interval for sensor readings
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An error occurred while fetching sensor schemas
 */
SensorModelRouter.route("").get(getAllSensorModels);


/**
 * @swagger
 * /api/v2/sensor-models/{sensor_brand}/{sensor_id}/{measurement_type}/{measurement_time_interval}/{measurement_model}:
 *   post:
 *     summary: Add a new sensor measurement table and its schema 
 *     description: Adds a new sensor measurement table to the system. 
 *     tags:
 *       - Sensor Models
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand of the sensor
 *       - in: path
 *         name: sensor_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the sensor (Serial Number)
 *       - in: path
 *         name: measurement_model
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the model applied to the measurements (Use 'RAW_MODEL' for raw data) 
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: This measurements air quality metric type
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (OTHER if raw data) 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sensor_data_schema:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Schema for the sensor's data table. Keys are column names, values are data types.
 *                 example:
 *                   temperature: "float"
 *                   humidity: "float"
 *                   timestamp: "datetime"
 *     responses:
 *       201:
 *         description: Sensor successfully added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sensor successfully added
 *                 sensor_id:
 *                   type: string
 *       400:
 *         description: Bad request. Request parameters error 
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Validation error message or sensor schema registration error.
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An error occurred while fetching sensor schemas
 */
SensorModelRouter.post(
  "/:sensor_brand/:sensor_id/:measurement_type/:measurement_time_interval/:measurement_model", addSensorModel);


/**
 * @swagger
 * /api/v2/sensor-models/{sensor_brand}/{sensor_id}:
 *   get:
 *     summary: Retrieve the measurement schemas associated with a specific sensor
 *     description: Fetches an array of all data tables associated with the specified sensor.
 *     tags:
 *       - Sensor Models
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: The brand of the sensor
 *       - in: path
 *         name: sensor_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the sensor (Serial Number)
 *     responses:
 *       200:
 *         description: An array of sensor schemas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   sensor_id:
 *                     type: string
 *                     description: Unique identifier for the sensor (Serial Number)
 *                   sensor_brand:
 *                     type: string
 *                     description: Brand of the sensor
 *                   measurement_table_name:
 *                     type: string
 *                     description: Name of the sensor data table
 *                   measurement_table_schema:
 *                     type: object
 *                     description: Schema for the sensor's data table
 *                   measurement_type:
 *                     type: string
 *                     description: Type of measurement the sensor performs
 *                   measurement_time_interval:
 *                     type: string
 *                     description: Time interval for sensor readings
 *       400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: sensor_brand and sensor_id are required parameters.
 *       404:
 *         description: Sensor Schemas or Other Resources not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No Schemas associated with this Sensor Brand and ID have been created yet
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An error occurred while fetching sensors
 */
SensorModelRouter.route("/:sensor_brand/:sensor_id").get(getSensorModels);


/**
 * @swagger
 * /api/v2/sensor-models/csv/{sensor_brand}/{sensor_id}/{measurement_type}/{measurement_time_interval}/{measurement_model}:
 *   get:
 *     summary: Download an entire sensor model's data as a CSV file
 *     description: Fetches the data from a specifc sensor schema model based on specified parameters and returns it as a downloadable CSV file.
 *     tags:
 *       - Sensor Models
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: The brand of the sensor.
 *       - in: path
 *         name: sensor_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the sensor.
 *       - in: path
 *         name: measurement_model
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the model applied to the measurements (Use 'RAW_MODEL' for raw data) 
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: Type of measurement the sensor performs
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (OTHER if raw data) 
 *     responses:
 *       200:
 *         description: Sensor data successfully retrieved and returned as CSV.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *               description: CSV file containing the sensor data.
 *       400:
 *         description: Invalid input or no data found for the specified sensor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No data found for the specified sensor.
 *       500:
 *         description: Server error while processing the request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error processing your request.
 */
SensorModelRouter.route("/csv/:sensor_brand/:sensor_id/:measurement_type/:measurement_time_interval/:measurement_model").get(downloadSensorModelReadings);


/**
 * @swagger
 * /api/v2/sensor-models/{sensor_brand}/{sensor_id}/{measurement_type}/{measurement_time_interval}/{measurement_model}:
 *   get:
 *     summary: Get a specifc sensor measurement table's schema
 *     description: Retrieves a specifc sensor measurement table's schema and metada
 *     tags:
 *       - Sensor Models
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand of the sensor
 *       - in: path
 *         name: sensor_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the sensor (Serial Number)
 *       - in: path
 *         name: measurement_model
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the model applied to the measurements (Use 'RAW_MODEL' for raw data) 
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: This measurements air quality metric type
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (OTHER if raw data) 
 *     responses:
 *       200:
 *         description: Sensor successfully added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sensor model schema:
 *                   type: object 
 *       400:
 *         description: Bad request. Request parameters error 
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Validation error messages or sensor registration error.
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An error occurred while fetching this sensor's measuremnt schema
 */
SensorModelRouter.route(
  "/:sensor_brand/:sensor_id/:measurement_type/:measurement_time_interval/:measurement_model").get(getSensorModelDataSchema);


module.exports = SensorModelRouter;
