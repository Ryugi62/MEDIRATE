const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 모듈 가정.

router.post("/", async (req, res) => {
  try {
    const assignmentDetails = req.body;

    // t_assignment 테이블에 데이터 삽입
    const assignmentQuery = `INSERT INTO t_assignment (FileName, CreationDate, Deadline, FileType, SelectionStatus, User, isCompleted) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await db.query(assignmentQuery, [
      assignmentDetails.title,
      new Date(),
      assignmentDetails.deadline,
      assignmentDetails.selectedAssignmentType,
      "Unknown",
      assignmentDetails.user,
      0,
    ]);

    // 마지막으로 추가된 assignment의 ID 가져오기
    const [lastInsertIdRows] = await db.query(`SELECT LAST_INSERT_ID()`);
    const lastInsertId = lastInsertIdRows[0]["LAST_INSERT_ID()"];

    // t_assignmentitem 테이블에 데이터 삽입
    for (const question of assignmentDetails.questions) {
      const itemQuery = `INSERT INTO t_assignmentitem (assignmentID, sequence, imageFile, selectedValue) 
                         VALUES (?, ?, ?, ?)`;
      await db.query(itemQuery, [
        lastInsertId,
        question.id,
        question.img,
        null,
      ]);
    }

    // res.status(200).send("Assignment details saved successfully");
    // 과제 정보 return
    res.status(200).json({ id: lastInsertId });
  } catch (error) {
    console.error("Error saving assignment details:", error);
    res.status(500).send("Error saving assignment details");
  }
});

// 과제 목록 조회
router.get("/", async (req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT 
        a.id, 
        a.FileName AS title, 
        a.CreationDate, 
        a.Deadline AS dueDate, 
        a.SelectionStatus AS status, 
        (SELECT COUNT(*) FROM assignmentuserrelation WHERE AssignmentID = a.id) AS total, 
        (SELECT COUNT(*) FROM assignmentuserrelation WHERE AssignmentID = a.id AND Screening != -1) AS completed 
      FROM t_assignment a
    `);
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

router.get("/:assignmentId", async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const [assignment] = await db.query(
      "SELECT * FROM t_assignment WHERE id = ?",
      [assignmentId]
    );

    const [questions] = await db.query(
      "SELECT * FROM t_assignmentitem WHERE assignmentID = ?",
      [assignmentId]
    );

    const assignmentData = {
      ...assignment[0],
      questions,
    };

    res.json(assignmentData);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
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

router.post("/user-list", async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT username, realname, organization FROM user_credentials WHERE username IS NOT NULL AND realname IS NOT NULL"
    );

    res.json(users);
  } catch (error) {
    console.error("유저 정보를 가져오는 중 오류 발생:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 과제 상세 정보 업데이트 (선택된 값 포함)
router.post("/update", async (req, res) => {
  try {
    const { id, questions } = req.body; // 과제 ID 및 질문 목록을 요청 본문에서 추출

    console.log("과제 ID:", id);
    console.log("질문 목록:", questions);

    // 각 질문에 대해 선택된 값을 업데이트
    for (const question of questions) {
      const updateQuery = `UPDATE t_assignmentitem SET selectedValue = ? WHERE assignmentID = ? AND sequence = ?`;
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
    console.error("과제 상세 정보 업데이트 중 오류 발생:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
