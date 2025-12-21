// projectRoutes.js
// 프로젝트 및 암종 관리 API 라우트

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");

const router = express.Router();

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send({ message, error: error.message });
};

// ========================================
// 프로젝트 API
// ========================================

// GET /api/projects - 프로젝트 목록
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [projects] = await db.query(
      `SELECT p.id, p.name, p.description, p.created_by, p.creation_date,
              u.realname as creator_name,
              (SELECT COUNT(*) FROM assignments a WHERE a.project_id = p.id AND a.deleted_at IS NULL) as assignment_count,
              (SELECT COUNT(*) FROM consensus_assignments ca WHERE ca.project_id = p.id AND ca.deleted_at IS NULL) as consensus_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.deleted_at IS NULL
       ORDER BY p.creation_date DESC`
    );

    res.json(projects);
  } catch (error) {
    handleError(res, "프로젝트 목록 조회 중 오류 발생", error);
  }
});

// POST /api/projects - 프로젝트 생성
router.post("/", authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  const createdBy = req.user.id;

  if (!name) {
    return res.status(400).json({ message: "프로젝트 이름은 필수입니다." });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO projects (name, description, created_by)
       VALUES (?, ?, ?)`,
      [name, description || null, createdBy]
    );

    res.status(201).json({
      message: "프로젝트가 생성되었습니다.",
      projectId: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "이미 존재하는 프로젝트 이름입니다." });
    }
    handleError(res, "프로젝트 생성 중 오류 발생", error);
  }
});

// PUT /api/projects/:id - 프로젝트 수정
router.put("/:projectId", authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: "프로젝트 이름은 필수입니다." });
  }

  try {
    await db.query(
      `UPDATE projects SET name = ?, description = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [name, description || null, projectId]
    );

    res.json({ message: "프로젝트가 수정되었습니다." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "이미 존재하는 프로젝트 이름입니다." });
    }
    handleError(res, "프로젝트 수정 중 오류 발생", error);
  }
});

// DELETE /api/projects/:id - 프로젝트 삭제
router.delete("/:projectId", authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    await db.query(
      `UPDATE projects SET deleted_at = NOW() WHERE id = ?`,
      [projectId]
    );

    res.json({ message: "프로젝트가 삭제되었습니다." });
  } catch (error) {
    handleError(res, "프로젝트 삭제 중 오류 발생", error);
  }
});

// ========================================
// 암종 API
// ========================================

// GET /api/projects/cancer-types - 암종 목록
router.get("/cancer-types", authenticateToken, async (req, res) => {
  try {
    const [cancerTypes] = await db.query(
      `SELECT id, code, name_ko, name_en
       FROM cancer_types
       WHERE deleted_at IS NULL
       ORDER BY code`
    );

    res.json(cancerTypes);
  } catch (error) {
    handleError(res, "암종 목록 조회 중 오류 발생", error);
  }
});

// POST /api/projects/cancer-types - 암종 생성
router.post("/cancer-types", authenticateToken, async (req, res) => {
  const { code, name_ko, name_en } = req.body;

  if (!code || !name_ko) {
    return res.status(400).json({ message: "암종 코드와 한글명은 필수입니다." });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO cancer_types (code, name_ko, name_en)
       VALUES (?, ?, ?)`,
      [code, name_ko, name_en || null]
    );

    res.status(201).json({
      message: "암종이 생성되었습니다.",
      cancerTypeId: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "이미 존재하는 암종 코드입니다." });
    }
    handleError(res, "암종 생성 중 오류 발생", error);
  }
});

// PUT /api/projects/cancer-types/:id - 암종 수정
router.put("/cancer-types/:cancerTypeId", authenticateToken, async (req, res) => {
  const { cancerTypeId } = req.params;
  const { code, name_ko, name_en } = req.body;

  if (!code || !name_ko) {
    return res.status(400).json({ message: "암종 코드와 한글명은 필수입니다." });
  }

  try {
    await db.query(
      `UPDATE cancer_types SET code = ?, name_ko = ?, name_en = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [code, name_ko, name_en || null, cancerTypeId]
    );

    res.json({ message: "암종이 수정되었습니다." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "이미 존재하는 암종 코드입니다." });
    }
    handleError(res, "암종 수정 중 오류 발생", error);
  }
});

// DELETE /api/projects/cancer-types/:id - 암종 삭제
router.delete("/cancer-types/:cancerTypeId", authenticateToken, async (req, res) => {
  const { cancerTypeId } = req.params;

  try {
    await db.query(
      `UPDATE cancer_types SET deleted_at = NOW() WHERE id = ?`,
      [cancerTypeId]
    );

    res.json({ message: "암종이 삭제되었습니다." });
  } catch (error) {
    handleError(res, "암종 삭제 중 오류 발생", error);
  }
});

// ========================================
// 계층형 트리뷰 API (프로젝트 > 암종 > 모드)
// ========================================

// GET /api/projects/tree - 계층형 프로젝트 트리 데이터
router.get("/tree", authenticateToken, async (req, res) => {
  try {
    // 프로젝트별 과제 수 및 암종/모드 정보 조회
    const [assignments] = await db.query(
      `SELECT
        a.id, a.title, a.project_id, a.cancer_type_id, a.assignment_mode,
        p.name as project_name,
        ct.code as cancer_code, ct.name_ko as cancer_name
       FROM assignments a
       LEFT JOIN projects p ON a.project_id = p.id AND p.deleted_at IS NULL
       LEFT JOIN cancer_types ct ON a.cancer_type_id = ct.id AND ct.deleted_at IS NULL
       WHERE a.deleted_at IS NULL`
    );

    // 합의 과제 조회
    const [consensusAssignments] = await db.query(
      `SELECT
        ca.id, ca.title, ca.project_id, ca.cancer_type_id, 'Consensus' as assignment_mode,
        p.name as project_name,
        ct.code as cancer_code, ct.name_ko as cancer_name
       FROM consensus_assignments ca
       LEFT JOIN projects p ON ca.project_id = p.id AND p.deleted_at IS NULL
       LEFT JOIN cancer_types ct ON ca.cancer_type_id = ct.id AND ct.deleted_at IS NULL
       WHERE ca.deleted_at IS NULL`
    );

    // 모든 과제 합치기
    const allAssignments = [...assignments, ...consensusAssignments];

    // 트리 구조 생성
    const treeMap = {};

    allAssignments.forEach((a) => {
      const projectKey = a.project_id ? `p_${a.project_id}` : "p_none";
      const projectName = a.project_name || "미분류";
      const cancerKey = a.cancer_type_id ? `c_${a.cancer_type_id}` : "c_none";
      const cancerName = a.cancer_name || "미지정";
      const mode = a.assignment_mode || "BBox";

      // 프로젝트 레벨
      if (!treeMap[projectKey]) {
        treeMap[projectKey] = {
          id: a.project_id,
          key: projectKey,
          name: projectName,
          type: "project",
          count: 0,
          children: {},
        };
      }
      treeMap[projectKey].count++;

      // 암종 레벨
      if (!treeMap[projectKey].children[cancerKey]) {
        treeMap[projectKey].children[cancerKey] = {
          id: a.cancer_type_id,
          key: cancerKey,
          name: cancerName,
          code: a.cancer_code,
          type: "cancer",
          count: 0,
          children: {},
        };
      }
      treeMap[projectKey].children[cancerKey].count++;

      // 모드 레벨
      const modeKey = `m_${mode}`;
      if (!treeMap[projectKey].children[cancerKey].children[modeKey]) {
        treeMap[projectKey].children[cancerKey].children[modeKey] = {
          key: modeKey,
          name: mode,
          type: "mode",
          count: 0,
        };
      }
      treeMap[projectKey].children[cancerKey].children[modeKey].count++;
    });

    // 객체를 배열로 변환
    const tree = Object.values(treeMap)
      .map((project) => ({
        ...project,
        children: Object.values(project.children).map((cancer) => ({
          ...cancer,
          children: Object.values(cancer.children),
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    res.json(tree);
  } catch (error) {
    handleError(res, "프로젝트 트리 데이터 조회 중 오류 발생", error);
  }
});

// ========================================
// 초기 암종 데이터 시드
// ========================================
router.post("/seed-cancer-types", authenticateToken, async (req, res) => {
  const defaultCancerTypes = [
    { code: "blad", name_ko: "방광암", name_en: "Bladder Cancer" },
    { code: "brst", name_ko: "유방암", name_en: "Breast Cancer" },
    { code: "gist", name_ko: "GIST", name_en: "GIST" },
    { code: "lms", name_ko: "평활근육종", name_en: "Leiomyosarcoma" },
    { code: "u-lms", name_ko: "자궁평활근육종", name_en: "Uterine Leiomyosarcoma" },
    { code: "net", name_ko: "신경내분비종양", name_en: "Neuroendocrine Tumor" },
    { code: "sarc", name_ko: "육종", name_en: "Sarcoma" },
    { code: "stump", name_ko: "미분화육종", name_en: "Undifferentiated Sarcoma" },
    { code: "u_stmp", name_ko: "자궁미분화육종", name_en: "Uterine Undifferentiated Sarcoma" },
    { code: "usmt", name_ko: "연조직악성종양", name_en: "Soft Tissue Malignant Tumor" },
  ];

  try {
    let inserted = 0;
    for (const ct of defaultCancerTypes) {
      try {
        await db.query(
          `INSERT INTO cancer_types (code, name_ko, name_en)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko), name_en = VALUES(name_en)`,
          [ct.code, ct.name_ko, ct.name_en]
        );
        inserted++;
      } catch (e) {
        // 개별 실패 무시
      }
    }

    res.json({ message: `${inserted}개의 암종 데이터가 초기화되었습니다.` });
  } catch (error) {
    handleError(res, "암종 데이터 시드 중 오류 발생", error);
  }
});

module.exports = router;
