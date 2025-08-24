// downloadSearchedAssignments.js

const express = require("express");
const router = express.Router();
const authenticateToken = require("../jwt");
const ExcelJS = require("exceljs");
const db = require("../db");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const sizeOf = require("image-size");
const util = require("util");
const sizeOfPromise = util.promisify(sizeOf);
const archiver = require("archiver");
// --- Polygon helpers (centroid, bbox, IoU, segmentation normalization) ---
function computeCentroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let sx = 0,
    sy = 0;
  for (const [x, y] of points) {
    sx += Number(x);
    sy += Number(y);
  }
  return { x: sx / points.length, y: sy / points.length };
}

function getPolygonBoundingBox(points) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function iouRect(a, b) {
  const xLeft = Math.max(a.x1, b.x1);
  const yTop = Math.max(a.y1, b.y1);
  const xRight = Math.min(a.x2, b.x2);
  const yBottom = Math.min(a.y2, b.y2);
  const interW = Math.max(0, xRight - xLeft);
  const interH = Math.max(0, yBottom - yTop);
  const interArea = interW * interH;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const denom = areaA + areaB - interArea;
  return denom > 0 ? interArea / denom : 0;
}

function normalizeSegmentation(seg) {
  if (!seg) return [];
  if (Array.isArray(seg) && seg.length > 0) {
    if (typeof seg[0] === "number") {
      const pts = [];
      for (let i = 0; i + 1 < seg.length; i += 2) pts.push([seg[i], seg[i + 1]]);
      return pts;
    } else if (Array.isArray(seg[0])) {
      const first = seg[0];
      if (typeof first[0] === "number") {
        const pts = [];
        for (let i = 0; i + 1 < first.length; i += 2) pts.push([first[i], first[i + 1]]);
        return pts;
      }
      return first;
    }
  }
  return [];
}

// 날짜와 시간을 포맷팅하는 함수
function formatDateTime(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = ("0" + (d.getMonth() + 1)).slice(-2);
  const day = ("0" + d.getDate()).slice(-2);
  const hours = ("0" + d.getHours()).slice(-2);
  const minutes = ("0" + d.getMinutes()).slice(-2);
  const seconds = ("0" + d.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 소요 시간을 HH:MM:SS 형식으로 변환하는 함수
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = ("0" + Math.floor(totalSeconds / 3600)).slice(-2);
  const minutes = ("0" + Math.floor((totalSeconds % 3600) / 60)).slice(-2);
  const seconds = ("0" + (totalSeconds % 60)).slice(-2);
  return `${hours}:${minutes}:${seconds}`;
}

// 모든 평가자를 포함하는 열 생성
async function getAllEvaluators(assignments) {
  const evaluatorSet = new Set();

  for (const assignmentSummary of assignments) {
    const assignmentData = await fetchAssignmentData(assignmentSummary.id);
    const users = assignmentData.assignment;

    // 평가자 이름을 추가
    users.forEach((user) => evaluatorSet.add(user.name));
  }

  return Array.from(evaluatorSet);
}

router.post(
  "/download-searched-assignments",
  authenticateToken,
  async (req, res) => {
    try {
      let sliderValue = req.body.sliderValue;
      const assignments = req.body.data;
      const score_value = req.body.score_value;

      const workbook = new ExcelJS.Workbook();
      const timeSheet = workbook.addWorksheet("시간 Sheet");
      const resultSheet = workbook.addWorksheet("결과 Sheet");

      // 메타데이터 키 수집
      const metadataKeys = new Set();

      // 메타데이터 키를 수집하기 위한 첫 번째 패스
      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        // 폴더 이름 가져오기
        const firstQuestionImageUrl =
          assignmentData.assignment[0].questions[0].questionImage;
        const folderName = getFolderNameFromImageUrl(firstQuestionImageUrl);

        // metadata.json 경로 생성
        const metadataPath = path.join(
          __dirname,
          "..",
          "..",
          "assets",
          folderName,
          "metadata.json"
        );

        try {
          await fs.access(metadataPath);
          // 파일이 존재하면
          const metadataContent = await fs.readFile(metadataPath, "utf8");
          const metadataJson = JSON.parse(metadataContent);
          // 'userid' 키 제외하고 키 추가
          for (const key of Object.keys(metadataJson)) {
            if (key !== "userid") {
              metadataKeys.add(key);
            }
          }
        } catch (err) {
          // 파일이 없으면 무시
        }
      }

      // 시간 시트의 열 정의
      const timeSheetColumns = [
        { header: "과제 ID", key: "assignmentId", width: 15 },
        { header: "평가자 이름", key: "evaluatorName", width: 20 },
        { header: "시작 시간", key: "startTime", width: 20 },
        { header: "종료 시간", key: "endTime", width: 20 },
        { header: "소요 시간", key: "duration", width: 15 },
        { header: "AI 표시 여부", key: "aiIndicator", width: 15 },
      ];

      for (const key of metadataKeys) {
        timeSheetColumns.push({ header: key, key: key, width: 20 });
      }

      timeSheet.columns = timeSheetColumns;

      // 결과 시트의 열 정의
      const allEvaluators = await getAllEvaluators(assignments);
      const commonColumns = [
        { header: `과제 ID`, key: `assignmentId`, width: 10 },
        { header: "문제 번호", key: "questionNumber", width: 10 },
      ];

      // 모든 평가자에 대한 열 추가
      const evaluatorColumns = allEvaluators.map((name) => ({
        header: name,
        key: name,
        width: 15,
      }));

      const bboxColumns = [
        {
          header: `+${sliderValue}인`,
          key: `overlap${sliderValue}`,
          width: 10,
        },
        { header: `AI개수`, key: `aiCount`, width: 10 },
        {
          header: `${sliderValue}일치`,
          key: `matched${sliderValue}`,
          width: 10,
        },
        { header: `FN`, key: `fn${sliderValue}`, width: 10 },
        { header: `FP`, key: `fp${sliderValue}`, width: 10 },
        { header: `JSON`, key: `json`, width: 30 },
      ];

      // Polygon 전용 열 (JSON 열 제외)
      const polygonColumns = [
        {
          header: `+${sliderValue}인`,
          key: `overlap${sliderValue}`,
          width: 10,
        },
        { header: `AI개수`, key: `aiCount`, width: 10 },
        {
          header: `${sliderValue}일치`,
          key: `matched${sliderValue}`,
          width: 10,
        },
        { header: `FN`, key: `fn${sliderValue}`, width: 10 },
        { header: `FP`, key: `fp${sliderValue}`, width: 10 },
      ];

      resultSheet.columns = [
        ...commonColumns,
        ...evaluatorColumns,
        ...(assignments[0].assignmentMode === "BBox"
          ? bboxColumns
          : assignments[0].assignmentMode === "Polygon"
          ? polygonColumns
          : []),
        { header: "AI-Json", key: "aiJson", width: 30 },
      ];

      // 과제를 처리하여 시트를 채웁니다.
      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const aiData = await getAIData(assignmentSummary.id);
        const users = assignmentData.assignment;

        const max_slider_value = users.length;

        if (sliderValue > max_slider_value) {
          sliderValue = max_slider_value;
        }

        // 폴더 이름 가져오기
        const firstQuestionImageUrl =
          assignmentData.assignment[0].questions[0].questionImage;
        const folderName = getFolderNameFromImageUrl(firstQuestionImageUrl);

        // metadata.json 경로 생성
        const metadataPath = path.join(
          __dirname,
          "..",
          "..",
          "assets",
          folderName,
          "metadata.json"
        );

        let metadataJson = null;

        try {
          await fs.access(metadataPath);
          // 파일이 존재하면
          const metadataContent = await fs.readFile(metadataPath, "utf8");
          metadataJson = JSON.parse(metadataContent);
          // 'userid' 키 제외
          delete metadataJson["userid"];
        } catch (err) {
          // 파일이 없으면 무시
        }

        // 시간 시트 처리
        for (const user of users) {
          const startTime = user.beforeCanvas.start_time
            ? formatDateTime(user.beforeCanvas.start_time)
            : "";
          const endTime = user.beforeCanvas.end_time
            ? formatDateTime(user.beforeCanvas.end_time)
            : "";
          const duration = user.beforeCanvas.evaluation_time
            ? formatDuration(user.beforeCanvas.evaluation_time)
            : "";

          const row = {
            assignmentId: assignmentSummary.id,
            evaluatorName: user.name,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            aiIndicator: assignmentData.is_ai_use ? "Yes" : "No",
          };

          if (metadataJson) {
            for (const key of Object.keys(metadataJson)) {
              row[key] = metadataJson[key];
            }
          }

          timeSheet.addRow(row);
        }

        // 결과 시트 처리
        for (const question of assignmentData.assignment[0].questions) {
          const questionImageFileName = question.questionImage.split("/").pop();
          const row = { questionNumber: questionImageFileName };
          row["assignmentId"] = assignmentSummary.id;

          allEvaluators.forEach((name) => {
            const user = users.find((u) => u.name === name);
            row[name] = user
              ? getValidSquaresCount(user.squares, question.questionId)
              : 0; // 과제에 할당되지 않은 평가자는 0 설정
          });

          if (assignmentData.assignmentMode === "BBox") {
            const adjustedSquares = await getAdjustedSquares(users, question);
            const relevantAiData = aiData.filter(
              (ai) =>
                ai.questionIndex === question.questionId &&
                ai.score >= score_value
            );

            const { overlapGroups, nonOverlappingGroups } = getOverlapsBBoxes(
              adjustedSquares,
              sliderValue
            );
            const overlapCount = overlapGroups.length;
            const matchedCount = getMatchedCount(overlapGroups, relevantAiData);

            row[`overlap${sliderValue}`] = overlapCount;
            row["aiCount"] = relevantAiData.length;
            row[`matched${sliderValue}`] = matchedCount;
            row[`fn${sliderValue}`] = overlapCount - matchedCount;
            row[`fp${sliderValue}`] = relevantAiData.length - matchedCount;

            row["json"] = JSON.stringify({
              filename: questionImageFileName,
              mitosis: overlapGroups.map((group) => {
                const x = Math.round(
                  group.reduce((acc, bbox) => acc + bbox.x, 0) / group.length -
                    12.5
                );
                const y = Math.round(
                  group.reduce((acc, bbox) => acc + bbox.y, 0) / group.length -
                    12.5
                );
                return [x, y, 25, 25];
              }),
              hardneg: nonOverlappingGroups.map((group) => {
                const square = group[0];
                return [
                  Math.round(square.x),
                  Math.round(square.y),
                  Math.round(square.width),
                  Math.round(square.height),
                ];
              }),
            });
          } else if (assignmentData.assignmentMode === "Polygon") {
            // Polygon: IoU 기반 그룹핑 및 매칭
            const evaluatorPolys = await getAdjustedPolygons(users, question);
            const relevantAiData = aiData.filter(
              (ai) => ai.questionIndex === question.questionId && ai.score >= score_value
            );
            const { overlapGroups } = getOverlapsPolygons(
              evaluatorPolys,
              sliderValue,
              0.1
            );
            const matchedCount = getMatchedCountPolygons(
              overlapGroups,
              relevantAiData,
              0.5
            );
            const overlapCount = overlapGroups.length;

            row[`overlap${sliderValue}`] = overlapCount;
            row["aiCount"] = relevantAiData.length;
            row[`matched${sliderValue}`] = matchedCount;
            row[`fn${sliderValue}`] = overlapCount - matchedCount;
            row[`fp${sliderValue}`] = relevantAiData.length - matchedCount;
          }

          // AI-Json 내용 읽기
          const jsonPath = getImageLocalPath(question.questionImage).replace(
            /\.(jpg|png|jpeg)$/i,
            ".json"
          );

          let aiJsonContent = "";

          try {
            // 폴더 존재 여부 확인 (로깅 제거)
            const folderPath = path.dirname(jsonPath);
            if (!fsSync.existsSync(folderPath)) {
              aiJsonContent = "";
            } else if (!fsSync.existsSync(jsonPath)) {
              // 파일 존재 여부 확인 (로깅 제거)
              aiJsonContent = "";
            } else {
              const jsonContent = await fs.readFile(jsonPath, "utf8");
              aiJsonContent = jsonContent;
            }
          } catch (error) {
            console.error("Error reading AI json file:", error);
            aiJsonContent = "";
          }

          row["aiJson"] = aiJsonContent;

          resultSheet.addRow(row);
        }
      }

      timeSheet.getRow(1).font = { bold: true };
      resultSheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=assignments_data.xlsx"
      );
      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel file:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

router.post(
  "/download-searched-assignments-assets",
  authenticateToken,
  async (req, res) => {
    try {
      const assignments = req.body.data;
      const absolutePath = path.join(__dirname, "../../assets");

      // 필요한 폴더 이름들을 수집합니다.
      const folderSet = new Set();

      // 각 과제에 대해 해당하는 이미지들의 폴더를 찾아냅니다.
      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const questions = assignmentData.assignment[0].questions;

        for (const question of questions) {
          const imagePath = getImageLocalPath(question.questionImage);
          const folderName = path.basename(path.dirname(imagePath));
          folderSet.add(folderName);
        }
      }

      const folders = Array.from(folderSet);

      // 응답 헤더 설정
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=selected_assets.zip"
      );

      // zip 아카이브를 생성하고 응답에 연결합니다.
      const archive = archiver("zip", {
        zlib: { level: 9 }, // 압축 수준 설정
      });

      // 오류 처리
      archive.on("error", function (err) {
        console.error("Archive error:", err);
        res.status(500).send({ error: err.message });
      });

      // 아카이브 데이터를 응답으로 보냅니다.
      archive.pipe(res);

      // 필요한 폴더만 아카이브에 추가합니다.
      for (const folder of folders) {
        const folderPath = path.join(absolutePath, folder);
        archive.directory(folderPath, folder);
      }

      // 아카이브를 종료하고 전송을 완료합니다.
      archive.finalize();
    } catch (error) {
      console.error("Error generating Assets file:", error);
      // 에러 발생 시 응답이 이미 전송 중인지 확인하고, 그렇지 않다면 에러 응답을 보냅니다.
      if (!res.headersSent) {
        res.status(500).send("Internal Server Error");
      }
    }
  }
);

router.post("/metrics", authenticateToken, async (req, res) => {
  try {
  const { assignmentIds, sliderValue, score_value, iou_threshold } = req.body;
  const iouThreshold = typeof iou_threshold === "number" ? iou_threshold : 0.5;

    // assignmentIds가 유효한지 확인
    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({ error: "assignmentIds가 필요합니다." });
    }

    let totalTP = 0;
    let totalFP = 0;
    let totalFN = 0;

    // 각 과제에 대해 TP, FP, FN 계산
  for (const assignmentId of assignmentIds) {
      const assignmentData = await fetchAssignmentData(assignmentId);
      const aiData = await getAIData(assignmentId);
      const users = assignmentData.assignment;

      const maxSliderValue = users.length;

      // sliderValue가 최대 평가자 수보다 클 경우 최대 평가자 수로 조정
      const adjustedSliderValue =
        sliderValue > maxSliderValue ? maxSliderValue : sliderValue;

      if (assignmentData.assignmentMode === "Polygon") {
        // 평가자 폴리곤 보정
        const evaluatorPolys = await getAdjustedPolygonsForMetrics(
          users,
          assignmentId
        );

        // AI: score 기준 필터
        const aiFiltered = aiData.filter((ai) => ai.isAI && ai.score >= score_value);

        // 그룹핑 및 매칭(IoU 기반)
        const { overlapGroups } = getOverlapsPolygons(
          evaluatorPolys,
          adjustedSliderValue,
          0.1
        );
        const matched = getMatchedCountPolygons(
          overlapGroups,
          aiFiltered,
          iouThreshold
        );
        const TP = matched;
        const FN = overlapGroups.length - matched;
        const FP = aiFiltered.length - matched;

        totalTP += TP;
        totalFP += FP;
        totalFN += FN;
      } else {
        // BBox (기존 로직)
        const evaluatorSquares = await getAdjustedSquaresForMetrics(
          users,
          assignmentData.assignmentMode,
          assignmentId
        );
        const aiSquares = aiData
          .filter((ai) => ai.isAI && ai.score >= score_value)
          .map((ai) =>
            ai.type === "bbox"
              ? ai
              : // polygon인 경우 중심점 사용 근사
                { x: ai.centroid?.x ?? 0, y: ai.centroid?.y ?? 0 }
          );
        const { TP, FP, FN } = calculateTP_FP_FN(
          evaluatorSquares,
          aiSquares,
          adjustedSliderValue
        );
        totalTP += TP;
        totalFP += FP;
        totalFN += FN;
      }
    }

    // 전체 과제에 대한 평균값 계산
    const Recall = totalTP / (totalTP + totalFN) || 0;
    const Precision = totalTP / (totalTP + totalFP) || 0;
    const F1 = 2 * ((Recall * Precision) / (Recall + Precision)) || 0;

    res.json({
      metrics: [
        {
          totalTP,
          totalFP,
          totalFN,
          Recall,
          Precision,
          F1,
          sliderValue, // 슬라이더 값 포함
          score_value, // 점수 값 포함
        },
      ],
    });
  } catch (error) {
    console.error("Metrics 계산 중 오류 발생:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 메모리 기반 캐시 (5분 TTL)
const matchSummaryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCacheKey(assignmentIds, sliderValue, score_value, iou_threshold) {
  return `${assignmentIds.sort().join(',')}-${sliderValue}-${score_value}-${iou_threshold || 0.5}`;
}

function getCachedResult(key) {
  const cached = matchSummaryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  matchSummaryCache.delete(key);
  return null;
}

function setCachedResult(key, data) {
  matchSummaryCache.set(key, { data, timestamp: Date.now() });
  
  // 메모리 사용량 제한 (최대 1000개 엔트리)
  if (matchSummaryCache.size > 1000) {
    const oldestKey = matchSummaryCache.keys().next().value;
    matchSummaryCache.delete(oldestKey);
  }
}

// 과제별 매칭 요약: 슬라이더 조건에서 유의미한 매칭이 있는지 빠르게 판단 (캐싱 적용)
router.post("/match-summary", authenticateToken, async (req, res) => {
  try {
  const { assignmentIds, sliderValue, score_value, iou_threshold } = req.body;
  const iouThreshold = typeof iou_threshold === "number" ? iou_threshold : 0.5;
  const kInput = Number(sliderValue) || 1;
  const scoreThreshold = Number(score_value) || 0;

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({ error: "assignmentIds가 필요합니다." });
    }

    // 캐시 확인
    const cacheKey = getCacheKey(assignmentIds, kInput, scoreThreshold, iouThreshold);
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const summary = [];

    // 병렬 처리로 성능 향상
    const promises = assignmentIds.map(async (assignmentId) => {
      try {
        const assignmentData = await fetchAssignmentData(assignmentId);
        const users = assignmentData.assignment || [];
        const maxSliderValue = users.length || 1;
        
        // 🚨 핵심 수정: 슬라이더 값이 평가자 수보다 크면 매칭 불가능
        if (kInput > maxSliderValue) {
          return { assignmentId, overlaps: 0, matched: 0, aiCount: 0, hasMatch: false };
        }
        
        const k = kInput;  // 이제 조정 없이 원래 값 사용
        const aiData = await getAIData(assignmentId);

        let overlaps = 0;
        let matched = 0;
        let aiCount = 0;

        // 질문 단위로 합산 (질문 없으면 0)
        const questions = users[0]?.questions || [];
        
        // 질문별 처리도 병렬화
        const questionPromises = questions.map(async (question) => {
          const relevantAI = aiData.filter(
            (ai) => ai.questionIndex === question.questionId && Number(ai.score) >= scoreThreshold
          );
          
          let questionOverlaps = 0;
          let questionMatched = 0;

          if (assignmentData.assignmentMode === "Polygon") {
            const evaluatorPolys = await getAdjustedPolygons(users, question);
            const { overlapGroups } = getOverlapsPolygons(evaluatorPolys, k, 0.1);
            questionOverlaps = overlapGroups.length;
            questionMatched = getMatchedCountPolygons(overlapGroups, relevantAI, iouThreshold);
          } else if (assignmentData.assignmentMode === "BBox") {
            const adjustedSquares = await getAdjustedSquares(users, question);
            const { overlapGroups } = getOverlapsBBoxes(adjustedSquares, k);
            questionOverlaps = overlapGroups.length;
            questionMatched = getMatchedCount(overlapGroups, relevantAI);
          }

          return {
            aiCount: relevantAI.length,
            overlaps: questionOverlaps,
            matched: questionMatched
          };
        });

        const questionResults = await Promise.all(questionPromises);
        
        // 결과 합산
        questionResults.forEach(result => {
          aiCount += result.aiCount;
          overlaps += result.overlaps;
          matched += result.matched;
        });

        return { assignmentId, overlaps, matched, aiCount, hasMatch: matched > 0 };
      } catch (innerErr) {
        console.error("match-summary per-assignment error:", assignmentId, innerErr?.message);
        return { assignmentId, overlaps: 0, matched: 0, aiCount: 0, hasMatch: false, error: true };
      }
    });

    const results = await Promise.all(promises);
    
    const response = { summary: results };
    
    // 결과 캐싱
    setCachedResult(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    console.error("match-summary 계산 중 오류 발생:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 추가: Metrics용으로 평가자의 squares를 변환하는 함수
async function getAdjustedSquaresForMetrics(
  users,
  assignmentMode,
  assignmentId
) {
  const questions = await getQuestionsForAssignment(assignmentId);
  const adjustedSquares = [];

  for (const user of users) {
    for (const question of user.questions) {
      const adjusted = await getAdjustedSquares([user], question);
      adjustedSquares.push(...adjusted);
    }
  }

  return adjustedSquares;
}

// --- Polygon evaluation helpers for metrics ---
async function getAdjustedPolygonsForMetrics(users, assignmentId) {
  const questions = await getQuestionsForAssignment(assignmentId);
  const adjusted = [];
  for (const user of users) {
    for (const question of user.questions) {
      const polys = await getAdjustedPolygons([user], question);
      adjusted.push(...polys);
    }
  }
  return adjusted;
}

async function getQuestionsForAssignment(assignmentId) {
  const [questions] = await db.query(
    `SELECT id as questionId, image as questionImage FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

  const adjustedQuestions = [];

  for (const question of questions) {
    const { width, height } = await getImageDimensions(question.questionImage);
    adjustedQuestions.push({
      questionId: question.questionId,
      questionImage: question.questionImage,
      originalWidth: width,
      originalHeight: height,
    });
  }

  return adjustedQuestions;
}

function calculateTP_FP_FN(evaluatorSquares, aiSquares, overlapCount) {
  const groups = [];
  const visited = new Set();

  // DFS로 그룹화
  function dfs(square, group) {
    if (visited.has(square)) return;

    visited.add(square);
    group.push(square);

    evaluatorSquares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  // 그룹화된 평가자 사각형들
  evaluatorSquares.forEach((square) => {
    if (!visited.has(square)) {
      const group = [];
      dfs(square, group);
      if (group.length >= overlapCount) {
        groups.push(group);
      }
    }
  });

  const overlapGroups = groups;

  // TP: 겹친 평가자 사각형과 AI 사각형이 일치하는 그룹의 수
  let TP = 0;
  overlapGroups.forEach((group) => {
    const matchFound = group.some((bbox) =>
      aiSquares.some(
        (ai) =>
          Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
      )
    );
    if (matchFound) {
      TP++;
    }
  });

  // FN: AI 사각형이 없는 그룹 수
  const FN = overlapGroups.length - TP;

  // FP: AI 사각형은 있지만 해당 위치에 일치하는 그룹이 없는 경우
  let FP = 0;
  aiSquares.forEach((ai) => {
    const matched = overlapGroups.some((group) =>
      group.some(
        (bbox) =>
          Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
      )
    );
    if (!matched) {
      FP++;
    }
  });

  console.log("TP:", TP);
  console.log("FP:", FP);
  console.log("FN:", FN);

  return { TP, FP, FN };
}

function getValidSquaresCount(squares, questionId) {
  return squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  ).length;
}

function getImageLocalPath(imageUrl) {
  try {
    let parsedUrl;
    if (typeof imageUrl !== "string") throw new Error("Invalid imageUrl");
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      parsedUrl = new URL(imageUrl);
    } else if (imageUrl.startsWith("/")) {
      // 상대 경로인 경우 임시 베이스로 파싱
      parsedUrl = new URL(imageUrl, "http://localhost");
    } else {
      // 단순 파일명 혹은 상대 경로 문자열
      const parts = imageUrl.split("/").filter(Boolean);
      const fileName = parts.pop();
      const folderName = parts.pop();
      return path.join(__dirname, "..", "..", "assets", folderName || "", fileName || "");
    }
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const fileName = pathParts[pathParts.length - 1];
    const folderName = pathParts[pathParts.length - 2];
    return path.join(__dirname, "..", "..", "assets", folderName || "", fileName || "");
  } catch (e) {
    console.error("getImageLocalPath parse error:", imageUrl, e.message);
    // 안전 폴백: 파일명만 추출
    try {
      const parts = String(imageUrl).split("/").filter(Boolean);
      const fileName = parts.pop();
      const folderName = parts.pop();
      return path.join(__dirname, "..", "..", "assets", folderName || "", fileName || "");
    } catch (ee) {
      return path.join(__dirname, "..", "..", "assets", "", "");
    }
  }
}

function getFolderNameFromImageUrl(imageUrl) {
  try {
    let parsedUrl;
    if (typeof imageUrl !== "string") throw new Error("Invalid imageUrl");
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      parsedUrl = new URL(imageUrl);
    } else if (imageUrl.startsWith("/")) {
      parsedUrl = new URL(imageUrl, "http://localhost");
    } else {
      const parts = imageUrl.split("/").filter(Boolean);
      return parts[parts.length - 2];
    }
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    return pathParts[pathParts.length - 2];
  } catch (e) {
    console.error("getFolderNameFromImageUrl parse error:", imageUrl, e.message);
    try {
      const parts = String(imageUrl).split("/").filter(Boolean);
      return parts[parts.length - 2];
    } catch (ee) {
      return "";
    }
  }
}

// 이미지 크기 캐시 (1시간 TTL)
const imageDimensionsCache = new Map();
const IMAGE_CACHE_TTL = 60 * 60 * 1000; // 1시간

async function getImageDimensions(imageUrl) {
  try {
    // 캐시 확인
    const cached = imageDimensionsCache.get(imageUrl);
    if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL) {
      return cached.dimensions;
    }

    const realPath = getImageLocalPath(imageUrl);
    
    // 폴더 존재 여부 확인 (로깅 제거)
    const folderPath = path.dirname(realPath);
    if (!fsSync.existsSync(folderPath)) {
      const defaultDimensions = { width: 1000, height: 1000 };
      
      // 기본값도 캐싱하여 반복 확인 방지
      imageDimensionsCache.set(imageUrl, { 
        dimensions: defaultDimensions, 
        timestamp: Date.now() 
      });
      
      return defaultDimensions;
    }
    
    // 파일 존재 여부 확인 (로깅 제거)
    if (!fsSync.existsSync(realPath)) {
      const defaultDimensions = { width: 1000, height: 1000 };
      
      // 기본값도 캐싱
      imageDimensionsCache.set(imageUrl, { 
        dimensions: defaultDimensions, 
        timestamp: Date.now() 
      });
      
      return defaultDimensions;
    }
    
    const dimensions = await sizeOfPromise(realPath);
    const result = { width: dimensions.width, height: dimensions.height };
    
    // 성공적으로 읽은 크기 정보 캐싱
    imageDimensionsCache.set(imageUrl, { 
      dimensions: result, 
      timestamp: Date.now() 
    });
    
    // 캐시 크기 제한 (최대 500개 엔트리)
    if (imageDimensionsCache.size > 500) {
      const oldestKey = imageDimensionsCache.keys().next().value;
      imageDimensionsCache.delete(oldestKey);
    }
    
    return result;
  } catch (error) {
    console.error(`Error getting image dimensions for ${imageUrl}:`, error);
    return { width: 1000, height: 1000 }; // 기본값 설정
  }
}

async function getAdjustedSquares(users, question) {
  const { width: originalWidth, height: originalHeight } =
    await getImageDimensions(question.questionImage);

  return users.flatMap((user) =>
    user.squares
      .filter(
        (square) =>
          square.questionIndex === question.questionId && !square.isTemporary
      )
      .map((square) => {
        const { x: adjustedX, y: adjustedY } =
          convertToOriginalImageCoordinates(
            square.x,
            square.y,
            user.beforeCanvas.width,
            user.beforeCanvas.height,
            originalWidth,
            originalHeight
          );
        return {
          ...square,
          x: adjustedX,
          y: adjustedY,
          width: 25,
          height: 25,
        };
      })
  );
}

function convertToOriginalImageCoordinates(
  x,
  y,
  canvasWidth,
  canvasHeight,
  originalWidth,
  originalHeight
) {
  const currentPosition = calculateImagePosition(
    canvasWidth,
    canvasHeight,
    originalWidth,
    originalHeight
  );

  const scaleRatio = 1 / currentPosition.scale;

  const adjustedX = (x - currentPosition.x) * scaleRatio;
  const adjustedY = (y - currentPosition.y) * scaleRatio;

  return { x: adjustedX, y: adjustedY };
}

function calculateImagePosition(
  canvasWidth,
  canvasHeight,
  imageWidth,
  imageHeight
) {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const x = (canvasWidth - imageWidth * scale) / 2;
  const y = (canvasHeight - imageHeight * scale) / 2;
  return { x, y, scale };
}

function getOverlapsBBoxes(squares, overlapCount) {
  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;

    visited.add(square);
    group.push(square);

    squares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  squares.forEach((square) => {
    if (!visited.has(square)) {
      const group = [];
      dfs(square, group);
      if (group.length >= overlapCount) {
        groups.push(group);
      }
    }
  });

  // 오버랩된 박스 추적
  const overlappedSquares = new Set(groups.flat());

  // 오버랩되지 않은 박스 추출
  const nonOverlappingSquares = squares.filter(
    (square) => !overlappedSquares.has(square)
  );

  return {
    overlapGroups: groups,
    nonOverlappingGroups: nonOverlappingSquares.map((square) => [square]),
  };
}

function getMatchedCount(overlapGroups, aiData) {
  let matchedCount = 0;
  overlapGroups.forEach((group) => {
    if (
      group.some((bbox) =>
        aiData.some(
          (ai) =>
            Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
        )
      )
    ) {
      matchedCount++;
    }
  });
  return matchedCount;
}

// --- Polygon-specific helpers ---
function getOverlapsPolygons(polygons, overlapCount, iouThresholdForGrouping = 0.1) {
  const groups = [];
  const visited = new Set();

  function overlaps(p1, p2) {
    const iou = iouRect(p1.bbox, p2.bbox);
    return iou > iouThresholdForGrouping;
  }

  for (let i = 0; i < polygons.length; i++) {
    if (visited.has(i)) continue;
    const group = [];
    const stack = [i];
    visited.add(i);
    while (stack.length) {
      const idx = stack.pop();
      group.push(polygons[idx]);
      for (let j = 0; j < polygons.length; j++) {
        if (!visited.has(j) && overlaps(polygons[idx], polygons[j])) {
          visited.add(j);
          stack.push(j);
        }
      }
    }
    if (group.length >= overlapCount) groups.push(group);
  }

  const overlappedSet = new Set(groups.flat());
  const nonOverlappingGroups = polygons
    .filter((p) => !overlappedSet.has(p))
    .map((p) => [p]);

  return { overlapGroups: groups, nonOverlappingGroups };
}

function getMatchedCountPolygons(overlapGroups, aiPolys, iouThreshold = 0.5) {
  let matchedCount = 0;
  overlapGroups.forEach((group) => {
    const matchFound = group.some((poly) =>
      aiPolys.some((ai) => {
        const bBox =
          ai.bbox ||
          (ai.type === "bbox"
            ? { x1: ai.x - ai.w / 2, y1: ai.y - ai.h / 2, x2: ai.x + ai.w / 2, y2: ai.y + ai.h / 2 }
            : null);
        if (!bBox) return false;
        const iou = iouRect(poly.bbox, bBox);
        return iou >= iouThreshold;
      })
    );
    if (matchFound) matchedCount++;
  });
  return matchedCount;
}

async function getAdjustedPolygons(users, question) {
  const { width: originalWidth, height: originalHeight } = await getImageDimensions(
    question.questionImage
  );

  const adjusted = [];
  for (const user of users) {
    const canvasW = user.beforeCanvas.width;
    const canvasH = user.beforeCanvas.height;
    const polys = (user.polygons || []).filter(
      (p) => p.questionIndex === question.questionId && !p.isTemporary
    );
    for (const poly of polys) {
      const pts = (poly.points || []).map(([x, y]) =>
        convertToOriginalImageCoordinates(
          x,
          y,
          canvasW,
          canvasH,
          originalWidth,
          originalHeight
        )
      );
      const ptsArr = pts.map((o) => [o.x, o.y]);
      const bbox = getPolygonBoundingBox(ptsArr);
      const centroid = computeCentroid(ptsArr);
      adjusted.push({ points: ptsArr, bbox, centroid });
    }
  }
  return adjusted;
}

async function fetchAssignmentData(assignmentId) {
  const [assignmentInfo] = await db.query(
    `SELECT title as FileName, assignment_mode as assignmentMode, is_ai_use FROM assignments WHERE id = ?`,
    [assignmentId]
  );

  const [users] = await db.query(
    `SELECT u.id as userId, u.username as name
     FROM users u
     JOIN assignment_user au ON u.id = au.user_id
     WHERE au.assignment_id = ?`,
    [assignmentId]
  );

  const [questions] = await db.query(
    `SELECT id as questionId, image as questionImage FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

  // 이미지 크기 정보 가져오기
  for (let question of questions) {
    const { width, height } = await getImageDimensions(question.questionImage);
    question.originalWidth = width;
    question.originalHeight = height;
  }

  const [responses] = await db.query(
    `SELECT qr.question_id, qr.user_id, qr.selected_option as questionSelection
     FROM question_responses qr
     JOIN questions q ON qr.question_id = q.id
     WHERE q.assignment_id = ?`,
    [assignmentId]
  );

  const [squares] = await db.query(
    `SELECT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
     FROM squares_info si
     JOIN questions q ON si.question_id = q.id
     WHERE q.assignment_id = ? AND si.isTemporary = 0`,
    [assignmentId]
  );

  const [polygons] = await db.query(
    `SELECT pi.question_id as questionIndex, pi.coordinates, pi.class_type as classType, pi.user_id, pi.isAI, pi.isTemporary
     FROM polygon_info pi
     JOIN questions q ON pi.question_id = q.id
     WHERE q.assignment_id = ? AND pi.isTemporary = 0`,
    [assignmentId]
  );

  const [canvasInfo] = await db.query(
    `SELECT user_id, width, height, start_time, end_time, evaluation_time FROM canvas_info WHERE assignment_id = ?`,
    [assignmentId]
  );

  const structuredData = users.map((user) => ({
    ...user,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      questionImage: q.questionImage,
      originalWidth: q.originalWidth,
      originalHeight: q.originalHeight,
      questionSelection:
        responses.find(
          (r) => r.question_id === q.questionId && r.user_id === user.userId
        )?.questionSelection || -1,
    })),
    squares: squares.filter((s) => s.user_id === user.userId),
    polygons: polygons
      .filter((p) => p.user_id === user.userId)
      .map((p) => {
        let pts = [];
        try {
          const arr = JSON.parse(p.coordinates || "[]");
          pts = Array.isArray(arr) ? arr : [];
        } catch (e) {
          pts = [];
        }
        return {
          points: pts,
          class: p.classType,
          isComplete: true,
          questionIndex: p.questionIndex,
          isAI: !!p.isAI,
        };
      }),
    beforeCanvas: canvasInfo.find((c) => c.user_id === user.userId) || {
      width: 1000,
      height: 1000,
      start_time: null,
      end_time: null,
      evaluation_time: null,
    },
    answeredCount: 0,
    unansweredCount: 0,
  }));

  structuredData.forEach((user) => {
    user.questions.forEach((q) => {
      if (q.questionSelection > 0) {
        user.answeredCount++;
      } else {
        user.unansweredCount++;
      }
    });
  });

  return {
    assignment: structuredData,
    assignmentMode: assignmentInfo[0].assignmentMode,
    FileName: assignmentInfo[0].FileName,
    is_ai_use: assignmentInfo[0].is_ai_use,
  };
}

async function getAIData(assignmentId) {
  const [questions] = await db.query(
    `SELECT id, image FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

  const AI_OUTPUT = [];

  for (const question of questions) {
    const jsonPath = getImageLocalPath(question.image).replace(
      /\.(jpg|png|jpeg)$/i,
      ".json"
    );

    try {
      // 폴더 존재 여부 확인 (로깅 제거)
      const folderPath = path.dirname(jsonPath);
      if (!fsSync.existsSync(folderPath)) {
        continue;
      }

      // 파일 존재 여부 확인 (로깅 제거)
      if (!fsSync.existsSync(jsonPath)) {
        continue;
      }

      const jsonContent = await fs.readFile(jsonPath, "utf8");
      const parsed = JSON.parse(jsonContent);
      const annotations = Array.isArray(parsed.annotation)
        ? parsed.annotation
        : Array.isArray(parsed.annotations)
        ? parsed.annotations
        : [];

      for (const ann of annotations) {
        const score = ann.score != null ? ann.score : parsed.score != null ? parsed.score : 0.6;
        if (ann && Array.isArray(ann.bbox)) {
          const bx = Number(ann.bbox[0]);
          const by = Number(ann.bbox[1]);
          const w = ann.bbox.length >= 4 ? Number(ann.bbox[2]) : 25;
          const h = ann.bbox.length >= 4 ? Number(ann.bbox[3]) : 25;
          const cx = bx + w / 2;
          const cy = by + h / 2;
          AI_OUTPUT.push({
            type: "bbox",
            x: cx,
            y: cy,
            w,
            h,
            questionIndex: question.id,
            score,
            isAI: true,
          });
        } else if (ann && (ann.polygon || ann.segmentation || ann.points || ann.vertices)) {
          const ptsRaw = ann.polygon || ann.points || ann.vertices || ann.segmentation;
          const points = Array.isArray(ptsRaw) ? normalizeSegmentation(ptsRaw) : [];
          if (points.length > 0) {
            const centroid = computeCentroid(points);
            AI_OUTPUT.push({
              type: "polygon",
              points,
              centroid,
              bbox: getPolygonBoundingBox(points),
              questionIndex: question.id,
              score,
              isAI: true,
            });
          }
        }
      }
    } catch (error) {
      // 파일을 읽을 수 없거나 오류가 발생하면 콘솔에 로그를 남기고 빈 배열을 반환
      console.error(
        `Error reading AI JSON for question ${question.id}:`,
        error
      );
      // 파일이 없거나 읽을 수 없는 경우, 빈 배열을 그대로 반환
      continue;
    }
  }

  return AI_OUTPUT;
}

module.exports = router;
