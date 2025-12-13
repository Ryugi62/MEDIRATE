const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 설정을 가정

const authenticateToken = require("../jwt");

// 댓글 조회 (삭제되지 않은 것만)
router.get("/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const query =
      "SELECT * FROM comments WHERE post_id = ? AND deleted_at IS NULL ORDER BY created_at DESC";
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

  try {
    const query =
      "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())";
    await db.query(query, [postId, userId, content]);

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

    res.status(201).send("대댓글이 성공적으로 추가되었습니다.");
  } catch (error) {
    console.error(error);
    res.status(500).send("대댓글 추가 중 오류가 발생했습니다.");
  }
});

// 댓글 수정 (인증 추가)
router.put("/:commentId", authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 댓글 존재 및 소유권 확인
    const [comment] = await db.query(
      "SELECT user_id FROM comments WHERE id = ? AND deleted_at IS NULL",
      [commentId]
    );

    if (!comment.length) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }

    // 권한 확인 (본인 또는 admin)
    if (comment[0].user_id !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "수정 권한이 없습니다." });
    }

    const query = "UPDATE comments SET content = ? WHERE id = ?";
    await db.query(query, [content, commentId]);
    res.send("댓글이 성공적으로 수정되었습니다.");
  } catch (error) {
    res.status(500).send("댓글 수정 중 오류가 발생했습니다.");
  }
});

// 댓글 삭제 (Soft Delete)
router.delete("/:commentId", authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 1. 댓글 존재 및 소유권 확인
    const [comment] = await db.query(
      "SELECT user_id FROM comments WHERE id = ? AND deleted_at IS NULL",
      [commentId]
    );

    if (!comment.length) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }

    // 2. 권한 확인 (본인 또는 admin)
    if (comment[0].user_id !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "삭제 권한이 없습니다." });
    }

    // 3. 트랜잭션으로 Soft Delete (대댓글도 함께)
    await db.withTransaction(async (conn) => {
      // 대댓글 soft delete
      await conn.query(
        "UPDATE comments SET deleted_at = NOW() WHERE parent_comment_id = ? AND deleted_at IS NULL",
        [commentId]
      );
      // 댓글 soft delete
      await conn.query(
        "UPDATE comments SET deleted_at = NOW() WHERE id = ?",
        [commentId]
      );
    });

    res.status(200).json({ message: "댓글이 삭제되었습니다." });
  } catch (error) {
    console.error("댓글 삭제 중 오류:", error);
    res.status(500).json({ error: "댓글 삭제 실패" });
  }
});

module.exports = router;
