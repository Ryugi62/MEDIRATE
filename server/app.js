// app.js 내에서 라우트 모듈을 가져옵니다.
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const db = require("./db"); // 데이터베이스 설정
const assignmentRoutes = require("./routes/assignmentRoutes");
const authRoutes = require("./routes/authRoutes"); // 파일 이름이 'authoutes.js'에서 'authRoutes.js'로 오타 수정
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
  console.log("Test");
});

// 라우트 사용
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/comments", commentRoutes);

// 홈페이지 라우트 Vue로 build 됨

// 서버 시작
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
