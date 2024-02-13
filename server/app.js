const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const db = require("./db"); // 데이터베이스 설정
const assignmentRoutes = require("./routes/assignmentRoutes");
const authRoutes = require("./routes/authRoutes");
const commentRoutes = require("./routes/commentRoutes");
const postRoutes = require("./routes/postRoutes");

const app = express();
const port = process.env.SERVER_PORT || 3000;

// 세션 저장소 설정
const sessionStore = new MySQLStore({}, db);

// Express 애플리케이션 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("dist"));
app.use(cors());
app.use("../uploads", express.static("uploads"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// 세션 설정
app.use(
  session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
  })
);

// 접속할때마다 어디에 접속했는지 확인
app.use((req, res, next) => {
  console.log("Request URL:", req.url);
  next();
});

// 라우트 사용
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/comments", commentRoutes);

app.get("/uploads/:filename", (req, res) => {
  const { filename } = req.params;

  // 파일이 저장된 절대 경로 설정
  const absolutePath = path.join(
    __dirname,
    "../uploads",
    filename.split("=")[1]
  );

  // 파일 다운로드
  res.download(absolutePath, (err) => {
    if (err) {
      console.error("Error downloading file:", err);
      res.status(500).send("Failed to download file");
    }
  });
});

// 홈페이지 라우트 - Vue로 build된 앱을 위한 경로
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
