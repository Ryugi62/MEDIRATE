const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 모듈 가정

// 과제 생성
router.post("/create", async (req, res) => {
  const { assignmentName, endDate, details } = req.body;
  try {
    const query = `INSERT INTO assignments (name, end_date, details) VALUES (?, ?, ?)`;
    await db.query(query, [assignmentName, endDate, details]);
    res.status(201).send("과제가 성공적으로 생성되었습니다.");
  } catch (error) {
    res.status(500).send("과제 생성 중 오류가 발생했습니다.");
  }
});

// 과제 목록 조회
router.get("/", async (req, res) => {
  try {
    const query = `SELECT * FROM assignments`;
    const [assignments] = await db.query(query);
    res.json(assignments);
  } catch (error) {
    res.status(500).send("과제 조회 중 오류가 발생했습니다.");
  }
});

// 과제 상세 조회
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT * FROM assignments WHERE id = ?`;
    const [assignment] = await db.query(query, [id]);
    if (assignment.length) {
      res.json(assignment[0]);
    } else {
      res.status(404).send("과제를 찾을 수 없습니다.");
    }
  } catch (error) {
    res.status(500).send("과제 조회 중 오류가 발생했습니다.");
  }
});

// 과제 수정
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { assignmentName, endDate, details } = req.body;
  try {
    const query = `UPDATE assignments SET name = ?, end_date = ?, details = ? WHERE id = ?`;
    await db.query(query, [assignmentName, endDate, details, id]);
    res.send("과제가 성공적으로 수정되었습니다.");
  } catch (error) {
    res.status(500).send("과제 수정 중 오류가 발생했습니다.");
  }
});

// 과제 삭제
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const query = `DELETE FROM assignments WHERE id = ?`;
    await db.query(query, [id]);
    res.send("과제가 성공적으로 삭제되었습니다.");
  } catch (error) {
    res.status(500).send("과제 삭제 중 오류가 발생했습니다.");
  }
});

module.exports = router;
