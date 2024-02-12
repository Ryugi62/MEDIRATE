const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const cors = require("cors");
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

app.get("/api/test", async (req, res) => {
  res.send("API Test Route is working!");
});

// 라우트 사용
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/comments", commentRoutes);

// 홈페이지 라우트 - Vue로 build된 앱을 위한 경로
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
