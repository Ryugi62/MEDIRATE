const express = require("express");
const router = express.Router();
const db = require("../db"); // 데이터베이스 연결 설정을 가정

// 모든 게시글 조회
router.get("/", async (req, res) => {
  try {
    const query = "SELECT * FROM board ORDER BY wdate DESC";
    const [posts] = await db.query(query);
    res.json(posts);
  } catch (error) {
    res.status(500).send("게시글 조회 중 오류가 발생했습니다.");
  }
});

router.get("/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    const query = `
      SELECT 
        b.id AS post_id,
        b.title AS post_title,
        b.content AS post_content,
        b.writer AS post_author,
        b.wdate AS post_created_at,
        c.id AS comment_id,
        c.username AS comment_author,
        c.content AS comment_content,
        c.created_at AS comment_created_at,
        c.parent_comment_id
      FROM 
        board AS b
      LEFT JOIN 
        comments AS c ON b.id = c.post_id
      WHERE
        b.id = ?
      ORDER BY 
        c.id;
    `;

    const [results] = await db.query(query, [postId]);

    // Step 1: Initialize a map to hold comments and their replies
    let commentsMap = new Map();
    results.forEach((row) => {
      if (row.comment_id !== null) {
        commentsMap.set(row.comment_id, {
          id: row.comment_id,
          text: row.comment_content,
          author: row.comment_author,
          date: row.comment_created_at,
          replies: [],
          parentCommentId: row.parent_comment_id, // Keep track of the parent ID
        });
      }
    });

    // Step 2: Nest replies under their parent comments
    commentsMap.forEach((comment, commentId) => {
      if (comment.parentCommentId) {
        let parent = commentsMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(comment);
          commentsMap.delete(commentId); // Remove the reply from the top level
        }
      }
    });

    // Convert the map back to an array for the response
    let commentsData = Array.from(commentsMap.values());

    let postData =
      results.length > 0
        ? {
            title: results[0].post_title,
            author: results[0].post_author,
            content: results[0].post_content,
            lastUpdated: results[0].post_created_at,
            commentsData: commentsData.filter(
              (comment) => !comment.parentCommentId
            ), // Filter out replies at the top level
          }
        : null;

    res.status(200).json(postData);
  } catch (err) {
    console.error("데이터베이스 쿼리 오류:", err);
    res.status(500).json({ error: "서버 오류 발생" });
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

// POST endpoint for adding a new comment to a post
router.post("/comment", async (req, res) => {
  const { postId, username, content } = req.body;

  console.log("jh");

  try {
    const insertQuery = `
      INSERT INTO comments (username, content, post_id)
      VALUES (?, ?, ?)
    `;

    await db.query(insertQuery, [username, content, postId]);

    res.status(201).json({ message: "Comment added successfully" });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/comments/:id", async (req, res) => {
  const { id } = req.params; // The ID of the comment to be updated
  const { content } = req.body; // The new content for the comment

  if (!content) {
    return res.status(400).send({ message: "Content is required." });
  }

  try {
    const updateQuery = `
      UPDATE comments 
      SET content = ?, modified = 1
      WHERE id = ?
    `;
    await db.query(updateQuery, [content, id]);

    res.send({ message: "Comment updated successfully." });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

router.post("/reply", async (req, res) => {
  // Destructure request body to get necessary fields
  const { parentCommentId, username, content } = req.body;

  try {
    // Step 1: Retrieve the post_id for the parent comment
    const parentQuery = `SELECT post_id FROM comments WHERE id = ?`;
    const [parentRows] = await db.query(parentQuery, [parentCommentId]);

    if (parentRows.length > 0) {
      const postId = parentRows[0].post_id;

      // Step 2: Insert the reply with both parent_comment_id and post_id
      const insertQuery = `
        INSERT INTO comments (username, content, parent_comment_id, post_id)
        VALUES (?, ?, ?, ?)
      `;
      await db.query(insertQuery, [username, content, parentCommentId, postId]);

      res.status(201).send({ message: "Reply added successfully." });
    } else {
      res.status(404).send({ message: "Parent comment not found." });
    }
  } catch (error) {
    console.error("Error adding reply:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

module.exports = router;
