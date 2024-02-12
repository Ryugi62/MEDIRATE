const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

console.log(`process.env.DB_HOST : ${process.env.DB_HOST}`);
console.log(`process.env.DB_USER : ${process.env.DB_USER}`);
console.log(`process.env.DB_PASSWORD : ${process.env.DB_PASSWORD}`);
console.log(`process.env.DB_NAME : ${process.env.DB_NAME}`);

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      // host: "localhost",
      // user: "root",
      // password: "dydehsqjfdl123!@",
      // database: "nh",
    });
    console.log("Successfully connected to the database.");
    await connection.end();
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

testConnection();
