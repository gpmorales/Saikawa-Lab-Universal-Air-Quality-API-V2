const express = require("express");
const DataRouter = express.Router();

const {
    exportSensorDataToCSV,
    insertSensorDataFromCSV,
    fetchSensorDataReadings,
    insertSensorDataReadings,
    getLastDataReading,
} = require("../Controllers/DataReadings.js");


/**
 * @swagger
 * /api/v2/readings/csv/{sensor_brand}/{sensor_id}/{measurement_model}/{measurement_type}/{measurement_time_interval}:
 *   get:
 *     summary: Get sensor readings in CSV format
 *     description: Fetch sensor data for a specific sensor within a date range and return as CSV.
 *     tags:
 *       - AQ Data Readings
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
 *         description: The unique ID of the sensor.
 *       - in: path
 *         name: measurement_model
 *         required: false 
 *         schema:
 *           type: string
 *         description: The model of the sensor measurement. (Use 'RAW_MODEL' when querying for raw data)
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: This measurements air quality metric type (RAW or CORRECTED)
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (HOURLY, DAILY, or OTHER if RAW data) 
 *       - name: start_date
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for fetching data.
 *       - name: end_date
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for fetching data.
 *     responses:
 *       200:
 *         description: CSV file containing sensor readings.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request. Invalid parameters or no data found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Details about the validation or data retrieval error.
 *       500:
 *         description: Server error. An issue occurred while retrieving sensor data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message describing the issue.
 */
DataRouter.get("/csv/:sensor_brand/:sensor_id/:measurement_model/:measurement_type/:measurement_time_interval", exportSensorDataToCSV);


/**
 * @swagger
 * /api/v2/readings/json/{sensor_brand}/{sensor_id}/{measurement_model}/{measurement_type}/{measurement_time_interval}:
 *   get:
 *     summary: Get sensor readings in JSON format
 *     description: Fetch sensor data for a specific sensor within a date range and return as JSON.
 *     tags:
 *       - AQ Data Readings
 *     parameters:
 *       - name: sensor_brand
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The brand of the sensor.
 *       - name: sensor_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the sensor.
 *       - name: measurement_model
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The model of the sensor measurement. (Use 'RAW_MODEL' when querying for raw data)
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: This measurements air quality metric type (RAW or CORRECTED)
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (HOURLY, DAILY, or OTHER if RAW data) 
 *       - name: start_date
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for fetching data.
 *       - name: end_date
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for fetching data.
 *     responses:
 *       200:
 *         description: JSON array containing sensor readings.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Bad request. Invalid parameters or no data found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message regarding the request failure.
 *       500:
 *         description: Server error. An issue occurred while retrieving sensor data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Detailed error message about the server issue.
 */
DataRouter.get("/json/:sensor_brand/:sensor_id/:measurement_model/:measurement_type/:measurement_time_interval", fetchSensorDataReadings);


/**
 * @swagger
 * /api/v2/readings/json/{sensor_brand}/{sensor_id}/{measurement_model}/{measurement_type}/{measurement_time_interval}:
 *   post:
 *     summary: Insert sensor readings via JSON
 *     description: Insert new sensor data by providing a JSON array.
 *     tags:
 *       - AQ Data Readings
 *     parameters:
 *       - name: sensor_brand
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The brand of the sensor.
 *       - name: sensor_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the sensor.
 *       - name: measurement_model
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The model of the sensor measurement. (Use 'RAW_MODEL' when querying for raw data)
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: This measurements air quality metric type (RAW or CORRECTED)
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (HOURLY, DAILY, or OTHER if RAW data) 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *     responses:
 *       201:
 *         description: Sensor data successfully inserted into the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request. Invalid data or schema mismatch.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Validation error or mismatched data structure.
 *       500:
 *         description: Server error. An issue occurred while inserting sensor data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Detailed error message regarding the server issue.
 */
DataRouter.post("/json/:sensor_brand/:sensor_id/:measurement_model/:measurement_type/:measurement_time_interval", insertSensorDataReadings);


/**
 * @swagger
 * /api/v2/readings/csv/{sensor_brand}/{sensor_id}/{measurement_model}/{measurement_type}/{measurement_time_interval}:
 *   post:
 *     summary: Insert sensor readings via CSV
 *     description: Insert new sensor data by uploading a CSV file.
 *     tags:
 *       - AQ Data Readings
 *     parameters:
 *       - name: sensor_brand
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The brand of the sensor.
 *       - name: sensor_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the sensor.
 *       - name: measurement_model
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The model of the sensor measurement. (Use 'RAW_MODEL' when querying for raw data)
 *       - in: path
 *         name: measurement_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [RAW, CORRECTED]
 *         description: This measurements air quality metric type (RAW or CORRECTED)
 *       - in: path
 *         name: measurement_time_interval
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HOURLY, DAILY, OTHER]
 *         description: The measurements recorded time interval (HOURLY, DAILY, or OTHER if RAW data) 
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: CSV file successfully processed and sensor data added.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Bad request. Invalid CSV data or schema mismatch.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Details about the CSV parsing or validation error.
 *       500:
 *         description: Server error. An issue occurred while processing the CSV file.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Detailed error message regarding the server issue.
 */
DataRouter.post("/csv/:sensor_brand/:sensor_id/:measurement_model/:measurement_type/:measurement_time_interval",
    insertSensorDataFromCSV);


/**
* @swagger
* /api/v2/readings/last/{sensor_brand}/{sensor_id}/{measurement_model}/{measurement_type}/{measurement_time_interval}:
*   get:
*     summary: Get latest sensor reading
*     description: Retrieves the most recent reading from a specific sensor's data table
*     tags:
*       - AQ Data Readings
*     parameters:
*       - name: sensor_brand
*         in: path
*         required: true
*         schema:
*           type: string
*         description: The brand of the sensor.
*       - name: sensor_id
*         in: path
*         required: true
*         schema:
*           type: string
*         description: The unique ID of the sensor.
*       - name: measurement_model
*         in: path
*         required: true
*         schema:
*           type: string
*         description: The model of the sensor measurement. (Use 'RAW_MODEL' when querying for raw data)
*       - in: path
*         name: measurement_type
*         required: true
*         schema:
*           type: string
*           enum: [RAW, CORRECTED]
*         description: This measurements air quality metric type (RAW or CORRECTED)
*       - in: path
*         name: measurement_time_interval
*         required: true
*         schema:
*           type: string
*           enum: [HOURLY, DAILY, OTHER]
*         description: The measurements recorded time interval (HOURLY, DAILY, or OTHER if RAW data) 
*     responses:
*       200:
*         description: Successfully retrieved latest sensor reading
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 type: object
*                 properties:
*                   date:
*                     type: string
*                     format: date-time
*                     description: Timestamp of the reading
*                   pm25:
*                     type: number
*                     description: PM2.5 reading
*                   pm10:
*                     type: number
*                     description: PM10 reading
*                   temperature:
*                     type: number
*                     description: Temperature reading
*                   humidity:
*                     type: number
*                     description: Humidity reading
*       400:
*         description: Bad request. Invalid parameters or table doesn't exist.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 error:
*                   type: string
*                   description: Error message explaining the issue
*       500:
*         description: Server error while fetching data
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 error:
*                   type: string
*                   description: Internal server error message
*/
DataRouter.get("/last/:sensor_brand/:sensor_id/:measurement_model/:measurement_type/:measurement_time_interval", getLastDataReading);


module.exports = DataRouter;