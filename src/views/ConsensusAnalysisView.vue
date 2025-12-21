<!-- ConsensusAnalysisView.vue -->
<!-- Consensus 결과 분석을 위한 뷰어 (DashboardDetailView와 유사) -->

<template>
  <div v-if="consensusData" class="consensus-analysis">
    <div v-if="isExporting" class="exporting-message">
      {{ exportingMessage }}
    </div>
    <h1 class="title">Consensus 분석</h1>
    <div class="analysis-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">{{ consensusData.title }}</span>
          <div class="metadata">
            <span class="metadata-item">
              마감일: {{ formatDate(consensusData.deadline) }}
            </span>
            <span class="metadata-item">
              평가자: {{ evaluatorCount }}명
            </span>
            <span class="metadata-item">
              임계값: {{ consensusData.threshold || 2 }}
            </span>
          </div>
          <div class="action-buttons">
            <button class="export-button" @click="exportToExcel">내보내기</button>
            <button class="evaluate-button" @click="goToEvaluation">평가하기</button>
          </div>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="analysis-table">
              <thead class="table-head">
                <tr>
                  <th class="col-num">번호</th>
                  <th class="col-image">이미지</th>
                  <th class="col-fp">FP</th>
                  <th
                    v-for="evaluator in evaluators"
                    :key="evaluator.id"
                    class="col-evaluator"
                    :style="getStyleForEvaluator(evaluator)"
                  >
                    {{ evaluator.realname }}
                  </th>
                  <th class="col-agree">동의</th>
                  <th class="col-gs">GS</th>
                  <th class="col-status">상태</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(question, idx) in questionList"
                  :key="question.image"
                  :class="{ active: idx === activeIndex }"
                  @click="onRowClick(question, idx)"
                >
                  <td class="col-num">{{ idx + 1 }}</td>
                  <td class="col-image">
                    <img :src="getImageThumbnail(question.image)" alt="이미지" />
                    <span class="image-name">{{ getFileName(question.image) }}</span>
                  </td>
                  <td class="col-fp">{{ question.fpCount }}</td>
                  <td
                    v-for="evaluator in evaluators"
                    :key="evaluator.id"
                    class="col-evaluator"
                    :class="getEvaluatorCellClass(question.image, evaluator.id)"
                  >
                    {{ getEvaluatorResponseSummary(question.image, evaluator.id) }}
                  </td>
                  <td class="col-agree">
                    <span class="agree-rate">
                      {{ getAgreeRate(question.image) }}%
                    </span>
                  </td>
                  <td class="col-gs">
                    <span v-if="question.goldStandardCount > 0" class="gs-badge">
                      {{ question.goldStandardCount }}
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td class="col-status">
                    <span
                      :class="{
                        complete: question.isComplete,
                        partial: !question.isComplete && question.hasAnyResponse,
                      }"
                    >
                      {{ question.isComplete ? "완료" : question.hasAnyResponse ? "진행중" : "미시작" }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-footer">
                <tr>
                  <th colspan="3">총계</th>
                  <th v-for="evaluator in evaluators" :key="evaluator.id">
                    {{ getEvaluatorTotalResponses(evaluator.id) }}
                  </th>
                  <th>{{ overallAgreeRate }}%</th>
                  <th>{{ totalGoldStandard }}</th>
                  <th>{{ completedCount }}/{{ questionList.length }}</th>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="viewer-box">
            <ConsensusViewerComponent
              :src="activeImageUrl"
              :fpSquares="currentImageFpSquares"
              :evaluatorResponses="evaluatorResponsesForImage"
              :evaluators="evaluators"
              :threshold="consensusData.threshold || 2"
            />
            <div class="image-info">
              <strong>{{ activeImageName }}</strong>
              <span class="fp-info">FP: {{ currentImageFpSquares.length }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="legend-section">
      <span class="legend-item agree">동의 (논 마이토시스)</span>
      <span class="legend-item disagree">비동의 (마이토시스)</span>
      <span class="legend-item pending">미응답</span>
      <span class="legend-item gs">Gold Standard</span>
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

export default {
  name: "ConsensusAnalysisView",

  components: {
    ConsensusViewerComponent,
  },

  data() {
    return {
      consensusData: null,
      activeIndex: 0,
      activeImageUrl: "",
      activeImageName: "",
      isExporting: false,
      exportingMessage: "내보내기 중...",
      colorList: [
        { backgroundColor: "#F70101", color: "white" },
        { backgroundColor: "#36A2EB", color: "white" },
        { backgroundColor: "#FF9F40", color: "white" },
        { backgroundColor: "#B2F302", color: "black" },
        { backgroundColor: "#FFA07A", color: "white" },
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

        // 완료 상태 체크
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

    completedCount() {
      return this.questionList.filter((q) => q.isComplete).length;
    },
  },

  methods: {
    async loadConsensusData() {
      try {
        const consensusId = this.$route.params.id;
        const response = await this.$axios.get(
          `/api/consensus/${consensusId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        this.consensusData = response.data;

        // 첫 번째 이미지로 설정
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
        this.activeImageName = question.image;
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

    getFileName(path) {
      return path.split("/").pop();
    },

    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return date.toLocaleDateString();
    },

    getStyleForEvaluator(evaluator) {
      const idx = this.evaluators.indexOf(evaluator);
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
        return "pending";
      } else if (pending > 0) {
        return "partial";
      }
      return "complete";
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

    goToEvaluation() {
      this.$router.push({
        name: "consensusDetail",
        params: { id: this.$route.params.id },
      });
    },

    handleKeyDown(event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (this.activeIndex < this.questionList.length - 1) {
          this.setActiveImage(this.activeIndex + 1);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (this.activeIndex > 0) {
          this.setActiveImage(this.activeIndex - 1);
        }
      }
    },

    async exportToExcel() {
      this.isExporting = true;
      this.exportingMessage = "Excel 파일 생성 중...";

      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Consensus Analysis");

        // 헤더 생성
        const headers = [
          "번호",
          "이미지",
          "FP",
          ...this.evaluators.map((e) => e.realname),
          "동의율",
          "GS",
          "상태",
        ];
        worksheet.addRow(headers);

        // 데이터 추가
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
            question.isComplete ? "완료" : question.hasAnyResponse ? "진행중" : "미시작",
          ];
          worksheet.addRow(row);
        });

        // 파일 저장
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
.consensus-analysis {
  padding: 20px;
  background-color: var(--background-color, #f5f5f5);
  min-height: 100vh;
}

.title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: var(--text-color, #333);
}

.exporting-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px 40px;
  border-radius: 8px;
  z-index: 1000;
}

.analysis-content {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table-box {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: var(--primary-color, #007bff);
  color: white;
  flex-wrap: wrap;
  gap: 10px;
}

.table-title {
  font-size: 18px;
  font-weight: bold;
}

.metadata {
  display: flex;
  gap: 20px;
}

.metadata-item {
  font-size: 14px;
  opacity: 0.9;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.action-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.export-button {
  background-color: #28a745;
  color: white;
}

.export-button:hover {
  background-color: #218838;
}

.evaluate-button {
  background-color: white;
  color: var(--primary-color, #007bff);
}

.evaluate-button:hover {
  background-color: #f0f0f0;
}

.table-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.table-section {
  flex: 1;
  overflow: auto;
  max-width: 60%;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.analysis-table th,
.analysis-table td {
  padding: 8px 12px;
  text-align: center;
  border-bottom: 1px solid #e0e0e0;
}

.analysis-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 1;
}

.analysis-table tbody tr {
  cursor: pointer;
  transition: background-color 0.2s;
}

.analysis-table tbody tr:hover {
  background-color: #f0f7ff;
}

.analysis-table tbody tr.active {
  background-color: #e3f2fd;
}

.col-num {
  width: 50px;
}

.col-image {
  text-align: left;
  min-width: 150px;
}

.col-image img {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 4px;
  vertical-align: middle;
  margin-right: 8px;
}

.image-name {
  font-size: 12px;
  color: #666;
}

.col-fp,
.col-agree,
.col-gs,
.col-status {
  width: 60px;
}

.col-evaluator {
  width: 80px;
  font-weight: bold;
}

.col-evaluator.pending {
  opacity: 0.5;
}

.col-evaluator.partial {
  opacity: 0.8;
}

.agree-rate {
  font-weight: bold;
  color: #28a745;
}

.gs-badge {
  background-color: #ffc107;
  color: #333;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 11px;
}

.col-status span.complete {
  color: #28a745;
  font-weight: bold;
}

.col-status span.partial {
  color: #ffc107;
}

.table-footer th {
  background-color: #f8f9fa;
  font-weight: bold;
  border-top: 2px solid #dee2e6;
}

.viewer-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: #fafafa;
  border-left: 1px solid #e0e0e0;
  min-width: 40%;
}

.image-info {
  margin-top: 10px;
  text-align: center;
  color: #333;
}

.image-info .fp-info {
  margin-left: 10px;
  color: #666;
  font-size: 14px;
}

.legend-section {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 16px;
  background-color: white;
  border-top: 1px solid #e0e0e0;
  margin-top: 10px;
  border-radius: 8px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.legend-item::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
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

.loading-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 18px;
  color: #666;
}
</style>
