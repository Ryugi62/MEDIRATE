const express = require("express");
const router = express.Router();
const db = require("../db"); // 가정: 데이터베이스 연결 모듈

const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error(err);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

// 공통 에러 처리 함수
function handleError(res, message, error) {
  console.error(message, error);
  res.status(500).send(message);
}

// 과제 생성
router.post("/", async (req, res) => {
  try {
    const { title, deadline, selectedAssignmentType, user, questions } =
      req.body;
    const creationDate = new Date();
    const assignmentQuery = `
      INSERT INTO t_assignment (FileName, CreationDate, Deadline, FileType, SelectionStatus, User, isCompleted) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;

    await db.query(assignmentQuery, [
      title,
      creationDate,
      deadline,
      selectedAssignmentType,
      "Unknown",
      user,
      0,
    ]);

    const [lastInsertIdRows] = await db.query(`SELECT LAST_INSERT_ID()`);
    const lastInsertId = lastInsertIdRows[0]["LAST_INSERT_ID()"];

    const itemQuery = `
      INSERT INTO t_assignmentitem (assignmentID, sequence, imageFile, selectedValue) 
      VALUES (?, ?, ?, ?)`;
    for (const question of questions) {
      await db.query(itemQuery, [
        lastInsertId,
        question.id,
        question.img,
        null,
      ]);
    }

    res.status(200).json({ id: lastInsertId });
  } catch (error) {
    handleError(res, "Error saving assignment details", error);
  }
});

// 과제 목록 조회를 위한 라우터
router.get("/", authenticateToken, async (req, res) => {
  const username = req.user.username; // 인증된 유저의 username 추출

  try {
    const query = `
      SELECT 
        a.id, 
        a.FileName AS title, 
        a.CreationDate, 
        a.Deadline AS dueDate, 
        a.FileType, 
        a.SelectionStatus AS status, 
        a.User, 
        a.isCompleted 
      FROM t_assignment a
      WHERE a.User = ?`; // 유저의 username에 따라 과제를 필터링
    const [assignments] = await db.query(query, [username]);
    res.json(assignments);
  } catch (error) {
    handleError(res, "서버 오류로 과제 목록을 불러올 수 없습니다.", error);
  }
});

// 과제 상세 조회
router.get("/:assignmentId", async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await db.query(
      "SELECT * FROM t_assignment WHERE id = ?",
      [assignmentId]
    );
    const questions = await db.query(
      "SELECT * FROM t_assignmentitem WHERE assignmentID = ?",
      [assignmentId]
    );

    res.json({ ...assignment[0][0], questions: questions[0] });
  } catch (error) {
    handleError(res, "Server error", error);
  }
});

// 과제 수정
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { assignmentName, endDate, details } = req.body;
    await db.query(
      `UPDATE assignments SET name = ?, end_date = ?, details = ? WHERE id = ?`,
      [assignmentName, endDate, details, id]
    );
    res.send("과제가 성공적으로 수정되었습니다.");
  } catch (error) {
    handleError(res, "과제 수정 중 오류가 발생했습니다.", error);
  }
});

// 과제 삭제
router.delete("/:id", async (req, res) => {
  try {
    await db.query(`DELETE FROM assignments WHERE id = ?`, [req.params.id]);
    res.send("과제가 성공적으로 삭제되었습니다.");
  } catch (error) {
    handleError(res, "과제 삭제 중 오류가 발생했습니다.", error);
  }
});

// 사용자 목록 조회
router.post("/user-list", async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT username, realname, organization FROM user_credentials WHERE username IS NOT NULL AND realname IS NOT NULL"
    );
    res.json(users);
  } catch (error) {
    handleError(res, "유저 정보를 가져오는 중 오류 발생:", error);
  }
});

// 과제 상세 정보 업데이트
router.post("/update", async (req, res) => {
  try {
    const { id, questions } = req.body;
    const updateQuery = `UPDATE t_assignmentitem SET selectedValue = ? WHERE assignmentID = ? AND sequence = ?`;
    for (const question of questions) {
      await db.query(updateQuery, [
        question.selectedValue,
        id,
        question.sequence,
      ]);
    }
    res
      .status(200)
      .json({ message: "과제 상세 정보가 성공적으로 업데이트되었습니다." });
  } catch (error) {
    handleError(res, "과제 상세 정보 업데이트 중 오류 발생:", error);
  }
});

module.exports = router;
