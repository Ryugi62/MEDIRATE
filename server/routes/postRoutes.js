const express = require("express");
const router = express.Router();
const db = require("../db"); // 가정: 데이터베이스 연결 설정이 포함된 모듈
const multer = require("multer");
const authenticateToken = require("../jwt");
const fs = require("fs"); // fs 모듈 추가

require("dotenv").config();

// uploads 폴더가 없으면 생성하는 함수
const ensureUploadsDirectoryExists = () => {
  const dir = "./uploads";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureUploadsDirectoryExists(); // uploads 폴더 확인 및 생성
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const decodedFilename = decodeURIComponent(file.originalname); // 파일 이름 디코딩
    cb(null, decodedFilename);
  },
});

const upload = multer({ storage: storage });

router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT
        posts.id,
        posts.title,
        COALESCE(users.username, '탈퇴한 사용자') AS author,
        posts.creation_date AS lastUpdated,
        posts.type
      FROM
        posts
      LEFT JOIN
        users ON posts.user_id = users.id AND users.deleted_at IS NULL
      WHERE
        posts.deleted_at IS NULL
      ORDER BY
        posts.id DESC
    `;
    const [posts] = await db.query(query);

    // 클라이언트에 반환할 데이터 형식으로 변환
    let formattedPosts = posts.map((post) => ({
      id: post.id,
      title: post.title,
      author: post.author,
      lastUpdated: post.lastUpdated,
      type: post.type,
    }));

    // 공지사항과 일반 게시글 분리
    let noticePosts = formattedPosts.filter((post) => post.type === "notice");
    let normalPosts = formattedPosts.filter((post) => post.type !== "notice");

    // 공지사항 게시물에는 [공지] 태그 추가
    noticePosts = noticePosts.map((post) => ({
      ...post,
      title: `[ 공지사항 ] ${post.title}`,
    }));

    // 공지사항이 5개 초과인 경우, 초과하는 공지사항들의 type을 post로 변경
    if (noticePosts.length > 5) {
      const extraNotices = noticePosts
        .slice(5)
        .map((post) => ({ ...post, type: "post" }));
      normalPosts = [...normalPosts, ...extraNotices];
      noticePosts = noticePosts.slice(0, 5);
    }

    // 공지사항을 제외한 나머지 게시물(ID 순)과 초과된 공지사항(이미 type이 post로 변경됨)을 일반 게시물과 합치고 ID 순서대로 정렬
    // 일반 게시물 ID 역순 정렬
    normalPosts.sort((a, b) => b.id - a.id);

    // 최종 배열: 공지사항 맨 앞(최대 5개), 이후 일반 게시물 ID 순
    const result = [...noticePosts, ...normalPosts];

    res.status(200).json(result);
  } catch (error) {
    console.error("게시글 조회 중 오류:", error);
    res.status(500).send("게시글 조회 중 오류가 발생했습니다.");
  }
});

// 특정 게시글 조회
router.get("/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    // 게시물 조회 (삭제되지 않은 것만)
    const postQuery = "SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL";
    const [post] = await db.query(postQuery, [postId]);

    if (!post.length) {
      return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
    }

    // 댓글 조회 (삭제되지 않은 것만)
    const commentsQuery = "SELECT * FROM comments WHERE post_id = ? AND deleted_at IS NULL";
    const [comments] = await db.query(commentsQuery, [postId]);

    // 첨부 파일 조회 (삭제되지 않은 것만)
    const attachmentsQuery = "SELECT * FROM attachments WHERE post_id = ? AND deleted_at IS NULL";
    const [attachments] = await db.query(attachmentsQuery, [postId]);

    // user_id로 username을 가져오기 (탈퇴한 사용자 처리)
    const usernameQuery = "SELECT username FROM users WHERE id = ? AND deleted_at IS NULL";
    const [username] = await db.query(usernameQuery, [post[0].user_id]);
    const authorName = username.length > 0 ? username[0].username : "탈퇴한 사용자";

    // comment.user_id로 username을 가져오기 (탈퇴한 사용자 처리)
    const commentUsernameQuery = "SELECT username FROM users WHERE id = ? AND deleted_at IS NULL";
    for (let i = 0; i < comments.length; i++) {
      const [commentUsername] = await db.query(commentUsernameQuery, [
        comments[i].user_id,
      ]);
      comments[i].user_id = commentUsername.length > 0 ? commentUsername[0].username : "탈퇴한 사용자";
    }

    // 서버 코드 수정
    const formattedPost = {
      id: post[0].id,
      title: post[0].title,
      author: authorName,
      lastUpdated: post[0].creation_date,
      content: post[0].content,
      files: attachments.map((attachment) => ({
        filename: attachment.filename,
        size: attachment.size,
        path: attachment.path,
      })),
      commentsData: [],
    };

    // 댓글과 대댓글을 포스트 데이터로 포맷
    comments.forEach((comment) => {
      if (!comment.parent_comment_id) {
        formattedPost.commentsData.push({
          id: comment.id,
          author: comment.user_id,
          date: comment.created_at,
          text: comment.content,
          replies: [],
        });
      }
    });

    // 대댓글을 부모 댓글의 replies 배열에 추가
    comments.forEach((comment) => {
      if (comment.parent_comment_id) {
        const parentComment = formattedPost.commentsData.find(
          (c) => c.id === comment.parent_comment_id
        );
        if (parentComment) {
          parentComment.replies.push({
            id: comment.id,
            author: comment.user_id,
            date: comment.created_at,
            text: comment.content,
          });
        }
      }
    });

    res.status(200).json(formattedPost);
  } catch (error) {
    console.error("데이터베이스 쿼리 오류:", error);
    res.status(500).json({ error: "서버 오류 발생" });
  }
});

// 게시물 생성
router.post("/", authenticateToken, upload.array("files"), async (req, res) => {
  const { title, content, postType } = req.body;
  const username = req.body.userId; // 클라이언트에서 보낸 사용자 이름
  // 사용자 ID를 데이터베이스에서 조회
  const userQuery = "SELECT id FROM users WHERE username = ?";
  const [users] = await db.query(userQuery, [username]);

  if (users.length === 0) {
    return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  }

  const userId = users[0].id;
  const files = req.files;

  try {
    const postQuery =
      "INSERT INTO posts (user_id, title, content, type) VALUES (?, ?, ?, ?)";
    const [postResult] = await db.query(postQuery, [
      userId,
      title,
      content,
      postType,
    ]);

    // 새로운 게시물의 ID를 가져옵니다.
    const postId = postResult.insertId; // 여기에서 postId를 정의합니다.

    // 파일 정보를 데이터베이스에 삽입합니다.
    if (files) {
      files.forEach(async (file) => {
        const filePath = file.path; // 파일 경로
        const fileQuery =
          "INSERT INTO attachments (post_id, path, filename) VALUES (?, ?, ?)";
        await db.query(fileQuery, [postId, filePath, file.originalname]); // 여기에서 postId를 사용합니다.
      });
    }

    res
      .status(201)
      .json({ message: "게시글 및 파일이 성공적으로 추가되었습니다." });
  } catch (error) {
    console.error("게시글 생성 및 파일 업로드 중 오류:", error);
    res.status(500).json({ error: "게시글 생성 및 파일 업로드 실패" });
  }
});

router.put(
  "/:id",
  authenticateToken,
  upload.array("files"),
  async (req, res) => {
    const postId = req.params.id;
    const { title, content, type } = req.body;

    try {
      // 게시물 업데이트
      const updatePostQuery =
        "UPDATE posts SET title = ?, content = ?, type = ? WHERE id = ?";
      await db.query(updatePostQuery, [title, content, type, postId]);

      // 삭제된 파일 목록 받기
      const deletedFiles = JSON.parse(req.body.deletedFiles || "[]");

      // 기존 첨부파일 정보를 가져옴
      const existingFilesQuery = "SELECT * FROM attachments WHERE post_id = ?";
      const [existingFiles] = await db.query(existingFilesQuery, [postId]);

      // 삭제된 파일 처리
      for (const index of deletedFiles) {
        const deletedFile = existingFiles[index];
        if (deletedFile) {
          const filePath = deletedFile.path;
          // 파일이 존재하는지 확인
          if (fs.existsSync(filePath)) {
            // 데이터베이스에서 파일 레코드 삭제
            const deleteFileQuery = "DELETE FROM attachments WHERE id = ?";
            await db.query(deleteFileQuery, [deletedFile.id]);
            // 파일 시스템에서 파일 삭제
            fs.unlink(filePath, (err) => {
              if (err) {
                console.error("삭제된 파일 삭제 중 오류:", err);
              }
            });
          } else {
            console.error("삭제하려는 파일이 이미 삭제되었습니다:", filePath);
          }
        }
      }

      // 새 파일 업로드
      if (req.files && req.files.length > 0) {
        req.files.forEach(async (file) => {
          const filePath = file.path;
          const fileQuery =
            "INSERT INTO attachments (post_id, path, filename) VALUES (?, ?, ?)";
          await db.query(fileQuery, [postId, filePath, file.originalname]);
        });
      }

      res
        .status(200)
        .json({ message: "게시물이 성공적으로 업데이트되었습니다." });
    } catch (error) {
      console.error("게시물 업데이트 중 오류:", error);
      res.status(500).json({ error: "게시물 업데이트 실패" });
    }
  }
);

// 게시글 삭제 (Soft Delete)
router.delete("/:id", authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 1. 게시글 존재 및 소유권 확인
    const [post] = await db.query(
      "SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL",
      [postId]
    );

    if (!post.length) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }

    // 2. 권한 확인 (본인 또는 admin)
    if (post[0].user_id !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "삭제 권한이 없습니다." });
    }

    // 3. 트랜잭션으로 Soft Delete
    await db.withTransaction(async (conn) => {
      // 첨부파일 soft delete
      await conn.query(
        "UPDATE attachments SET deleted_at = NOW() WHERE post_id = ? AND deleted_at IS NULL",
        [postId]
      );
      // 댓글 soft delete
      await conn.query(
        "UPDATE comments SET deleted_at = NOW() WHERE post_id = ? AND deleted_at IS NULL",
        [postId]
      );
      // 게시글 soft delete
      await conn.query(
        "UPDATE posts SET deleted_at = NOW() WHERE id = ?",
        [postId]
      );
    });

    res.status(200).json({ message: "게시글이 삭제되었습니다." });
  } catch (error) {
    console.error("게시글 삭제 중 오류:", error);
    res.status(500).json({ error: "게시글 삭제 실패" });
  }
});

// 댓글 추가
router.post("/:postId/comments", async (req, res) => {
  const { postId } = req.params;
  const { userId, content } = req.body;

  try {
    const query =
      "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)";
    await db.query(query, [postId, userId, content]);
    res.status(201).json({ message: "댓글이 성공적으로 추가되었습니다." });
  } catch (error) {
    console.error("댓글 추가 중 오류:", error);
    res.status(500).json({ error: "댓글 추가 실패" });
  }
});

router.put(
  "/:id",
  authenticateToken,
  upload.array("files"),
  async (req, res) => {
    const postId = req.params.id;
    const { title, content, type } = req.body;

    try {
      // 게시물 업데이트
      const updatePostQuery =
        "UPDATE posts SET title = ?, content = ?, type = ? WHERE id = ?";
      await db.query(updatePostQuery, [title, content, type, postId]);

      // 기존 첨부파일 정보를 가져옴
      const existingFilesQuery = "SELECT * FROM attachments WHERE post_id = ?";
      const [existingFiles] = await db.query(existingFilesQuery, [postId]);

      // 기존 파일 삭제
      for (const file of existingFiles) {
        const filePath = file.path;
        // 데이터베이스에서 파일 레코드 삭제
        const deleteFileQuery = "DELETE FROM attachments WHERE id = ?";
        await db.query(deleteFileQuery, [file.id]);
        // 파일 시스템에서 파일 삭제
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("기존 파일 삭제 중 오류:", err);
          }
        });
      }

      // 새 파일 업로드
      if (req.files && req.files.length > 0) {
        req.files.forEach(async (file) => {
          const filePath = file.path;
          const fileQuery =
            "INSERT INTO attachments (post_id, path, filename) VALUES (?, ?, ?)";
          await db.query(fileQuery, [postId, filePath, file.originalname]);
        });
      }

      res
        .status(200)
        .json({ message: "게시물이 성공적으로 업데이트되었습니다." });
    } catch (error) {
      console.error("게시물 업데이트 중 오류:", error);
      res.status(500).json({ error: "게시물 업데이트 실패" });
    }
  }
);

// 댓글 삭제 (Soft Delete)
router.delete("/comments/:commentId", authenticateToken, async (req, res) => {
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
