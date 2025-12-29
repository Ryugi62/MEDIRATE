<!-- ConsensusAnalysisView.vue -->
<!-- Consensus 결과 분석을 위한 뷰어 (DashboardDetailView와 유사) -->

<template>
  <div v-if="consensusData" class="dashboard">
    <div v-if="isExporting" class="exporting-message">
      {{ exportingMessage }}
    </div>
    <h1 class="title">Consensus 분석</h1>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">{{ consensusData.title }}</span>
          <span class="metadata-info">
            마감일: {{ formatDate(consensusData.deadline) }} |
            평가자: {{ evaluatorCount }}명 |
            임계값: {{ consensusData.threshold || 2 }}
          </span>
          <span class="completed-status">
            <strong>{{ completedCount }}/{{ questionList.length }}</strong> 완료
          </span>
          <button class="action-button action-button--blue" @click="openEditModal">과제수정</button>
          <button class="action-button action-button--red" @click="deleteConsensus">과제삭제</button>
          <button class="action-button action-button--green" @click="exportToExcel">내보내기</button>
          <button class="action-button action-button--blue" @click="downloadImages">이미지 다운로드</button>
          <button class="action-button action-button--blue" @click="goToEvaluation">평가하기</button>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="assignment-table">
              <thead class="table-head">
                <tr>
                  <th>번호</th>
                  <th>이미지</th>
                  <th>FP</th>
                  <th>GS_FP</th>
                  <th>GS_NIPA</th>
                  <th>GS_Total</th>
                  <th
                    v-for="(evaluator, idx) in evaluators"
                    :key="evaluator.id"
                    :style="getStyleForEvaluator(idx)"
                  >
                    {{ evaluator.realname }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(question, idx) in questionList"
                  :key="question.image"
                  :class="{ active: idx === activeIndex }"
                  @click="onRowClick(question, idx)"
                >
                  <td>{{ idx + 1 }}</td>
                  <td class="image-cell">
                    <img :src="getImageThumbnail(question.image)" alt="이미지" />
                  </td>
                  <td>{{ question.fpCount }}</td>
                  <td>{{ question.goldStandardCount || '-' }}</td>
                  <td>{{ getNipaGS(question.image) || '-' }}</td>
                  <td>{{ question.goldStandardCount + getNipaGS(question.image) }}</td>
                  <td
                    v-for="evaluator in evaluators"
                    :key="evaluator.id"
                    :class="getEvaluatorCellClass(question.image, evaluator.id)"
                  >
                    {{ getEvaluatorResponseSummary(question.image, evaluator.id) }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-footer">
                <tr>
                  <th colspan="3">총계</th>
                  <th>{{ totalGoldStandard }}</th>
                  <th>{{ totalNipaGS }}</th>
                  <th>{{ totalGoldStandard + totalNipaGS }}</th>
                  <th v-for="evaluator in evaluators" :key="evaluator.id">
                    {{ getEvaluatorTotalResponses(evaluator.id) }}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="image-box">
            <ConsensusViewerComponent
              :src="activeImageUrl"
              :fpSquares="currentImageFpSquares"
              :evaluatorResponses="evaluatorResponsesForImage"
              :evaluators="evaluators"
              :threshold="consensusData.threshold || 2"
              :nipaBoxes="currentNipaBoxes"
            />
          </div>
        </div>
      </div>
    </div>
    <!-- Metrics 패널 -->
    <div v-if="metrics" class="metrics-panel">
      <div class="metrics-item">
        <span class="metrics-label">총 FP</span>
        <span class="metrics-value">{{ metrics.totalFP }}</span>
      </div>
      <div class="metrics-item">
        <span class="metrics-label">합의율</span>
        <span class="metrics-value highlight">{{ metrics.consensusRate }}%</span>
      </div>
      <div class="metrics-item">
        <span class="metrics-label">GS 비율</span>
        <span class="metrics-value highlight-gold">{{ metrics.goldStandardRate }}%</span>
      </div>
      <div class="metrics-item">
        <span class="metrics-label">평균 동의</span>
        <span class="metrics-value">{{ metrics.averageAgreeCount }}</span>
      </div>
      <div class="metrics-item">
        <span class="metrics-label">FP 확정</span>
        <span class="metrics-value success">{{ metrics.confirmedFP }}</span>
      </div>
      <div class="metrics-item">
        <span class="metrics-label">TP 변경</span>
        <span class="metrics-value danger">{{ metrics.changedToTP }}</span>
      </div>
      <div class="metrics-item">
        <span class="metrics-label">미결정</span>
        <span class="metrics-value warning">{{ metrics.undecided }}</span>
      </div>
    </div>
    <div class="legend-bar">
      <span class="legend-item agree">마이토시스</span>
      <span class="legend-item disagree">논 마이토시스</span>
      <span class="legend-item pending">미응답</span>
      <span class="legend-item gs">GS_FP</span>
    </div>

  </div>
  <div v-else class="loading-message">
    <p>Consensus 데이터를 불러오는 중입니다...</p>
  </div>
</template>

<script>
import ConsensusViewerComponent from "@/components/ConsensusViewerComponent.vue";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import JSZip from "jszip";

export default {
  name: "ConsensusAnalysisView",

  components: {
    ConsensusViewerComponent,
  },

  data() {
    return {
      consensusData: null,
      metrics: null,
      activeIndex: 0,
      activeImageUrl: "",
      isExporting: false,
      exportingMessage: "내보내기 중...",
      colorList: [
        { backgroundColor: "#00838F", color: "white" },
        { backgroundColor: "#36A2EB", color: "white" },
        { backgroundColor: "#00BCD4", color: "white" },
        { backgroundColor: "#B2F302", color: "black" },
        { backgroundColor: "#3F51B5", color: "white" },
      ],
    };
  },

  async created() {
    await this.loadConsensusData();
  },

  mounted() {
    this.$nextTick(() => {
      window.addEventListener("keydown", this.handleKeyDown);
    });
  },

  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown);
  },

  computed: {
    evaluators() {
      return this.consensusData?.evaluators || [];
    },

    evaluatorCount() {
      return this.evaluators.length;
    },

    isAdmin() {
      return this.$store.getters.getUserRole === "admin";
    },

    consensusId() {
      return this.$route.params.id;
    },

    questionList() {
      if (!this.consensusData || !this.consensusData.fpSquares) {
        return [];
      }

      const imageMap = {};
      this.consensusData.fpSquares.forEach((fp) => {
        if (!imageMap[fp.question_image]) {
          imageMap[fp.question_image] = {
            image: fp.question_image,
            fpCount: 0,
            goldStandardCount: 0,
            isComplete: true,
            hasAnyResponse: false,
          };
        }
        imageMap[fp.question_image].fpCount++;
        if (fp.is_gold_standard) {
          imageMap[fp.question_image].goldStandardCount++;
        }

        const responses = this.consensusData.evaluatorResponses?.[fp.id];
        if (responses) {
          const responseCount = Object.keys(responses).length;
          if (responseCount < this.evaluatorCount) {
            imageMap[fp.question_image].isComplete = false;
          }
          if (responseCount > 0) {
            imageMap[fp.question_image].hasAnyResponse = true;
          }
        } else {
          imageMap[fp.question_image].isComplete = false;
        }
      });

      return Object.values(imageMap).sort((a, b) =>
        a.image.localeCompare(b.image)
      );
    },

    currentImageFpSquares() {
      if (!this.consensusData || !this.consensusData.fpSquares) {
        return [];
      }
      const activeImage = this.questionList[this.activeIndex]?.image;
      return this.consensusData.fpSquares.filter(
        (fp) => fp.question_image === activeImage
      );
    },

    evaluatorResponsesForImage() {
      if (!this.consensusData || !this.consensusData.evaluatorResponses) {
        return {};
      }
      const result = {};
      this.currentImageFpSquares.forEach((fp) => {
        result[fp.id] = this.consensusData.evaluatorResponses[fp.id] || {};
      });
      return result;
    },

    overallAgreeRate() {
      if (!this.consensusData || !this.consensusData.fpSquares) {
        return 0;
      }

      let totalAgree = 0;
      let totalResponses = 0;

      this.consensusData.fpSquares.forEach((fp) => {
        const responses = this.consensusData.evaluatorResponses?.[fp.id];
        if (responses) {
          Object.values(responses).forEach((r) => {
            totalResponses++;
            if (r.response === "agree") {
              totalAgree++;
            }
          });
        }
      });

      return totalResponses > 0
        ? Math.round((totalAgree / totalResponses) * 100)
        : 0;
    },

    totalGoldStandard() {
      return this.questionList.reduce(
        (sum, q) => sum + q.goldStandardCount,
        0
      );
    },

    // NIPA 데이터 맵
    nipaDataMap() {
      return this.consensusData?.nipaData || {};
    },

    // 현재 이미지의 NIPA 박스 좌표
    currentNipaBoxes() {
      const activeImage = this.questionList[this.activeIndex]?.image;
      const nipaData = this.nipaDataMap[activeImage];
      return nipaData?.boxes || { match_2: [], match_3: [] };
    },

    // 총 NIPA GS
    totalNipaGS() {
      return this.questionList.reduce((sum, q) => {
        const nipaData = this.nipaDataMap[q.image];
        return sum + (nipaData?.gs_nipa || 0);
      }, 0);
    },

    completedCount() {
      return this.questionList.filter((q) => q.isComplete).length;
    },
  },

  methods: {
    // NIPA GS 값 가져오기
    getNipaGS(questionImage) {
      const nipaData = this.nipaDataMap[questionImage];
      return nipaData?.gs_nipa || 0;
    },

    async loadConsensusData() {
      try {
        const consensusId = this.$route.params.id;
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        // 데이터와 metrics 병렬 로드
        const [dataResponse, metricsResponse] = await Promise.all([
          this.$axios.get(`/api/consensus/${consensusId}`, { headers }),
          this.$axios.get(`/api/consensus/${consensusId}/metrics`, { headers }),
        ]);

        this.consensusData = dataResponse.data;
        this.metrics = metricsResponse.data;

        if (this.questionList.length > 0) {
          this.setActiveImage(0);
        }
      } catch (error) {
        console.error("Error loading consensus data:", error);
      }
    },

    setActiveImage(idx) {
      this.activeIndex = idx;
      const question = this.questionList[idx];
      if (question && this.consensusData) {
        const assignmentType = this.consensusData.assignment_type;
        this.activeImageUrl = `/api/assets/${assignmentType}/${question.image}`;
      }
    },

    onRowClick(question, idx) {
      this.setActiveImage(idx);
    },

    getImageThumbnail(imageName) {
      if (this.consensusData) {
        const assignmentType = this.consensusData.assignment_type;
        return `/api/assets/${assignmentType}/${imageName}`;
      }
      return "https://via.placeholder.com/25";
    },

    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return date.toLocaleDateString();
    },

    getStyleForEvaluator(idx) {
      const color = this.colorList[idx % this.colorList.length];
      return {
        backgroundColor: color.backgroundColor,
        color: color.color,
      };
    },

    getEvaluatorResponseSummary(questionImage, evaluatorId) {
      if (!this.consensusData || !this.consensusData.evaluatorResponses) {
        return "-";
      }

      const fpSquares = this.consensusData.fpSquares.filter(
        (fp) => fp.question_image === questionImage
      );

      let agree = 0;
      let disagree = 0;
      let pending = 0;

      fpSquares.forEach((fp) => {
        const responses = this.consensusData.evaluatorResponses[fp.id];
        if (responses && responses[evaluatorId]) {
          if (responses[evaluatorId].response === "agree") {
            agree++;
          } else {
            disagree++;
          }
        } else {
          pending++;
        }
      });

      if (pending === fpSquares.length) {
        return "-";
      }

      return `${agree}/${disagree}`;
    },

    getEvaluatorCellClass(questionImage, evaluatorId) {
      if (!this.consensusData || !this.consensusData.evaluatorResponses) {
        return "";
      }

      const fpSquares = this.consensusData.fpSquares.filter(
        (fp) => fp.question_image === questionImage
      );

      let pending = 0;
      fpSquares.forEach((fp) => {
        const responses = this.consensusData.evaluatorResponses[fp.id];
        if (!responses || !responses[evaluatorId]) {
          pending++;
        }
      });

      if (pending === fpSquares.length) {
        return "cell-pending";
      } else if (pending > 0) {
        return "cell-partial";
      }
      return "cell-complete";
    },

    getAgreeRate(questionImage) {
      if (!this.consensusData || !this.consensusData.evaluatorResponses) {
        return 0;
      }

      const fpSquares = this.consensusData.fpSquares.filter(
        (fp) => fp.question_image === questionImage
      );

      let totalAgree = 0;
      let totalResponses = 0;

      fpSquares.forEach((fp) => {
        const responses = this.consensusData.evaluatorResponses[fp.id];
        if (responses) {
          Object.values(responses).forEach((r) => {
            totalResponses++;
            if (r.response === "agree") {
              totalAgree++;
            }
          });
        }
      });

      return totalResponses > 0
        ? Math.round((totalAgree / totalResponses) * 100)
        : 0;
    },

    getEvaluatorTotalResponses(evaluatorId) {
      if (!this.consensusData || !this.consensusData.evaluatorResponses) {
        return "0/0";
      }

      let agree = 0;
      let disagree = 0;

      this.consensusData.fpSquares.forEach((fp) => {
        const responses = this.consensusData.evaluatorResponses[fp.id];
        if (responses && responses[evaluatorId]) {
          if (responses[evaluatorId].response === "agree") {
            agree++;
          } else {
            disagree++;
          }
        }
      });

      return `${agree}/${disagree}`;
    },

    getStatusClass(question) {
      if (question.isComplete) return "status-complete";
      if (question.hasAnyResponse) return "status-partial";
      return "status-pending";
    },

    getStatusText(question) {
      if (question.isComplete) return "완료";
      if (question.hasAnyResponse) return "진행";
      return "대기";
    },

    goToEvaluation() {
      this.$router.push({
        name: "consensusDetail",
        params: { id: this.$route.params.id },
      });
    },

    // 수정 페이지로 이동
    openEditModal() {
      this.$router.push(`/edit-consensus/${this.consensusId}`);
    },

    // Consensus 삭제
    async deleteConsensus() {
      if (
        !confirm(
          "정말 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다."
        )
      ) {
        return;
      }

      try {
        await this.$axios.delete(`/api/consensus/${this.consensusId}`, {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        });
        this.$router.push("/consensus");
      } catch (error) {
        console.error("Consensus 삭제 실패:", error);
        alert("삭제 실패: " + (error.response?.data?.message || error.message));
      }
    },

    // 이미지 다운로드
    async downloadImages() {
      this.isExporting = true;
      this.exportingMessage = "이미지 다운로드 중...";

      try {
        const zip = new JSZip();

        for (const question of this.questionList) {
          const imageUrl = this.getImageThumbnail(question.image);
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const fileName = question.image.split("/").pop();
          zip.file(fileName, blob);
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${this.consensusData.title}_images.zip`);
        alert("이미지 다운로드가 완료되었습니다.");
      } catch (error) {
        console.error("이미지 다운로드 실패:", error);
        alert("다운로드 실패: " + error.message);
      } finally {
        this.isExporting = false;
      }
    },

    handleKeyDown(event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (this.activeIndex < this.questionList.length - 1) {
          this.setActiveImage(this.activeIndex + 1);
          this.scrollToActiveRow();
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (this.activeIndex > 0) {
          this.setActiveImage(this.activeIndex - 1);
          this.scrollToActiveRow();
        }
      }
    },

    scrollToActiveRow() {
      this.$nextTick(() => {
        const activeRow = this.$el.querySelector("tbody tr.active");
        if (activeRow) {
          activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    },

    async exportToExcel() {
      this.isExporting = true;
      this.exportingMessage = "Excel 파일 생성 중...";

      try {
        // 백엔드에서 export 데이터 가져오기
        const consensusId = this.$route.params.id;
        const response = await this.$axios.get(
          `/api/consensus/${consensusId}/export`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        const { resultData, timeData, statisticsData } = response.data;

        const workbook = new ExcelJS.Workbook();

        // 1. 결과 Sheet
        const resultSheet = workbook.addWorksheet("결과");
        if (resultData.length > 0) {
          resultSheet.addRow(Object.keys(resultData[0]));
          resultData.forEach((row) => {
            resultSheet.addRow(Object.values(row));
          });
          resultSheet.getRow(1).font = { bold: true };
        }

        // 2. 시간 Sheet
        const timeSheet = workbook.addWorksheet("시간");
        if (timeData.length > 0) {
          timeSheet.addRow(Object.keys(timeData[0]));
          timeData.forEach((row) => {
            timeSheet.addRow(Object.values(row));
          });
          timeSheet.getRow(1).font = { bold: true };
        }

        // 3. 통계 Sheet
        const statsSheet = workbook.addWorksheet("통계");
        statsSheet.addRow(["항목", "값"]);
        Object.entries(statisticsData).forEach(([key, value]) => {
          let displayValue = value;
          if (key === "합의율" || key === "GS_비율") {
            displayValue = `${value}%`;
          }
          statsSheet.addRow([key.replace(/_/g, " "), displayValue]);
        });
        statsSheet.getRow(1).font = { bold: true };

        // 4. 이미지별 요약 Sheet (기존 로직 유지)
        const summarySheet = workbook.addWorksheet("이미지별 요약");
        const headers = [
          "번호",
          "이미지",
          "FP",
          ...this.evaluators.map((e) => e.realname),
          "동의율",
          "GS",
          "상태",
        ];
        summarySheet.addRow(headers);

        this.questionList.forEach((question, idx) => {
          const row = [
            idx + 1,
            question.image,
            question.fpCount,
            ...this.evaluators.map((e) =>
              this.getEvaluatorResponseSummary(question.image, e.id)
            ),
            `${this.getAgreeRate(question.image)}%`,
            question.goldStandardCount || "-",
            this.getStatusText(question),
          ];
          summarySheet.addRow(row);
        });
        summarySheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `consensus_analysis_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
        saveAs(new Blob([buffer]), fileName);
      } catch (error) {
        console.error("Export error:", error);
        alert("내보내기 중 오류가 발생했습니다.");
      } finally {
        this.isExporting = false;
      }
    },
  },
};
</script>

<style scoped>
.dashboard {
  height: calc(100vh - 71px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title {
  font-size: 18px;
  height: 45px;
  display: flex;
  align-items: center;
  padding-left: 16px;
  font-weight: 500;
  margin: 0;
  border-bottom: 1px solid var(--light-gray, #e0e0e0);
  flex-shrink: 0;
}

.dashboard-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header {
  height: 45px;
  display: flex;
  padding-left: 16px;
  padding-right: 16px;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--light-gray, #e0e0e0);
  white-space: nowrap;
  flex-shrink: 0;
}

.table-header button {
  font-size: 11px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.table-title {
  font-weight: bold;
  font-size: 13px;
  margin: 0;
  padding: 0;
  margin-right: auto;
}

.metadata-info {
  font-size: 12px;
  color: #666;
}

.completed-status {
  font-size: 12px;
}

.completed-status > strong {
  color: var(--blue, #007bff);
  font-size: 16px;
}

/* 통일된 버튼 스타일 (파란색, 빨간색, 초록색만 사용) */
.action-button {
  font-size: 11px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
}

.action-button--blue {
  background-color: var(--blue, #007bff);
}

.action-button--blue:hover {
  background-color: #0056b3;
}

.action-button--red {
  background-color: #dc3545;
}

.action-button--red:hover {
  background-color: #c82333;
}

.action-button--green {
  background-color: var(--green, #28a745);
}

.action-button--green:hover {
  background-color: #218838;
}

.table-body {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.table-section {
  overflow-y: auto;
  overflow-x: auto;
  flex-shrink: 0;
  max-width: 60%;
}

.assignment-table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ddd;
  padding: 4px 6px;
  text-align: center;
  min-width: 30px;
  font-size: 11px;
}

tr.active {
  color: var(--white, #fff);
  background-color: var(--blue, #007bff);
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover:not(.active) {
  background-color: #f5f5f5;
}

.image-cell img {
  width: 20px;
  height: 20px;
  object-fit: cover;
}

.image-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.table-head,
.table-footer {
  position: sticky;
  background-color: var(--white, #fff);
}

.table-head {
  top: 0;
}

.table-footer {
  bottom: 0;
}

.table-footer th {
  border: 0;
  border-top: 2px solid #ddd;
}

.cell-pending {
  opacity: 0.4;
}

.cell-partial {
  opacity: 0.7;
}

.cell-complete {
  font-weight: bold;
}

.gs-badge {
  background-color: #ffc107;
  color: #333;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 10px;
}

.gs-fp-badge {
  background-color: #ffc107;
  color: #333;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 10px;
}

.gs-nipa-badge {
  background-color: #17a2b8;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 10px;
}

.gs-total-badge {
  background-color: #28a745;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 10px;
}

.status-complete {
  color: var(--green, #28a745);
  font-weight: bold;
}

.status-partial {
  color: #ffc107;
}

.status-pending {
  color: #999;
}

.legend-bar {
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  border-top: 1px solid var(--light-gray, #e0e0e0);
  background-color: #fafafa;
  flex-shrink: 0;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.legend-item::before {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-item.agree::before {
  background-color: #00ff00;
}

.legend-item.disagree::before {
  background-color: #ff0000;
}

.legend-item.pending::before {
  background-color: #ffa500;
}

.legend-item.gs::before {
  background-color: #ffc107;
}

.legend-item.nipa-2::before {
  background-color: #ff00ff;
}

.legend-item.nipa-3::before {
  background-color: #8b00ff;
}

.exporting-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px 24px;
  border-radius: 8px;
  z-index: 1000;
  font-size: 14px;
}

.loading-message {
  height: calc(100vh - 71px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #666;
}

/* Metrics Panel 스타일 */
.metrics-panel {
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  border-top: 1px solid var(--light-gray, #e0e0e0);
  background-color: #f8f9fa;
  flex-shrink: 0;
  padding: 0 16px;
}

.metrics-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metrics-label {
  font-size: 11px;
  color: #666;
}

.metrics-value {
  font-size: 13px;
  font-weight: bold;
  color: #333;
}

.metrics-value.highlight {
  color: var(--blue, #007bff);
}

.metrics-value.highlight-gold {
  color: #ffc107;
}

.metrics-value.success {
  color: var(--green, #28a745);
}

.metrics-value.danger {
  color: #dc3545;
}

.metrics-value.warning {
  color: #fd7e14;
}
</style>
