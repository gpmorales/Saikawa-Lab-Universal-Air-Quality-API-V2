const express = require("express");
const SensorRouter = express.Router();

const {
    getAllSensors,
    addNewSensor, 
    getSensorInfo,
    updateSensorLocation, 
    deprecateSensor,
    getSensorsByBrand
} = require("../Controllers/Sensors.js");


/**
 * @swagger
 * /api/v2/sensors:
 *   get:
 *     summary: Retrieve all sensors
 *     description: Fetch an array of all sensors from the database.
 *     tags:
 *       - Sensors
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
 *                   sensor_latitude:
 *                     type: number
 *                     format: float
 *                     description: Latitude coordinate of the sensor
 *                   sensor_longitude:
 *                     type: number
 *                     format: float
 *                     description: Longitude coordinate of the sensor
 *                   last_location_update:
 *                     type: boolean
 *                     description: The previous date the sensors location was updated
 *                   date_uploaded:
 *                     type: boolean
 *                     description: The creation date of a data table associated with this sensor 
 *                   is_active:
 *                     type: boolean
 *                     description: Whether the sensor is currently active
 *       500:
 *         description: Server error. An error occurred fetching sensors.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error message describing the issue.
 */
SensorRouter.route("").get(getAllSensors);


/**
 * @swagger
 * /api/v2/sensors/{sensor_brand}/{sensor_id}:
 *   post:
 *     summary: Add a new sensor
 *     description: Adds a new sensor to the database. The sensor must have a unique sensor_id and sensor_brand.
 *     tags:
 *       - Sensors
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand of the sensor.
 *       - in: path
 *         name: sensor_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the sensor (Serial Number)
 *       - in: query 
 *         name: sensor_latitude
 *         required: false
 *         schema:
 *           type: number
 *           format: float
 *         description: Latitude coordinate of the sensor. Optional but must be a valid float if provided.
 *       - in: query
 *         name: sensor_longitude
 *         required: false
 *         schema:
 *           type: number
 *           format: float
 *         description: Longitude coordinate of the sensor. Optional but must be a valid float if provided.
 *     responses:
 *       201:
 *         description: Sensor successfully added to the SENSORS table.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Success message.
 *       400:
 *         description: Bad request. Validation error or sensor already exists.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: Array of validation error messages or sensor registration error.
 *       500:
 *         description: Server error. An error occurred while adding the sensor.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error message describing the issue.
 */
SensorRouter.route("/:sensor_brand/:sensor_id").post(addNewSensor);


/**
 * @swagger
 * /api/v2/sensors/{sensor_brand}/{sensor_id}:
 *   get:
 *     summary: Retrieve a sensor's metadata
 *     description: Fetches a sensor's info including brand, ID, location, and other metadata.
 *     tags:
 *       - Sensors
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand of the sensor.
 *       - in: path
 *         name: sensor_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the sensor (Serial Number)
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
 *                     description: Brand of the sensor.
 *                   sensor_latitude:
 *                     type: number
 *                     format: float
 *                     description: Latitude coordinate of the sensor.
 *                   sensor_longitude:
 *                     type: number
 *                     format: float
 *                     description: Longitude coordinate of the sensor.
 *                   last_location_update:
 *                     type: string
 *                     format: date-time
 *                     description: The previous date the sensor's location was updated.
 *                   date_uploaded:
 *                     type: string
 *                     format: date-time
 *                     description: The creation date of a data table associated with this sensor.
 *                   is_active:
 *                     type: boolean
 *                     description: Whether the sensor is currently active.
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error message describing the server issue.
 */
SensorRouter.route("/:sensor_brand/:sensor_id").get(getSensorInfo);


/**
 * @swagger
 * /api/v2/sensors/{sensor_brand}/{sensor_id}/location:
 *   put:
 *     summary: Update sensor location
 *     description: Update the location (latitude and longitude) of a specific sensor.
 *     tags:
 *       - Sensors
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
 *       - in: query
 *         name: new_latitude
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: The new latitude of the sensor
 *       - in: query
 *         name: new_longitude
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: The new longitude of the sensor
 *     responses:
 *       200:
 *         description: Sensor location updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sensor location updated successfully.
 *                 updated:
 *                   type: object
 *                   properties:
 *                     sensor_brand:
 *                       type: string
 *                     sensor_id:
 *                       type: string
 *                     new_latitude:
 *                       type: number
 *                     new_longitude:
 *                       type: number
 *                     previous_latitude:
 *                       type: number
 *                     previous_longitude:
 *                       type: number
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: sensor_brand and sensor_id are required parameters.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An error occurred while updating the sensor location
 */
SensorRouter.route("/:sensor_brand/:sensor_id/location").put(updateSensorLocation);


/**
 * @swagger
 * /api/v2/sensors/{sensor_brand}/{sensor_id}/deprecate:
 *   delete:
 *     summary: Deprecate a sensor
 *     description: Flag a sensor as inactive without removing its data from the database.
 *     tags:
 *       - Sensors
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
 *         description: Sensor successfully marked as inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sensor successfully marked as inactive.
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: sensor_brand and sensor_id are required parameters.
 *       204:
 *         description: Sensor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Sensor not found.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An error occurred while deprecating the sensor
 */
SensorRouter.delete("/:sensor_brand/:sensor_id/deprecate", deprecateSensor);


/**
 * @swagger
 * /api/v2/sensors/{sensor_brand}:
 *   get:
 *     summary: Retrieve all sensors of the specified brand type
 *     description: Fetch an array of all sensors from the database.
 *     tags:
 *       - Sensors
 *     parameters:
 *       - in: path
 *         name: sensor_brand
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand of the sensors to retrieve
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
 *                   sensor_latitude:
 *                     type: number
 *                     format: float
 *                     description: Latitude coordinate of the sensor
 *                   sensor_longitude:
 *                     type: number
 *                     format: float
 *                     description: Longitude coordinate of the sensor
 *                   last_location_update:
 *                     type: boolean
 *                     description: The previous date the sensors location was updated
 *                   date_uploaded:
 *                     type: boolean
 *                     description: The creation date of a data table associated with this sensor 
 *                   is_active:
 *                     type: boolean
 *                     description: Whether the sensor is currently active
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Error message describing the server issue.
 */
SensorRouter.route("/:sensor_brand").get(getSensorsByBrand);


module.exports = SensorRouter;
