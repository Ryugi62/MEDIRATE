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
const { extractCancerAndFolder } = require("./utils/folderClassifier");

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
app.post("/api/taskdata", upload.any(), handleTaskDataUpload);

// Fallback route for single-page applications (SPA)
app.get("*", (req, res) => {
  // dist는 프로젝트 루트 아래에 있으므로 ../dist를 가리킨다
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
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
    .map((dirent) => dirent.name.trim().replace(/[\r\n]/g, '')); // 공백과 줄바꿈 제거

  res.json(folders);
}

function listFilesInFolder(req, res) {
  const { foldername } = req.params;
  const cleanFoldername = foldername.trim().replace(/[\r\n]/g, ''); // 줄바꿈 제거
  const folderPath = path.join(__dirname, "../assets", cleanFoldername);
  
  console.log(`[listFilesInFolder] Requested folder: "${foldername}"`);
  console.log(`[listFilesInFolder] Clean folder name: "${cleanFoldername}"`);
  console.log(`[listFilesInFolder] Full folder path: "${folderPath}"`);
  console.log(`[listFilesInFolder] Assets directory: "${path.join(__dirname, "../assets")}"`);
  
  // assets 디렉토리의 모든 폴더 확인
  try {
    const assetsDir = path.join(__dirname, "../assets");
    const allFolders = fs.readdirSync(assetsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name.trim().replace(/[\r\n]/g, '')); // 줄바꿈 제거
    console.log(`[listFilesInFolder] Available clean folders: [${allFolders.map(f => `"${f}"`).join(", ")}]`);
    
    // 요청된 폴더가 정확히 일치하는지 확인
    const exactMatch = allFolders.find(folder => folder === cleanFoldername);
    console.log(`[listFilesInFolder] Exact match found: ${exactMatch ? `"${exactMatch}"` : 'false'}`);
  } catch (error) {
    console.log(`[listFilesInFolder] Error reading assets directory:`, error);
  }
  
  console.log(`[listFilesInFolder] Folder exists: ${fs.existsSync(folderPath)}`);
  
  // Additional debugging for path issues
  try {
    const stats = fs.lstatSync(folderPath);
    console.log(`[listFilesInFolder] Path stats:`, {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymbolicLink: stats.isSymbolicLink(),
      mode: stats.mode,
      uid: stats.uid,
      gid: stats.gid
    });
  } catch (statsError) {
    console.log(`[listFilesInFolder] Error getting path stats:`, statsError.message);
    
    // Try to access the parent directory
    const parentDir = path.dirname(folderPath);
    console.log(`[listFilesInFolder] Checking parent directory: "${parentDir}"`);
    try {
      const parentStats = fs.lstatSync(parentDir);
      console.log(`[listFilesInFolder] Parent directory exists:`, parentStats.isDirectory());
      
      // List contents of parent directory
      const parentContents = fs.readdirSync(parentDir);
      console.log(`[listFilesInFolder] Parent directory contents:`, parentContents);
      
      // Check if folder name appears in parent contents (case sensitive check)
      const folderName = path.basename(folderPath);
      const foundInParent = parentContents.includes(folderName);
      console.log(`[listFilesInFolder] Looking for "${folderName}" in parent contents: ${foundInParent}`);
      
      if (!foundInParent) {
        // Do case-insensitive search
        const caseInsensitiveMatch = parentContents.find(item => 
          item.toLowerCase() === folderName.toLowerCase()
        );
        if (caseInsensitiveMatch) {
          console.log(`[listFilesInFolder] Found case-insensitive match: "${caseInsensitiveMatch}"`);
        }
      }
    } catch (parentError) {
      console.log(`[listFilesInFolder] Error checking parent directory:`, parentError.message);
    }
  }

  // Try to use the exact folder name from directory listing if the original doesn't work
  let actualFolderPath = folderPath;
  if (!fs.existsSync(folderPath)) {
    console.log(`[listFilesInFolder] Original path doesn't exist, trying to find exact match...`);
    
    try {
      const assetsDir = path.join(__dirname, "../assets");
      const allFolders = fs.readdirSync(assetsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      // Find exact match (including any hidden characters)
      const exactMatchFolder = allFolders.find(folder => 
        folder.trim().replace(/[\r\n]/g, '') === cleanFoldername
      );
      
      if (exactMatchFolder) {
        // 실제 폴더명을 그대로 사용 (특수문자 포함)
        actualFolderPath = path.join(__dirname, "../assets", exactMatchFolder);
        const cleanExactMatchFolder = exactMatchFolder.trim().replace(/[\r\n]/g, '');
        console.log(`[listFilesInFolder] Found exact match folder: "${exactMatchFolder}"`);
        console.log(`[listFilesInFolder] Cleaned folder name: "${cleanExactMatchFolder}"`);
        console.log(`[listFilesInFolder] New folder path: "${actualFolderPath}"`);
        console.log(`[listFilesInFolder] New path exists: ${fs.existsSync(actualFolderPath)}`);
      }
    } catch (error) {
      console.log(`[listFilesInFolder] Error finding exact match:`, error.message);
    }
  }

  if (fs.existsSync(actualFolderPath)) {
    console.log(`[listFilesInFolder] Using folder path: "${actualFolderPath}"`);
    // 이미지 파일 목록 가져오기
    const files = fs
      .readdirSync(actualFolderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => dirent.name)
      .filter((file) => {
        const fileExtension = path.extname(file).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".gif"].includes(fileExtension);
      });

    // metadata.json 파일 읽기
    const metadataPath = path.join(actualFolderPath, "metadata.json");
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
    console.log(`[listFilesInFolder] Returning ${files.length} files for folder "${foldername}"`);
    
    // 원본 폴더명 찾기 (특수문자 포함)
    const originalFolderName = path.basename(actualFolderPath);
    
    res.json({ files, metadata, originalFolderName });
  } else {
    console.log(`[listFilesInFolder] Folder not found: "${actualFolderPath}"`);
    
    // 사용 가능한 폴더 목록을 포함한 404 응답
    try {
      const assetsDir = path.join(__dirname, "../assets");
      const availableFolders = fs.readdirSync(assetsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name.trim().replace(/[\r\n]/g, '')); // 줄바꿈 제거
      
      res.status(404).json({
        error: "Folder not found",
        requestedFolder: foldername,
        cleanRequestedFolder: cleanFoldername,
        originalFolderPath: folderPath,
        actualFolderPath: actualFolderPath,
        availableFolders: availableFolders
      });
    } catch (error) {
      res.status(404).json({
        error: "Folder not found",
        requestedFolder: foldername,
        cleanRequestedFolder: cleanFoldername,
        originalFolderPath: folderPath,
        actualFolderPath: actualFolderPath,
        message: "Could not read assets directory"
      });
    }
  }
}

// Function to serve a specific file from a folder
function serveFileFromFolder(req, res) {
  const foldername = decodeURIComponent(req.params.foldername);
  const filename = decodeURIComponent(req.params.filename);
  
  // 실제 폴더명 찾기 (특수문자 포함)
  let actualFolderPath = path.join(__dirname, "../assets", foldername);
  
  // 폴더가 존재하지 않으면 원본 폴더명 찾기
  if (!fs.existsSync(actualFolderPath)) {
    try {
      const assetsDir = path.join(__dirname, "../assets");
      const allFolders = fs.readdirSync(assetsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      // cleanFoldername과 일치하는 폴더 찾기
      const cleanFoldername = foldername.trim().replace(/[\r\n]/g, '');
      const exactMatchFolder = allFolders.find(folder => 
        folder.trim().replace(/[\r\n]/g, '') === cleanFoldername
      );
      
      if (exactMatchFolder) {
        actualFolderPath = path.join(__dirname, "../assets", exactMatchFolder);
      }
    } catch (error) {
      console.log(`[serveFileFromFolder] Error finding exact folder match:`, error);
    }
  }
  
  const absolutePath = path.join(actualFolderPath, filename);

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
  
  // 클라이언트 연결 상태 모니터링
  req.on('close', () => {
    console.log(`[${requestId}] Client connection closed`);
  });
  
  req.on('aborted', () => {
    console.log(`[${requestId}] Client request aborted`);
  });
  
  res.on('close', () => {
    console.log(`[${requestId}] Response connection closed`);
  });
  
  try {
    const { userid, taskid, ...otherFields } = req.body;
    console.log(`[${requestId}] Extracted userid: ${userid}`);
    console.log(`[${requestId}] Extracted taskid: ${taskid}`);
    console.log(`[${requestId}] Other fields:`, JSON.stringify(otherFields, null, 2));
    
    // taskid에서 특수문자 제거 (줄바꿈, 캐리지 리턴 등)
    const cleanTaskId = taskid ? taskid.trim().replace(/[\r\n\t]/g, '') : '';
    console.log(`[${requestId}] Original taskid: "${taskid}"`);
    console.log(`[${requestId}] Cleaned taskid: "${cleanTaskId}"`);
    
    if (!cleanTaskId) {
      console.log(`[${requestId}] ERROR: Empty or invalid task ID after cleaning`);
      return res.status(400).json({ code: "0", result: "Invalid task ID" });
    }
    
    // req.files는 배열 형태로 옵니다 (upload.any() 사용 시)
    console.log(`[${requestId}] All uploaded files:`, req.files);
    
    // ZIP 파일 찾기 (fieldname이 zipdata이거나, mimetype이 zip이거나, 확장자가 zip인 파일)
    const uploadedFile = req.files && req.files.find(f => 
      f.fieldname === 'zipdata' || 
      f.mimetype === 'application/zip' || 
      f.originalname?.toLowerCase().endsWith('.zip')
    );
    
    if (!uploadedFile) {
      console.log(`[${requestId}] ERROR: No ZIP file uploaded`);
      console.log(`[${requestId}] Available files:`, req.files?.map(f => ({ fieldname: f.fieldname, mimetype: f.mimetype, originalname: f.originalname })));
      return res.status(400).json({ code: "0", result: "No ZIP file uploaded" });
    }
    
    console.log(`[${requestId}] Uploaded file info:`, {
      originalname: uploadedFile.originalname,
      filename: uploadedFile.filename,
      path: uploadedFile.path,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    });
    
    const taskDir = path.join(IF_DIRECTORY, cleanTaskId);
    console.log(`[${requestId}] Task directory path: ${taskDir}`);
    console.log(`[${requestId}] IF_DIRECTORY: ${IF_DIRECTORY}`);

    // 디렉토리 존재 확인 및 생성
    if (!fs.existsSync(taskDir)) {
      console.log(`[${requestId}] Directory does not exist, creating: ${taskDir}`);
      try {
        fs.mkdirSync(taskDir, { recursive: true });
        console.log(`[${requestId}] Directory created successfully`);
        
        // 디렉토리가 실제로 생성되었는지 확인
        if (!fs.existsSync(taskDir)) {
          throw new Error('Directory creation failed - directory does not exist after creation');
        }
      } catch (dirError) {
        console.log(`[${requestId}] ERROR creating directory:`, dirError);
        throw new Error(`Failed to create directory: ${dirError.message}`);
      }
    } else {
      console.log(`[${requestId}] Directory already exists: ${taskDir}`);
    }

    const zipFilePath = uploadedFile.path;
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
      let pendingWrites = 0;
      let entriesProcessed = 0;
      let totalEntries = 0;
      let parserFinished = false;
      
      let lastEntryTime = Date.now();
      let completionTimer = null;
      
      const checkCompletion = () => {
        console.log(`[${requestId}] Checking completion: pendingWrites=${pendingWrites}, parserFinished=${parserFinished}, entriesProcessed=${entriesProcessed}, totalEntries=${totalEntries}`);
        
        // 파서가 완료되고 대기 중인 쓰기가 없으면 완료
        if (parserFinished && pendingWrites === 0) {
          if (completionTimer) clearTimeout(completionTimer);
          console.log(`[${requestId}] ZIP extraction completed (parser finished)`);
          console.log(`[${requestId}] Total entries processed: ${entriesProcessed}`);
          console.log(`[${requestId}] Total files extracted: ${extractedFiles.length}`);
          console.log(`[${requestId}] Extraction errors: ${extractionErrors.length}`);
          
          if (extractionErrors.length > 0) {
            console.log(`[${requestId}] Extraction errors details:`, extractionErrors);
          }
          
          resolve();
          return;
        }
        
        // 파서가 완료되지 않았지만 모든 쓰기가 완료되고 5초간 새 엔트리가 없으면 완료로 간주
        if (!parserFinished && pendingWrites === 0) {
          if (completionTimer) clearTimeout(completionTimer);
          completionTimer = setTimeout(() => {
            console.log(`[${requestId}] ZIP extraction completed (timeout - no new entries for 5 seconds)`);
            console.log(`[${requestId}] Total entries processed: ${entriesProcessed}`);
            console.log(`[${requestId}] Total files extracted: ${extractedFiles.length}`);
            console.log(`[${requestId}] Extraction errors: ${extractionErrors.length}`);
            
            if (extractionErrors.length > 0) {
              console.log(`[${requestId}] Extraction errors details:`, extractionErrors);
            }
            
            parserFinished = true; // 강제로 완료 처리
            resolve();
          }, 5000);
        }
      };
      
      stream.on('error', (err) => {
        console.log(`[${requestId}] Error reading ZIP file:`, err);
        reject(err);
      });
      
      stream.on('end', () => {
        console.log(`[${requestId}] ZIP file stream ended`);
      });
      
      stream.on('close', () => {
        console.log(`[${requestId}] ZIP file stream closed`);
      });
      
      const parser = unzipper.Parse();
      
      parser.on('close', () => {
        console.log(`[${requestId}] ZIP parser closed`);
        if (!parserFinished) {
          console.log(`[${requestId}] Parser closed without finish event, marking as finished`);
          parserFinished = true;
          checkCompletion();
        }
      });
      
      parser.on('end', () => {
        console.log(`[${requestId}] ZIP parser ended`);
      });
      
      stream.pipe(parser)
        .on("entry", (entry) => {
          totalEntries++;
          lastEntryTime = Date.now();
          if (completionTimer) {
            clearTimeout(completionTimer);
            completionTimer = null;
          }
          
          const fileName = path.basename(entry.path);
          const fileType = entry.type;
          const fileSize = entry.size;
          
          console.log(`[${requestId}] Processing entry ${totalEntries}:`, {
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
            
            pendingWrites++;
            const writeStream = fs.createWriteStream(fullPath);
            
            writeStream.on('error', (err) => {
              console.log(`[${requestId}] Error writing file ${fileName}:`, err);
              extractionErrors.push({ fileName, error: err.message });
              pendingWrites--;
              checkCompletion();
            });
            
            writeStream.on("finish", () => {
              console.log(`[${requestId}] File extracted successfully: ${fullPath}`);
              
              // 추출된 파일 정보 확인
              try {
                if (fs.existsSync(fullPath)) {
                  const extractedStats = fs.statSync(fullPath);
                  console.log(`[${requestId}] Extracted file size: ${extractedStats.size} bytes`);
                  extractedFiles.push({
                    fileName,
                    fullPath,
                    size: extractedStats.size
                  });
                }
              } catch (statError) {
                console.log(`[${requestId}] Error reading file stats for ${fileName}:`, statError);
              }
              
              pendingWrites--;
              entriesProcessed++;
              checkCompletion();
            });
            
            entry.pipe(writeStream);
          } else {
            console.log(`[${requestId}] Skipping file (not allowed type or not a file): ${fileName}, type: ${fileType}`);
            entry.autodrain();
            entriesProcessed++;
          }
        })
        .on("finish", () => {
          console.log(`[${requestId}] ZIP parser finished. Total entries: ${totalEntries}`);
          parserFinished = true;
          checkCompletion();
        })
        .on("error", (err) => {
          console.log(`[${requestId}] Error during ZIP parsing:`, err);
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
    
    // 폴더명을 기반으로 cancer_type과 folder_name 자동 분류
    console.log(`[${requestId}] Analyzing folder for classification: ${cleanTaskId}`);
    const { cancer, folder } = extractCancerAndFolder(cleanTaskId);
    console.log(`[${requestId}] Classification result - Cancer: ${cancer}, Folder: ${folder}`);
    
    const metadata = {
      userid,
      taskid: cleanTaskId, // 정리된 taskid 사용
      originalTaskid: taskid, // 원본 taskid도 기록
      cancer_type: cancer, // 자동 분류된 cancer type
      folder_name: folder, // 자동 분류된 folder name
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
      if (!fs.existsSync(taskDir)) {
        throw new Error(`Task directory does not exist: ${taskDir}`);
      }
      
      const dirContents = fs.readdirSync(taskDir);
      console.log(`[${requestId}] Final directory contains ${dirContents.length} files:`);
      
      if (dirContents.length === 0) {
        console.log(`[${requestId}] WARNING: Directory is empty after extraction`);
      }
      
      dirContents.forEach(file => {
        try {
          const filePath = path.join(taskDir, file);
          const stats = fs.statSync(filePath);
          console.log(`[${requestId}] - ${file} (${stats.size} bytes)`);
        } catch (fileError) {
          console.log(`[${requestId}] - ${file} (ERROR reading stats: ${fileError.message})`);
        }
      });
      
      // 필수 파일들 확인
      const hasMetadata = dirContents.includes('metadata.json');
      const hasImages = dirContents.some(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
      
      console.log(`[${requestId}] File verification:`);
      console.log(`[${requestId}] - metadata.json exists: ${hasMetadata}`);
      console.log(`[${requestId}] - image files exist: ${hasImages}`);
      
      if (!hasMetadata) {
        console.log(`[${requestId}] WARNING: metadata.json not found in directory`);
      }
      
      if (!hasImages) {
        console.log(`[${requestId}] WARNING: No image files found in directory`);
      }
      
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
