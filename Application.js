const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");
const express = require("express");
const app = express();

const { RDSInstanceConnection, closeAWSConnection } = require("./Database-Config/RDSInstanceConnection");
const SensorRouter = require("./Routes/SensorRouter.js");
const SensorSchemaRouter = require("./Routes/SensorModelRouter.js");
const DataRouter = require("./Routes/DataRouter.js");

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "30mb" }));
app.use(express.json());


// Base URI and Router to map endpoints is initialized here
app.use("/api/v2/sensors", SensorRouter);
app.use("/api/v2/sensor-models", SensorSchemaRouter);
app.use("/api/v2/readings", DataRouter);

// Serve Swagger documentation
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Saikawa Labs Air Quality Sensor & Data Management API",
      version: "1.0.0",
      description:
        "An Express-based REST API that fetches and pushes air quality data to an AWS RDS MySQL instance",
    },
    servers: [
      {
        //url: "http://localhost:3000", // For local instance
        url: "https://api2-dot-saikawalab-427516.uc.r.appspot.com",
        description: "Development Server",
      },
    ],
    tags: [
      {
        name: "Sensors",
        description:
          "API endpoints for managing Sensors. This encompasses all operations related to the physical devices that collect environmental data.",
      },
      {
        name: "Sensor Models",
        description:
          "API endpoints for managing Sensor Models. This includes creating, updating, and retrieving various configurations and measurement tables for Sensor Models.",
      },
      {
        name: "AQ Data Readings",
        description:
          "API endpoints for managing Sensor Model's Data Readings. This includes retrieving, aggregating, and processing data derived from different Sensor Models or Raw Sensor Data.",
      },
    ],
  },
  apis: [
    "./Routes/SensorRouter.js",
    "./Routes/SensorModelRouter.js",
    "./Routes/DataRouter.js",
  ],
};


// Serve Swagger GUI
const swaggerSpec = swaggerJsDoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// APPLICATION ENTRY POINT
async function StartServer() {
    try {
        //await initializeDatabase();

        app.listen(PORT, () => {
            console.log("\nListening to Port " + PORT + " ...\n");
        });

    } catch (err) {
        console.error("Error starting server:", err);
    }
}


// Initialize Sensor and Sensor Schema Tables if necessary
async function initializeDatabase() {
    const db = await RDSInstanceConnection();

    // Create the SENSORS table
    const sensorsTableExists = await db.schema.hasTable("SENSORS");

    if (!sensorsTableExists) {
        await db.schema
        .createTable("SENSORS", (table) => {
            table.increments("id").primary();                       /* auto-increment primary key */
            table.string("sensor_id", 255).notNullable();
            table.string("sensor_brand", 255).notNullable();
            table.decimal("sensor_latitude", 10, 8);
            table.decimal("sensor_longitude", 11, 8);
            table.dateTime("last_location_update").notNullable();
            table.boolean("is_active").defaultTo(true);
            table.dateTime("date_uploaded").notNullable();
            table.unique(["sensor_brand", "sensor_id"]);            /* unique constraint on sensor_brand and sensor_id */
        })
        .then(() => {
            console.log("SENSORS table created");
        })
        .catch((err) => {
            console.error("Error creating SENSORS table:", err);
        });
    }

    // Create the SENSOR_MODELS table
    const sensorModelsTableExists = await db.schema.hasTable("SENSOR_MODELS");

    if (!sensorModelsTableExists) {
        db.schema
            .createTable("SENSOR_MODELS", (table) => {
                table.increments("id").primary();                       /* auto-increment primary key */
                table.string("sensor_id", 255).notNullable();
                table.string("sensor_brand", 255).notNullable();
                table.string("sensor_table_name", 255).notNullable();
                table.json("sensor_data_schema");
                table.string("measurement_model", 255).notNullable();
                table.string("measurement_type", 255).notNullable();
                table.string("measurement_time_interval", 50).notNullable();
                table.unique("sensor_table_name");                      /* unique constraint on sensor_brand and sensor_id */
                table
                    .foreign(["sensor_brand", "sensor_id"])
                    .references(["sensor_brand", "sensor_id"])
                    .inTable("SENSORS");                                  /* foreign key constraint */
            })
            .then(() => {
                console.log("SENSOR_MODELS table created");
            })
            .catch((err) => {
                console.error("Error creating SENSOR_MODELS table:", err);
            });
    }

    await closeAWSConnection(db);
}


StartServer();
