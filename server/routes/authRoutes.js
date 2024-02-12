const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 설정을 가정
const bcrypt = require("bcryptjs"); // 비밀번호 해싱을 위한 bcryptjs

// 로그인 페이지 렌더링
router.get("/login", (req, res) => {
  // 로그인 페이지를 렌더링하는 로직
  res.sendFile(path.join(__dirname, "../views", "login.html"));
});

// 로그인 처리
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = "SELECT * FROM users WHERE username = ?";
    const [user] = await db.query(query, [username]);

    if (user.length > 0 && bcrypt.compareSync(password, user[0].password)) {
      // 세션 설정
      req.session.user = { id: user[0].id, username: user[0].username };
      res.redirect("/profile");
    } else {
      res.send("Invalid username or password.");
    }
  } catch (error) {
    res.status(500).send("Server error during login.");
  }
});

// 로그아웃 처리
router.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

// 회원가입 페이지 렌더링
router.get("/signup", (req, res) => {
  // 회원가입 페이지를 렌더링하는 로직
  res.sendFile(path.join(__dirname, "../views", "signup.html"));
});

// 회원가입 처리
router.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);

  try {
    const insertQuery = "INSERT INTO users (username, password) VALUES (?, ?)";
    await db.query(insertQuery, [username, hashedPassword]);
    res.send("User registered successfully.");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.send("Username already exists.");
    } else {
      res.status(500).send("Server error during registration.");
    }
  }
});

module.exports = router;
