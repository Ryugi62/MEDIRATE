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
          <button class="export-button" @click="exportToExcel">내보내기</button>
          <button class="evaluate-button" @click="goToEvaluation">평가하기</button>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="assignment-table">
              <thead class="table-head">
                <tr>
                  <th>번호</th>
                  <th>이미지</th>
                  <th>FP</th>
                  <th
                    v-for="(evaluator, idx) in evaluators"
                    :key="evaluator.id"
                    :style="getStyleForEvaluator(idx)"
                  >
                    {{ evaluator.realname }}
                  </th>
                  <th>동의율</th>
                  <th>GS</th>
                  <th>상태</th>
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
                  <td
                    v-for="evaluator in evaluators"
                    :key="evaluator.id"
                    :class="getEvaluatorCellClass(question.image, evaluator.id)"
                  >
                    {{ getEvaluatorResponseSummary(question.image, evaluator.id) }}
                  </td>
                  <td>{{ getAgreeRate(question.image) }}%</td>
                  <td>
                    <span v-if="question.goldStandardCount > 0" class="gs-badge">
                      {{ question.goldStandardCount }}
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td>
                    <span :class="getStatusClass(question)">
                      {{ getStatusText(question) }}
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
          <div class="image-box">
            <ConsensusViewerComponent
              :src="activeImageUrl"
              :fpSquares="currentImageFpSquares"
              :evaluatorResponses="evaluatorResponsesForImage"
              :evaluators="evaluators"
              :threshold="consensusData.threshold || 2"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="legend-bar">
      <span class="legend-item agree">동의</span>
      <span class="legend-item disagree">비동의</span>
      <span class="legend-item pending">미응답</span>
      <span class="legend-item gs">GS</span>
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
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Consensus Analysis");

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
          worksheet.addRow(row);
        });

        worksheet.getRow(1).font = { bold: true };

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

.export-button {
  background-color: var(--green, #28a745);
  color: white;
}

.export-button:hover {
  background-color: #218838;
}

.evaluate-button {
  background-color: var(--blue, #007bff);
  color: white;
}

.evaluate-button:hover {
  background-color: #0056b3;
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
</style>
