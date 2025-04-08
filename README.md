# Saikawa Labs Air Quality Sensor & Data Management API V2
**Author:** George Morales

> **Deployment:** AWS RDS (Single instance) with a unified MySQL database.  
> **Design Rationale:** Centralizing all sensor data within one database ensures faster and cheaper cross-table queries and eases schema validation, data auditing, and analytics aggregation.

---

## `/API/V2/SENSORS`

### Table Name: `SENSORS`  
Tracks individual physical sensors, their unique identity, deployment location, and status.

### Description:
The SENSORS table serves as the base registry for all physical air quality monitoring devices
deployed by Saikawa Labs. Each row in this table corresponds to a unique sensor identified by
its brand and serial number. This table is critical as it enforces the uniqueness of each sensor
and provides necessary metadata (such as location and status) used in data analysis, mapping, and cross-referencing with measurement tables.

### Table Schema

+------------------------+--------------------------------------------------------------+
| Column Name            | Description                                                  |
+------------------------+--------------------------------------------------------------+
| `id`                   | Auto-incremented unique primary key                          |
| `sensor_id`            | Unique serial number of the sensor                           |
| `sensor_brand`         | Manufacturer or vendor name                                  |
| `sensor_latitude`      | Current latitude of the deployed sensor                      |
| `sensor_longitude`     | Current longitude of the deployed sensor                     |
| `last_location_update` | Last date the sensor location was updated                    |
| `date_uploaded`        | Date the sensor was registered in the system                 |
| `is_active`            | Boolean flag indicating if the sensor is active              |
+------------------------+--------------------------------------------------------------+

### SQL Definition

```sql
CREATE TABLE SENSORS (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(255) NOT NULL,
    sensor_brand VARCHAR(255) NOT NULL,
    sensor_latitude DECIMAL(10, 8),
    sensor_longitude DECIMAL(11, 8),
    last_location_update DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    date_uploaded DATETIME NOT NULL,
    CONSTRAINT unique_sensor UNIQUE (sensor_brand, sensor_id)
);

```

---


## `/API/V2/SENSORS-MODELS`

### Table: `SENSOR_MODELS`  
Tracks unique sensor configurations and associated measurement schemas for each sensor. This table defines how 
sensor readings are structured, labeled, and stored in dynamically generated measurement tables.

### Description:
Each entry in this table corresponds to a specific way a sensor reports or processes data.
It is **required** for:
    - Creating and validating the actual Measurement table schema.
    - Differentiating between RAW vs CORRECTED datasets.
    - Supporting multiple data collection modes (e.g., hourly vs daily).
    - Enabling schema-specific ingestion and export.

### Table Schema

+-----------------------------+----------------------------------------------------------------------------+
| Column Name                 | Description                                                                |
+-----------------------------+----------------------------------------------------------------------------+
| `id`                        | Auto-incremented unique primary key                                        |
| `sensor_id`                 | Foreign key linking to the physical sensor (from `SENSORS`)                |
| `sensor_brand`              | Brand of the sensor (linked to `SENSORS`)                                  |
| `sensor_table_name`         | Globally unique name of the associated measurement table                   |
| `sensor_data_schema`        | JSON object defining column names and datatypes for the measurement table  |
| `measurement_model`         | Name of the bias correction model used for processing (or `RAW_MODEL`)     |
| `measurement_type`          | One of `RAW`, `CORRECTED`                                                  |
| `measurement_time_interval` | Time granularity: `HOURLY`, `DAILY`, or `OTHER`                            |
+---------------------------+------------------------------------------------------------------------------+

### Why It's Required  
For every table of measurements, a corresponding `SENSOR_MODELS` entry is required because:
- It defines the schema used to create the actual SQL table.
- It allows proper validation and parsing of uploaded data.
- It determines how the API routes, stores, and processes measurement records.
- It links each measurement schema back to a real-world sensor.

### SQL Definition

```sql
CREATE TABLE SENSOR_MODELS (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(255) NOT NULL,
    sensor_brand VARCHAR(255) NOT NULL,
    sensor_table_name VARCHAR(255) NOT NULL,
    sensor_data_schema JSON,
    measurement_model VARCHAR(255) NOT NULL,
    measurement_type VARCHAR(255) NOT NULL,
    measurement_time_interval VARCHAR(50) NOT NULL,
    CONSTRAINT unique_measurement_table UNIQUE (sensor_table_name),
    CONSTRAINT fk_sensor FOREIGN KEY (sensor_brand, sensor_id) 
        REFERENCES SENSORS(sensor_brand, sensor_id)
);
```

NOTES:
-> Each 'sensor_table_name' is dynamically generated using:
    {sensor_brand}_{sensor_id}_{measurement_model}_{measurement_type}_{measurement_time_interval}


---


## `/API/V2/READINGS`

### Overview  
This route handles **data ingestion and export** for every sensor model's corresponding readings/measurements table.
Each table is dynamically generated when a sensor model is registered and follows a strict schema.

All endpoints rely on a naming convention and use a combination of sensor identity, measurement metadata, and time filters to perform queries or insertions.

## Parameters (All Endpoints in /readings)

+----------------------------+-----------+--------------------------------------------------------------+
| Parameter                  | Required  | Description                                                  |
+----------------------------+-----------+--------------------------------------------------------------+
| `sensor_brand`             |   Yes     | Sensor vendor name (e.g., `quantaq`, `airly`)                |
| `sensor_id`                |   Yes     | Serial number of the device                                  |
| `measurement_model`        |   Yes     | Model name or `RAW_MODEL`                                    |
| `measurement_type`         |   Yes     | One of `RAW` or `CORRECTED`                                  |
| `measurement_time_interval`|   Yes     | One of `HOURLY`, `DAILY`, or `OTHER`                         |
| `averaged_rows`            |   No      | Downsamples data using row-wise averaging (default: none)    |
+----------------------------+-----------+--------------------------------------------------------------+

 **Row-averaging uses equal windowing strategy with partial handling of leftovers

## Example Measurement Tables:

[ 'Airly_00459_GEORGES-MODEL_CORRECTED_HOURLY' ]

    Represents:
    - Brand: `Airly`
    - ID: `00459`
    - Model: `GEORGES-MODEL`
    - Type: `CORRECTED`
    - Interval: `HOURLY`

This table holds corrected, hourly bias-corrected data derived
from an Airly sensor with id 00459 using GEORGES-MODEL as the coorection model!


[ 'QUANTAQ_00858_RAW_MODEL_RAW_OTHER' ]

    Represents:
    - Brand: `QUANTAQ`
    - ID: `00858`
    - Model: `RAW_MODEL`
    - Type: `RAW`
    - Interval: `OTHER`

This table holds the raw data collected from a QUANTAQ sensor with id 00858 using 
no model (no bias correction) and with a time interval that is not hourly or daily


---


## ASSUMPTIONS && IMPORTANT INFORMATION:

- Data is always ordered by date (no sorting should be necessary at any point when returning or ingesting data)
- Each table must have **exactly one `datetime` or `date` column**
- 'Raw' Models has no time interval associated (always OTHER)
- Sensor model schemas are **immutable**
- All Measurement tables are created via `/sensor-models` endpoints
- Row-averaging uses equal windowing strategy with partial handling of leftovers
- CSV ingestion **rejects mismatches** in schema or column count
