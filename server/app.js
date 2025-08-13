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
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  console.log(`[${requestId}] ===== TASK DATA UPLOAD REQUEST START =====`);
  console.log(`[${requestId}] Request timestamp: ${new Date().toISOString()}`);
  console.log(`[${requestId}] Request headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[${requestId}] Request body fields:`, Object.keys(req.body));
  
  try {
    const { userid, taskid, ...otherFields } = req.body;
    console.log(`[${requestId}] Extracted userid: ${userid}`);
    console.log(`[${requestId}] Extracted taskid: ${taskid}`);
    console.log(`[${requestId}] Other fields:`, JSON.stringify(otherFields, null, 2));
    
    if (!req.file) {
      console.log(`[${requestId}] ERROR: No file uploaded`);
      return res.status(400).json({ code: "0", result: "No file uploaded" });
    }
    
    console.log(`[${requestId}] Uploaded file info:`, {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    const taskDir = path.join(IF_DIRECTORY, taskid);
    console.log(`[${requestId}] Task directory path: ${taskDir}`);
    console.log(`[${requestId}] IF_DIRECTORY: ${IF_DIRECTORY}`);

    // 디렉토리 존재 확인 및 생성
    if (!fs.existsSync(taskDir)) {
      console.log(`[${requestId}] Directory does not exist, creating: ${taskDir}`);
      fs.mkdirSync(taskDir, { recursive: true });
      console.log(`[${requestId}] Directory created successfully`);
    } else {
      console.log(`[${requestId}] Directory already exists: ${taskDir}`);
    }

    const zipFilePath = req.file.path;
    console.log(`[${requestId}] ZIP file path: ${zipFilePath}`);
    console.log(`[${requestId}] ZIP file exists: ${fs.existsSync(zipFilePath)}`);
    
    if (fs.existsSync(zipFilePath)) {
      const stats = fs.statSync(zipFilePath);
      console.log(`[${requestId}] ZIP file size: ${stats.size} bytes`);
    }

    console.log(`[${requestId}] Starting ZIP extraction...`);
    let extractedFiles = [];
    let extractionErrors = [];

    // ZIP 파일을 풀어서 taskDir에 저장
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(zipFilePath);
      
      stream.on('error', (err) => {
        console.log(`[${requestId}] Error reading ZIP file:`, err);
        reject(err);
      });
      
      stream
        .pipe(unzipper.Parse())
        .on("entry", (entry) => {
          const fileName = path.basename(entry.path);
          const fileType = entry.type;
          const fileSize = entry.size;
          
          console.log(`[${requestId}] Processing entry:`, {
            path: entry.path,
            fileName: fileName,
            type: fileType,
            size: fileSize
          });
          
          if (
            entry.type === "File" &&
            fileName.match(/\.(jpg|jpeg|png|gif|json)$/i)
          ) {
            const fullPath = path.join(taskDir, fileName);
            console.log(`[${requestId}] Extracting file to: ${fullPath}`);
            
            const writeStream = fs.createWriteStream(fullPath);
            
            writeStream.on('error', (err) => {
              console.log(`[${requestId}] Error writing file ${fileName}:`, err);
              extractionErrors.push({ fileName, error: err.message });
            });
            
            writeStream.on("finish", () => {
              console.log(`[${requestId}] File extracted successfully: ${fullPath}`);
              
              // 추출된 파일 정보 확인
              if (fs.existsSync(fullPath)) {
                const extractedStats = fs.statSync(fullPath);
                console.log(`[${requestId}] Extracted file size: ${extractedStats.size} bytes`);
                extractedFiles.push({
                  fileName,
                  fullPath,
                  size: extractedStats.size
                });
              }
            });
            
            entry.pipe(writeStream);
          } else {
            console.log(`[${requestId}] Skipping file (not allowed type or not a file): ${fileName}, type: ${fileType}`);
            entry.autodrain();
          }
        })
        .on("finish", () => {
          console.log(`[${requestId}] ZIP extraction completed`);
          console.log(`[${requestId}] Total files extracted: ${extractedFiles.length}`);
          console.log(`[${requestId}] Extraction errors: ${extractionErrors.length}`);
          
          if (extractionErrors.length > 0) {
            console.log(`[${requestId}] Extraction errors details:`, extractionErrors);
          }
          
          resolve();
        })
        .on("error", (err) => {
          console.log(`[${requestId}] Error during ZIP extraction:`, err);
          reject(err);
        });
    });

    console.log(`[${requestId}] ===== POST-EXTRACTION PROCESSING START =====`);

    // 원본 ZIP 파일 삭제
    console.log(`[${requestId}] Deleting original ZIP file: ${zipFilePath}`);
    try {
      if (fs.existsSync(zipFilePath)) {
        fs.unlinkSync(zipFilePath);
        console.log(`[${requestId}] ZIP file deleted successfully`);
      } else {
        console.log(`[${requestId}] ZIP file does not exist, skipping deletion`);
      }
    } catch (deleteError) {
      console.log(`[${requestId}] ERROR deleting ZIP file:`, deleteError);
      throw new Error(`Failed to delete ZIP file: ${deleteError.message}`);
    }

    // metadata.json 생성
    console.log(`[${requestId}] Creating metadata...`);
    const metadata = {
      userid,
      uploadTimestamp: new Date().toISOString(),
      requestId,
      extractedFiles: extractedFiles.map(f => ({ fileName: f.fileName, size: f.size })),
      ...otherFields,
    };
    
    const metadataPath = path.join(taskDir, "metadata.json");
    console.log(`[${requestId}] Saving metadata to: ${metadataPath}`);
    console.log(`[${requestId}] Metadata content:`, JSON.stringify(metadata, null, 2));
    
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`[${requestId}] Metadata saved successfully`);
      
      // 메타데이터 파일이 실제로 생성되었는지 확인
      if (fs.existsSync(metadataPath)) {
        const savedMetadata = fs.readFileSync(metadataPath, 'utf8');
        console.log(`[${requestId}] Metadata verification successful, size: ${savedMetadata.length} bytes`);
      } else {
        throw new Error('Metadata file was not created');
      }
    } catch (metadataError) {
      console.log(`[${requestId}] ERROR saving metadata:`, metadataError);
      throw new Error(`Failed to save metadata: ${metadataError.message}`);
    }

    // 최종 디렉토리 상태 확인
    console.log(`[${requestId}] Checking final directory contents...`);
    try {
      const dirContents = fs.readdirSync(taskDir);
      console.log(`[${requestId}] Final directory contains ${dirContents.length} files:`);
      dirContents.forEach(file => {
        try {
          const filePath = path.join(taskDir, file);
          const stats = fs.statSync(filePath);
          console.log(`[${requestId}] - ${file} (${stats.size} bytes)`);
        } catch (fileError) {
          console.log(`[${requestId}] - ${file} (ERROR reading stats: ${fileError.message})`);
        }
      });
    } catch (dirError) {
      console.log(`[${requestId}] ERROR reading directory contents:`, dirError);
      throw new Error(`Failed to read directory: ${dirError.message}`);
    }

    console.log(`[${requestId}] ===== PREPARING RESPONSE =====`);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`[${requestId}] Total processing time: ${duration}ms`);
    console.log(`[${requestId}] All operations completed successfully`);
    console.log(`[${requestId}] Preparing to send response: { code: "1", result: "OK" }`);

    // 응답 전송 전 마지막 체크
    if (!res.headersSent) {
      console.log(`[${requestId}] Headers not sent yet, proceeding with response`);
      try {
        res.json({ code: "1", result: "OK" });
        console.log(`[${requestId}] ===== TASK DATA UPLOAD SUCCESS =====`);
        console.log(`[${requestId}] Response sent successfully`);
      } catch (responseError) {
        console.log(`[${requestId}] ERROR sending response:`, responseError);
        throw new Error(`Failed to send response: ${responseError.message}`);
      }
    } else {
      console.log(`[${requestId}] WARNING: Headers already sent, cannot send response`);
      throw new Error('Headers already sent, response cannot be sent');
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`[${requestId}] ===== TASK DATA UPLOAD ERROR =====`);
    console.log(`[${requestId}] Error occurred after ${duration}ms`);
    console.log(`[${requestId}] Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    console.log(`[${requestId}] Sending error response`);
    res.status(500).json({ 
      code: "0", 
      result: "ERROR", 
      message: error.message,
      requestId 
    });
    
    console.log(`[${requestId}] Error response sent`);
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
