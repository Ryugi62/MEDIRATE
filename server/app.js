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
const dashboardRoutes = require("./routes/dashboardRoutes");
const fs = require("fs");

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
  // is get or post or delete or put
  console.log("Request Type:", req.method);
  next();
});

// Routes setup
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
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

app.get("/api/assets", (req, res) => {
  // assets 폴더의 목록을 보여준다.
  const absolutePath = path.join(__dirname, "../assets");
  // 폴더만 보여주기, 파일은 보여주지 않기 .~~~로 끝나는 파일은 보여주지 않기
  const files = fs.readdirSync(absolutePath); // 폴더와 파일을 모두 보여준다.
  res.json(
    files.filter((file) =>
      fs.lstatSync(path.join(absolutePath, file)).isDirectory()
    )
  );
});

app.get("/api/assets/:foldername", (req, res) => {
  const { foldername } = req.params;
  const absolutePath = path.join(__dirname, "../assets", foldername);

  if (fs.existsSync(absolutePath)) {
    const files = fs.readdirSync(absolutePath);
    // 필터링된 파일 목록만 클라이언트에 응답으로 보낸다.
    res.json(files.filter((file) => !file.startsWith(".")));
  } else {
    res.status(404).send("없음");
  }
});

app.get("/api/assets/:foldername/:filename", (req, res) => {
  // foldername을 확인한 후 파일이 있으면 다운로드, 없으면 없다는 것을 알려준다.
  const { foldername, filename } = req.params;
  const absolutePath = path.join(__dirname, "../assets", foldername, filename);

  if (fs.existsSync(absolutePath)) {
    res.download(absolutePath, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        return res.status(500).send("Failed to download file");
      }
    });
  } else {
    res.status(404).send("없음");
  }
});

// Fallback route for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
