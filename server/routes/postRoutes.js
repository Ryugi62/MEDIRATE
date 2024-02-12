const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 설정을 가정

// 모든 게시글 조회
router.get("/", async (req, res) => {
  try {
    const query = "SELECT * FROM posts ORDER BY created_at DESC";
    const [posts] = await db.query(query);
    res.json(posts);
  } catch (error) {
    res.status(500).send("게시글 조회 중 오류가 발생했습니다.");
  }
});

// 특정 게시글 조회
router.get("/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const query = "SELECT * FROM posts WHERE id = ?";
    const [post] = await db.query(query, [postId]);
    if (post.length > 0) {
      res.json(post[0]);
    } else {
      res.status(404).send("게시글을 찾을 수 없습니다.");
    }
  } catch (error) {
    res.status(500).send("게시글 조회 중 오류가 발생했습니다.");
  }
});

// 게시글 추가
router.post("/", async (req, res) => {
  const { title, content, userId } = req.body;
  try {
    const query =
      "INSERT INTO posts (title, content, user_id, created_at) VALUES (?, ?, ?, NOW())";
    await db.query(query, [title, content, userId]);
    res.status(201).send("게시글이 성공적으로 추가되었습니다.");
  } catch (error) {
    res.status(500).send("게시글 추가 중 오류가 발생했습니다.");
  }
});

// 게시글 수정
router.put("/:postId", async (req, res) => {
  const { postId } = req.params;
  const { title, content } = req.body;
  try {
    const query = "UPDATE posts SET title = ?, content = ? WHERE id = ?";
    await db.query(query, [title, content, postId]);
    res.send("게시글이 성공적으로 수정되었습니다.");
  } catch (error) {
    res.status(500).send("게시글 수정 중 오류가 발생했습니다.");
  }
});

// 게시글 삭제
router.delete("/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const query = "DELETE FROM posts WHERE id = ?";
    await db.query(query, [postId]);
    res.send("게시글이 성공적으로 삭제되었습니다.");
  } catch (error) {
    res.status(500).send("게시글 삭제 중 오류가 발생했습니다.");
  }
});

module.exports = router;
