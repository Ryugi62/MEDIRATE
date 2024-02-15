const express = require("express");
require("dotenv").config({ path: "../.env" }); // Simplified path for environment variables
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");

const db = require("./db"); // Assumes db module properly sets up database connection
const assignmentRoutes = require("./routes/assignmentRoutes");
const authRoutes = require("./routes/authRoutes");
const commentRoutes = require("./routes/commentRoutes");
const postRoutes = require("./routes/postRoutes");

const app = express();
const port = process.env.SERVER_PORT || 3000;

// Session store setup
const sessionStore = new MySQLStore({}, db);

// Express application middleware setup
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "../dist"))); // Serve static files from 'dist'
app.use("/uploads", express.static(path.join(__dirname, "../uploads"))); // Corrected path for uploads
app.use(cors());

// Session configuration
app.use(
  session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware to log the request URL
app.use((req, res, next) => {
  console.log("Request URL:", req.url);
  next();
});

// Routes setup
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/comments", commentRoutes);

// Route for serving uploaded files
app.get("/uploads/:filename", (req, res) => {
  const { filename } = req.params;
  const absolutePath = path.join(__dirname, "../uploads", filename);
  res.download(absolutePath, (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      return res.status(500).send("Failed to download file");
    }
  });
});

// Fallback route for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
