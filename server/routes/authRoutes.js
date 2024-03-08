const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 설정 확인
const jwt = require("jsonwebtoken");
require("dotenv").config(); // 환경 변수 로드

/**
 * 제공된 비밀번호와 저장된 해시를 비교합니다.
 * 실제 프로덕션 사용을 위해 이 부분을 실제 비밀번호 검증 로직으로 교체해야 합니다.
 */
function verifyPassword(inputPassword, storedHash) {
  // 실제 비밀번호 검증 로직을 여기에 구현
  return inputPassword === storedHash;
}

/**
 * 로그인 시도를 처리합니다.
 */
router.get("/", async (req, res) => {
  const { username, password } = req.query;

  try {
    if (!username || !password) {
      return res.status(400).send("Username and password are required.");
    }

    const query = "SELECT * FROM users WHERE username = TRIM(?)";
    const [rows] = await db.query(query, [username.trim()]);

    if (rows.length === 0) {
      return res.status(401).send("Invalid username or password.");
    }

    const user = rows[0];
    if (!verifyPassword(password, user.password)) {
      return res.status(401).send("Invalid username or password.");
    }

    // JWT 생성
    const token = jwt.sign(
      { id: user.id, username: user.username.trim() },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // 사용자를 리다이렉트 URL로 리다이렉트하고, JWT를 쿼리 파라미터로 포함시킵니다.
    // 예를 들어, https://aialpa-eval.duckdns.org/dashboard 경로로 리다이렉트하고 싶다면:
    res.redirect(`https://aialpa-eval.duckdns.org/#/?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).send("Server error during login.");
  }
});



/**
 * 로그인 시도를 처리합니다.
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = "SELECT * FROM users WHERE username = TRIM(?)";
    const [rows] = await db.query(query, [username.trim()]);

    if (rows.length === 0) {
      return res.status(401).send("Invalid username or password.");
    }

    const user = rows[0];
    if (!verifyPassword(password, user.password)) {
      return res.status(401).send("Invalid username or password.");
    }

    // JWT 생성
    const token = jwt.sign(
      { id: user.id, username: user.username.trim() },
      process.env.JWT_SECRET,
      // 만료 5초로 설정
      // { expiresIn: "1h" }
      { expiresIn: "2h" }
    );

    // 사용자 정보와 JWT 함께 반환
    const userWithoutPassword = {
      username: user.username.trim(),
      realname: user.realname,
      organization: user.organization,
      role: user.role,
      token: token, // JWT 추가
    };

    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).send("Server error during login.");
  }
});


/**
 * 로그아웃을 처리하고 로그인 페이지로 리다이렉트합니다.
 */
router.get("/logout", (req, res) => {
  // 세션 사용자가 있는 경우 세션을 파괴하고 로그인 페이지로 리다이렉트
  if (req.session.user) {
    req.session.destroy((err) => {
      if (err) {
        console.error("로그아웃 오류:", err);
        return res.status(500).send("로그아웃 오류.");
      }
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

module.exports = router;
