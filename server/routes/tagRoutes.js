// tagRoutes.js
// 태그 관리 API 라우트 (해시태그 방식)

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");

const router = express.Router();

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send({ message, error: error.message });
};

// ========================================
// 태그 API
// ========================================

// GET /api/tags - 태그 목록 (자동완성용)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { q } = req.query; // 검색어 (선택)

    let query = `
      SELECT t.id, t.name, t.color,
             (SELECT COUNT(*) FROM assignment_tags at WHERE at.tag_id = t.id) +
             (SELECT COUNT(*) FROM consensus_assignment_tags cat WHERE cat.tag_id = t.id) as usage_count
      FROM tags t
      WHERE t.deleted_at IS NULL
    `;
    const params = [];

    if (q) {
      query += ` AND t.name LIKE ?`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY usage_count DESC, t.name ASC LIMIT 50`;

    const [tags] = await db.query(query, params);
    res.json(tags);
  } catch (error) {
    handleError(res, "태그 목록 조회 중 오류 발생", error);
  }
});

// POST /api/tags - 태그 생성 (또는 기존 태그 반환)
router.post("/", authenticateToken, async (req, res) => {
  const { name, color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "태그 이름은 필수입니다." });
  }

  const tagName = name.trim().toLowerCase().replace(/^#/, ""); // # 제거, 소문자화

  try {
    // 기존 태그 확인
    const [existing] = await db.query(
      `SELECT id, name, color FROM tags WHERE name = ? AND deleted_at IS NULL`,
      [tagName]
    );

    if (existing.length > 0) {
      // 기존 태그 반환
      return res.json(existing[0]);
    }

    // 새 태그 생성
    const [result] = await db.query(
      `INSERT INTO tags (name, color) VALUES (?, ?)`,
      [tagName, color || "#666666"]
    );

    res.status(201).json({
      id: result.insertId,
      name: tagName,
      color: color || "#666666",
    });
  } catch (error) {
    handleError(res, "태그 생성 중 오류 발생", error);
  }
});

// POST /api/tags/bulk - 여러 태그 일괄 생성/조회
router.post("/bulk", authenticateToken, async (req, res) => {
  const { names } = req.body; // ["brst", "pilot-01", ...]

  if (!names || !Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ message: "태그 이름 배열이 필요합니다." });
  }

  try {
    const result = [];

    for (const name of names) {
      const tagName = name.trim().toLowerCase().replace(/^#/, "");
      if (!tagName) continue;

      // 기존 태그 확인
      const [existing] = await db.query(
        `SELECT id, name, color FROM tags WHERE name = ? AND deleted_at IS NULL`,
        [tagName]
      );

      if (existing.length > 0) {
        result.push(existing[0]);
      } else {
        // 새 태그 생성
        const [insertResult] = await db.query(
          `INSERT INTO tags (name) VALUES (?)`,
          [tagName]
        );
        result.push({
          id: insertResult.insertId,
          name: tagName,
          color: "#666666",
        });
      }
    }

    res.json(result);
  } catch (error) {
    handleError(res, "태그 일괄 생성 중 오류 발생", error);
  }
});

// PUT /api/tags/:id - 태그 수정 (색상 등)
router.put("/:tagId", authenticateToken, async (req, res) => {
  const { tagId } = req.params;
  const { color } = req.body;

  try {
    await db.query(
      `UPDATE tags SET color = ? WHERE id = ? AND deleted_at IS NULL`,
      [color || "#666666", tagId]
    );

    res.json({ message: "태그가 수정되었습니다." });
  } catch (error) {
    handleError(res, "태그 수정 중 오류 발생", error);
  }
});

// DELETE /api/tags/:id - 태그 삭제
router.delete("/:tagId", authenticateToken, async (req, res) => {
  const { tagId } = req.params;

  try {
    await db.query(`UPDATE tags SET deleted_at = NOW() WHERE id = ?`, [tagId]);

    res.json({ message: "태그가 삭제되었습니다." });
  } catch (error) {
    handleError(res, "태그 삭제 중 오류 발생", error);
  }
});

// ========================================
// 과제 태그 연결 API
// ========================================

// GET /api/tags/assignment/:assignmentId - 과제의 태그 목록
router.get("/assignment/:assignmentId", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;

  try {
    const [tags] = await db.query(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN assignment_tags at ON t.id = at.tag_id
       WHERE at.assignment_id = ? AND t.deleted_at IS NULL`,
      [assignmentId]
    );

    res.json(tags);
  } catch (error) {
    handleError(res, "과제 태그 조회 중 오류 발생", error);
  }
});

// PUT /api/tags/assignment/:assignmentId - 과제 태그 설정 (전체 교체)
router.put("/assignment/:assignmentId", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  const { tagIds } = req.body; // [1, 2, 3, ...]

  try {
    // 기존 태그 연결 삭제
    await db.query(`DELETE FROM assignment_tags WHERE assignment_id = ?`, [
      assignmentId,
    ]);

    // 새 태그 연결
    if (tagIds && tagIds.length > 0) {
      const values = tagIds.map((tagId) => [assignmentId, tagId]);
      await db.query(
        `INSERT INTO assignment_tags (assignment_id, tag_id) VALUES ?`,
        [values]
      );
    }

    res.json({ message: "과제 태그가 설정되었습니다." });
  } catch (error) {
    handleError(res, "과제 태그 설정 중 오류 발생", error);
  }
});

// POST /api/tags/assignment/:assignmentId/add - 과제에 태그 추가 (기존 유지)
router.post("/assignment/:assignmentId/add", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  const { tags } = req.body; // ["tag1", "tag2", ...]

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ message: "태그 배열이 필요합니다." });
  }

  try {
    for (const name of tags) {
      const tagName = name.trim().toLowerCase().replace(/^#/, "");
      if (!tagName) continue;

      // 태그 존재 확인 또는 생성
      let [existing] = await db.query(
        `SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL`,
        [tagName]
      );

      let tagId;
      if (existing.length > 0) {
        tagId = existing[0].id;
      } else {
        const [insertResult] = await db.query(
          `INSERT INTO tags (name) VALUES (?)`,
          [tagName]
        );
        tagId = insertResult.insertId;
      }

      // 이미 연결되어 있는지 확인
      const [linked] = await db.query(
        `SELECT * FROM assignment_tags WHERE assignment_id = ? AND tag_id = ?`,
        [assignmentId, tagId]
      );

      if (linked.length === 0) {
        await db.query(
          `INSERT INTO assignment_tags (assignment_id, tag_id) VALUES (?, ?)`,
          [assignmentId, tagId]
        );
      }
    }

    res.json({ message: "태그가 추가되었습니다." });
  } catch (error) {
    handleError(res, "태그 추가 중 오류 발생", error);
  }
});

// ========================================
// 합의과제 태그 연결 API
// ========================================

// GET /api/tags/consensus/:consensusId - 합의과제의 태그 목록
router.get("/consensus/:consensusId", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;

  try {
    const [tags] = await db.query(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN consensus_assignment_tags cat ON t.id = cat.tag_id
       WHERE cat.consensus_assignment_id = ? AND t.deleted_at IS NULL`,
      [consensusId]
    );

    res.json(tags);
  } catch (error) {
    handleError(res, "합의과제 태그 조회 중 오류 발생", error);
  }
});

// PUT /api/tags/consensus/:consensusId - 합의과제 태그 설정
router.put("/consensus/:consensusId", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;
  const { tagIds } = req.body;

  try {
    await db.query(
      `DELETE FROM consensus_assignment_tags WHERE consensus_assignment_id = ?`,
      [consensusId]
    );

    if (tagIds && tagIds.length > 0) {
      const values = tagIds.map((tagId) => [consensusId, tagId]);
      await db.query(
        `INSERT INTO consensus_assignment_tags (consensus_assignment_id, tag_id) VALUES ?`,
        [values]
      );
    }

    res.json({ message: "합의과제 태그가 설정되었습니다." });
  } catch (error) {
    handleError(res, "합의과제 태그 설정 중 오류 발생", error);
  }
});

// POST /api/tags/consensus/:consensusId/add - 합의과제에 태그 추가 (기존 유지)
router.post("/consensus/:consensusId/add", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;
  const { tags } = req.body; // ["tag1", "tag2", ...]

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ message: "태그 배열이 필요합니다." });
  }

  try {
    for (const name of tags) {
      const tagName = name.trim().toLowerCase().replace(/^#/, "");
      if (!tagName) continue;

      // 태그 존재 확인 또는 생성
      let [existing] = await db.query(
        `SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL`,
        [tagName]
      );

      let tagId;
      if (existing.length > 0) {
        tagId = existing[0].id;
      } else {
        const [insertResult] = await db.query(
          `INSERT INTO tags (name) VALUES (?)`,
          [tagName]
        );
        tagId = insertResult.insertId;
      }

      // 이미 연결되어 있는지 확인
      const [linked] = await db.query(
        `SELECT * FROM consensus_assignment_tags WHERE consensus_assignment_id = ? AND tag_id = ?`,
        [consensusId, tagId]
      );

      if (linked.length === 0) {
        await db.query(
          `INSERT INTO consensus_assignment_tags (consensus_assignment_id, tag_id) VALUES (?, ?)`,
          [consensusId, tagId]
        );
      }
    }

    res.json({ message: "태그가 추가되었습니다." });
  } catch (error) {
    handleError(res, "태그 추가 중 오류 발생", error);
  }
});

module.exports = router;
