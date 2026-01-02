const express = require("express");
const db = require("../db");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../jwt");

const router = express.Router();
require("dotenv").config();

function verifyPassword(inputPassword, storedHash) {
  // Replace this with your actual password verification logic
  return inputPassword === storedHash;
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 삭제되지 않은 사용자만 로그인 허용
    const query = "SELECT * FROM users WHERE username = TRIM(?) AND deleted_at IS NULL";
    const [rows] = await db.query(query, [username.trim()]);

    if (rows.length === 0) {
      return res.status(401).send("Invalid username or password.");
    }

    const user = rows[0];
    if (!verifyPassword(password, user.password)) {
      return res.status(401).send("Invalid username or password.");
    }

    const token = jwt.sign(
      { id: user.id, username: user.username.trim(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "20h" }
    );

    const userWithoutPassword = {
      username: user.username.trim(),
      realname: user.realname,
      organization: user.organization,
      role: user.role,
      token: token,
      isAdministrator: user.role === "admin",
    };

    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).send("Server error during login.");
  }
});

router.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).send("Logout error.");
      }
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

router.post("/register", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).send("Unauthorized user.");
  }

  const { username, password, realname, role } = req.body;

  try {
    if (req.user.role !== "admin") {
      return res.status(403).send("Unauthorized user.");
    }

    const query =
      "INSERT INTO users (username, password, realname, organization, role) VALUES (?, ?, ?, ?, ?)";
    await db.query(query, [username, password, realname, null, role]);
    res.status(200).send("success");
  } catch (error) {
    console.error("Server error during register:", error);
    res.status(500).send("Server error during register.");
  }
});

router.get("/user-list", authenticateToken, async (__req, res) => {
  try {
    // 삭제되지 않은 사용자만 조회
    const usersQuery = `SELECT id, username, realname, organization, role FROM users WHERE deleted_at IS NULL`;
    const [users] = await db.query(usersQuery);

    res.status(200).json(users);
  } catch (error) {
    console.error("Unable to fetch user list due to server error:", error);
    res.status(500).send("Unable to fetch user list due to server error.");
  }
});

router.get("/check-user/:username", authenticateToken, async (req, res) => {
  const username = req.params.username;

  try {
    // 삭제되지 않은 사용자 중에서 중복 확인
    const query = "SELECT * FROM users WHERE username = TRIM(?) AND deleted_at IS NULL";
    const [rows] = await db.query(query, [username.trim()]);

    if (rows.length > 0) {
      return res.status(409).send("Duplicate username.");
    }
    res.status(200).send("success");
  } catch (error) {
    console.error("Server error during checkDuplicate:", error);
    res.status(500).send("Server error during checkDuplicate.");
  }
});

router.put("/edit-user/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).send("Unauthorized user.");
  }

  const id = req.params.id;
  const { realname, role, password, passwordMatch } = req.body.userList;

  try {
    const query = "UPDATE users SET realname = ?, role = ? WHERE id = ?";
    await db.query(query, [realname, role, id]);

    if (!password && !passwordMatch) res.status(200).send("success");

    if (password !== passwordMatch)
      res.status(500).send("비밀번호가 일치하지 않습니다.");

    const changePasswordQuery = "UPDATE users SET password = ? WHERE id = ?";
    await db.query(changePasswordQuery, [password, id]);

    res.status(200).send("success");
  } catch (error) {
    console.error("Server error during update user:", error);
    res.status(500).send("Server error during update user.");
  }
});

// 사용자 삭제 (Soft Delete + RESTRICT 검증)
router.delete("/delete-user/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).send("Unauthorized user.");
  }

  const id = req.params.id;

  try {
    // 1. 사용자 존재 확인
    const [user] = await db.query(
      "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL",
      [id]
    );

    if (!user.length) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    // 2. RESTRICT 검증: 관련 평가 데이터 존재 확인
    const [assignments] = await db.query(
      `SELECT COUNT(*) as count FROM assignment_user
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [responses] = await db.query(
      `SELECT COUNT(*) as count FROM question_responses
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [canvasData] = await db.query(
      `SELECT COUNT(*) as count FROM canvas_info
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    // 관련 데이터가 있으면 삭제 차단
    if (assignments[0].count > 0 || responses[0].count > 0 || canvasData[0].count > 0) {
      return res.status(409).json({
        error: "관련 데이터가 있어 삭제할 수 없습니다. 먼저 과제 할당을 해제해주세요.",
        details: {
          assignedTasks: assignments[0].count,
          evaluationResponses: responses[0].count,
          canvasRecords: canvasData[0].count
        }
      });
    }

    // 3. Soft Delete 실행
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = ?", [id]);

    res.status(200).json({ message: "사용자가 삭제되었습니다." });
  } catch (error) {
    console.error("Server error during delete user:", error);
    res.status(500).send("Server error during delete user.");
  }
});

module.exports = router;
