const mysql = require("mysql2/promise");

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "dydehsqjfdl123!@#",
      database: "nh",
    });
    console.log("Successfully connected to the database.");
    await connection.end();
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

testConnection();
