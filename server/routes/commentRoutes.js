const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 설정을 가정

// 댓글 조회
router.get("/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const query =
      "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC";
    const comments = await db.query(query, [postId]);
    res.json(comments);
  } catch (error) {
    res.status(500).send("댓글 조회 중 오류가 발생했습니다.");
  }
});

// 댓글 추가
router.post("/", async (req, res) => {
  const { postId, userId, content } = req.body;
  try {
    const query =
      "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())";
    await db.query(query, [postId, userId, content]);
    res.status(201).send("댓글이 성공적으로 추가되었습니다.");
  } catch (error) {
    res.status(500).send("댓글 추가 중 오류가 발생했습니다.");
  }
});

// 댓글 수정
router.put("/:commentId", async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  try {
    const query = "UPDATE comments SET content = ? WHERE id = ?";
    await db.query(query, [content, commentId]);
    res.send("댓글이 성공적으로 수정되었습니다.");
  } catch (error) {
    res.status(500).send("댓글 수정 중 오류가 발생했습니다.");
  }
});

// 댓글 삭제
router.delete("/:commentId", async (req, res) => {
  const { commentId } = req.params;
  try {
    const query = "DELETE FROM comments WHERE id = ?";
    await db.query(query, [commentId]);
    res.send("댓글이 성공적으로 삭제되었습니다.");
  } catch (error) {
    res.status(500).send("댓글 삭제 중 오류가 발생했습니다.");
  }
});

module.exports = router;
