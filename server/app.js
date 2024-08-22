const express = require("express");
const dotenv = require("dotenv");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const unzipper = require("unzipper");
const archiver = require("archiver");
const fs = require("fs");
const db = require("./db");
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const downloadSearchedAssignments = require("./routes/downloadSearchedAssignments.js");
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
app.use("/api/download", downloadSearchedAssignments);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/comments", commentRoutes);

// Routes for handling files and directories
app.get("/uploads/:filename", serveUploadedFile);
app.get("/api/assets", listAssetFolders);
app.get("/api/assets/:foldername", listFilesInFolder);
app.get("/api/assets/:foldername/:filename", serveFileFromFolder);

// 경로: /api/download-assets
app.get("/api/download-assets", async (req, res) => {
  try {
    const { keyword } = req.query; // 필터링을 위한 키워드
    const targetDir = path.join(__dirname, "../assets");

    // 폴더 목록 가져오기
    const folders = fs
      .readdirSync(targetDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((folderName) => !keyword || folderName.includes(keyword)); // 키워드 필터링

    if (folders.length === 0) {
      return res.status(404).send("No folders matched the given keyword.");
    }

    const zipFilename = `assets_${Date.now()}.zip`;
    const outputPath = path.join(__dirname, "../", zipFilename);

    // 압축 파일 생성
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      // 압축이 완료되면 클라이언트에게 파일 제공
      res.download(outputPath, (err) => {
        if (err) {
          console.error("Error while sending the file:", err);
        } else {
          // 다운로드 후 압축 파일 삭제
          fs.unlinkSync(outputPath);
        }
      });
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    // 선택된 폴더를 압축에 추가
    folders.forEach((folderName) => {
      const folderPath = path.join(targetDir, folderName);
      archive.directory(folderPath, folderName);
    });

    await archive.finalize();
  } catch (error) {
    console.error("Error creating zip file:", error);
    res.status(500).send("An error occurred while creating the zip file.");
  }
});

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
  const filename = decodeURIComponent(req.params.filename);
  const absolutePath = path.join(__dirname, "../uploads", filename);

  res.download(absolutePath, errorHandler(res));
}

// Function to list folders in the assets directory
function listAssetFolders(req, res) {
  const absolutePath = path.join(__dirname, "../assets");
  const folders = fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  res.json(folders);
}

// Function to list files in a specified folder within assets
function listFilesInFolder(req, res) {
  const { foldername } = req.params;
  const absolutePath = path.join(__dirname, "../assets", foldername);

  if (fs.existsSync(absolutePath)) {
    const files = fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => dirent.name)
      .filter((file) => {
        const fileExtension = path.extname(file).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".gif"].includes(fileExtension);
      });

    res.json(files);
  } else {
    res.status(404).send("Folder not found");
  }
}

// Function to serve a specific file from a folder
function serveFileFromFolder(req, res) {
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

    console.log(`Task ID: ${taskid}`);
    console.log(`Task Directory: ${taskDir}`);

    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
      console.log(`Created directory: ${taskDir}`);
    }

    const zipFilePath = req.file.path;
    console.log(`ZIP file path: ${zipFilePath}`);

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipFilePath)
        .pipe(unzipper.Parse())
        .on("entry", (entry) => {
          const fileName = path.basename(entry.path);
          console.log(`Extracting file: ${fileName}`);
          if (
            entry.type === "File" &&
            fileName.match(/\.(jpg|jpeg|png|gif|json)$/)
          ) {
            const fullPath = path.join(taskDir, fileName);
            entry.pipe(fs.createWriteStream(fullPath)).on("finish", () => {
              console.log(`File extracted: ${fullPath}`);
            });
          } else {
            entry.autodrain();
          }
        })
        .on("finish", () => {
          console.log("Unzip completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("Error during unzip:", err);
          reject(err);
        });
    });

    fs.unlinkSync(zipFilePath); // Delete the original ZIP file after extraction
    console.log(`Deleted ZIP file: ${zipFilePath}`);
    res.json({ code: "1", result: "OK" });
  } catch (error) {
    console.error("Error handling task data upload:", error);
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
