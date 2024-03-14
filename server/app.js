// External dependencies
const express = require("express");
require("dotenv").config({ path: "../.env" });
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const AdmZip = require("adm-zip");
const fs = require("fs");

// Internal dependencies
const db = require("./db");
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const commentRoutes = require("./routes/commentRoutes");

// Constants and configurations
const app = express();
const port = process.env.SERVER_PORT || 3000;
const upload = multer({ dest: "uploads/" });
const IF_DIRECTORY = path.join(__dirname, "data", "taskdata");
const sessionStore = new MySQLStore({}, db);

// Middleware for parsing request bodies and serving static files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "../dist")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(cors());

// Session middleware configuration
app.use(
  session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}, Request Type: ${req.method}`);
  next();
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/comments", commentRoutes);

// Routes for handling files and directories
app.get("/uploads/:filename", serveUploadedFile);
app.get("/api/assets", listAssetFolders);
app.get("/api/assets/:foldername", listFilesInFolder);
app.get("/api/assets/:foldername/:filename", serveFileFromFolder);

// Route for uploading and extracting task data
app.post("/api/taskdata", upload.single("zipdata"), handleTaskDataUpload);

// Fallback route for single-page applications (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Function to serve an uploaded file
function serveUploadedFile(req, res) {
  const { filename } = req.params;
  const absolutePath = path.join(__dirname, "../uploads", filename);
  res.download(absolutePath, errorHandler(res));
}

// Function to list folders in the assets directory
function listAssetFolders(req, res) {
  const absolutePath = path.join(__dirname, "../assets");
  const files = fs.readdirSync(absolutePath);
  const folders = files.filter((file) =>
    fs.lstatSync(path.join(absolutePath, file)).isDirectory()
  );
  res.json(folders);
}

// Function to list files in a specified folder within assets
function listFilesInFolder(req, res) {
  const { foldername } = req.params;
  const absolutePath = path.join(__dirname, "../assets", foldername);
  if (fs.existsSync(absolutePath)) {
    const files = fs
      .readdirSync(absolutePath)
      .filter((file) => !file.startsWith("."));
    res.json(files);
  } else {
    res.status(404).send("Folder not found");
  }
}

// Function to serve a specific file from a folder
function serveFileFromFolder(req, res) {
  const { foldername, filename } = req.params;
  const absolutePath = path.join(__dirname, "../assets", foldername, filename);
  if (fs.existsSync(absolutePath)) {
    res.download(absolutePath, errorHandler(res));
  } else {
    res.status(404).send("File not found");
  }
}

// Handle POST request for uploading task data
function handleTaskDataUpload(req, res) {
  try {
    const { userid, taskid } = req.body;
    console.log(
      `User ID: ${userid} | Task ID: ${taskid} | File: ${req.file.originalname}`
    );

    const taskDir = path.join(IF_DIRECTORY, taskid);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    const zipFilePath = path.join(taskDir, req.file.originalname);
    fs.renameSync(req.file.path, zipFilePath);

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(taskDir, true);
    fs.unlinkSync(zipFilePath);

    res.json({ code: "1", result: "OK" });
  } catch (error) {
    console.error(error);
    res.status(500).send(`An error occurred: ${error.message}`);
  }
}

// General error handler for file downloads
function errorHandler(res) {
  return (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      res.status(500).send("Failed to download file");
    }
  };
}
