// app.js

const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const unzipper = require("unzipper");
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
app.use((req, res, next) => {
  req.setTimeout(0); // 타임아웃을 무제한으로 설정
  next();
});

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

function listFilesInFolder(req, res) {
  const { foldername } = req.params;
  const folderPath = path.join(__dirname, "../assets", foldername);

  if (fs.existsSync(folderPath)) {
    // 이미지 파일 목록 가져오기
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => dirent.name)
      .filter((file) => {
        const fileExtension = path.extname(file).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".gif"].includes(fileExtension);
      });

    // metadata.json 파일 읽기
    const metadataPath = path.join(folderPath, "metadata.json");
    let metadata = null;

    console.log(`
      metadataPath : ${metadataPath}
    `);

    if (fs.existsSync(metadataPath)) {
      try {
        const metadataContent = fs.readFileSync(metadataPath, "utf-8");
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        console.error(`Error parsing metadata.json in ${foldername}:`, error);
        metadata = null;
      }
    }

    // 응답으로 파일 목록과 메타데이터를 함께 반환 (metadata가 없을 수 있음)
    res.json({ files, metadata });
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
    const { userid, taskid, ...otherFields } = req.body; // userid, taskid를 제외한 나머지 폼 필드 추출
    const taskDir = path.join(IF_DIRECTORY, taskid);

    console.log(`Task ID: ${taskid}`);
    console.log(`Task Directory: ${taskDir}`);

    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
      console.log(`Created directory: ${taskDir}`);
    }

    const zipFilePath = req.file.path;
    console.log(`ZIP file path: ${zipFilePath}`);

    // ZIP 파일을 풀어서 taskDir에 저장
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

    fs.unlinkSync(zipFilePath); // 원본 ZIP 파일 삭제
    console.log(`Deleted ZIP file: ${zipFilePath}`);

    // userid와 나머지 폼 필드를 metadata.json 파일로 저장
    const metadata = {
      userid,
      ...otherFields,
    };
    const metadataPath = path.join(taskDir, "metadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`Metadata saved to ${metadataPath}`);

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
