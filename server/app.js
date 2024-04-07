// External dependencies
const express = require("express");
require("dotenv").config({ path: "../.env" });
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const unzipper = require("unzipper");
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
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
const IF_DIRECTORY = path.join(__dirname, "..", "assets");
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
  console.log("hello world");

  // Decode the filename to handle spaces and special characters
  const filename = decodeURIComponent(req.params.filename);
  const absolutePath = path.join(__dirname, "../uploads", filename);

  console.log(`filename : ${filename}`);

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
  // Decode foldername and filename to handle spaces and special characters
  const foldername = decodeURIComponent(req.params.foldername);
  const filename = decodeURIComponent(req.params.filename);
  const absolutePath = path.join(__dirname, "../assets", foldername, filename);

  if (fs.existsSync(absolutePath)) {
    res.download(absolutePath, errorHandler(res));
  } else {
    res.status(404).send("File not found");
  }
}

async function handleTaskDataUpload(req, res) {
  try {
    const { taskid } = req.body;

    const taskDir = path.join(IF_DIRECTORY, taskid);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    const zipFilePath = req.file.path;

    // unzipper를 사용하여 ZIP 파일을 스트림으로 열고, 각 항목에 대해 처리합니다.
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Parse())
      .on("entry", function (entry) {
        // const fileName = entry.path;
        // 파일의 이름만 담아둠
        const fileName = path.basename(entry.path);
        const type = entry.type; // 'Directory' 또는 'File'
        const fullPath = path.join(taskDir, fileName);

        // 이미지 일때만 처리
        if (type === "File" && fileName.match(/\.(jpg|jpeg|png|gif|json)$/)) {
          // 파일 이름에 따옴표 추가
          const sanitizedFileName = fileName.replace(/"/g, "'");
          const sanitizedFullPath = path.join(taskDir, sanitizedFileName);
          entry.pipe(fs.createWriteStream(sanitizedFullPath));
        }

        // 항목을 처리한 후 스트림을 닫습니다.
        entry.autodrain();

        // 파일이름을 출력
      })
      .promise()
      .then(
        () => {
          // 압축 해제 후 원본 zip 파일 삭제
          fs.unlinkSync(zipFilePath);
          res.json({ code: "1", result: "OK" });
        },
        (err) => {
          throw err;
        }
      );
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
