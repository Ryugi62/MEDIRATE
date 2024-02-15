const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 설정을 가정

const authenticateToken = require("../jwt");

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
router.post("/", authenticateToken, async (req, res) => {
  const { postId, content } = req.body;
  const userId = req.user.id; // 사용자 토큰으로부터 사용자 ID 가져오기

  console.log("댓글 추가 요청:", postId, userId, content);

  try {
    const query =
      "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())";
    await db.query(query, [postId, userId, content]);

    console.log("댓글 추가 완료");

    res.status(201).send("댓글이 성공적으로 추가되었습니다.");
  } catch (error) {
    res.status(500).send("댓글 추가 중 오류가 발생했습니다.");
  }
});

// 대댓글 추가
router.post("/:postId", authenticateToken, async (req, res) => {
  const { postId } = req.params; // postId와 parentId를 받아옴
  const { parentId, content } = req.body;
  const userId = req.user.id;

  try {
    const query =
      "INSERT INTO comments (post_id, user_id, content, parent_comment_id, created_at) VALUES (?, ?, ?, ?, NOW())";
    await db.query(query, [postId, userId, content, parentId]);

    console.log("대댓글 추가 완료");

    res.status(201).send("대댓글이 성공적으로 추가되었습니다.");
  } catch (error) {
    console.error(error);
    res.status(500).send("대댓글 추가 중 오류가 발생했습니다.");
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
