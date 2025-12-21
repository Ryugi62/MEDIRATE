<!-- ConsensusDetailView.vue -->

<template>
  <div v-if="currentConsensusDetails" class="consensus-detail-view">
    <h1 class="header-title">합의 평가</h1>

    <div class="consensus-overview">
      <div class="consensus-metadata">
        <h2 class="metadata-title">
          {{ currentConsensusDetails.title }}
        </h2>
        <span class="metadata-due-date">
          마감일: {{ formatDate(currentConsensusDetails.deadline) }}
        </span>
        <span v-if="currentConsensusDetails.evaluators" class="metadata-evaluators">
          평가자: {{ evaluatorNames }} ({{ currentConsensusDetails.evaluatorCount }}명)
        </span>
        <span v-if="canvasInfo.start_time" class="metadata-start-time">
          시작: {{ formatDateTime(canvasInfo.start_time) }}
        </span>
      </div>

      <div class="evaluation-actions">
        <span class="evaluation-score">
          <strong>{{ totalRespondedCount }}</strong> / {{ totalFpCount }}
        </span>
        <span class="legend">
          <span class="legend-item pending">미응답</span>
          <span class="legend-item agree">동의 (논 마이토시스)</span>
          <span class="legend-item disagree">비동의 (마이토시스)</span>
        </span>
      </div>
    </div>

    <div class="consensus-content">
      <div class="images-table">
        <table>
          <thead>
            <tr>
              <th class="col-num">번호</th>
              <th>이미지</th>
              <th>FP</th>
              <th>응답</th>
              <th>동의</th>
              <th>판정</th>
              <!-- 개별 평가자 열 -->
              <th
                v-for="evaluator in currentConsensusDetails.evaluators"
                :key="evaluator.id"
                class="evaluator-col"
                :title="evaluator.realname"
              >
                {{ getEvaluatorInitial(evaluator.realname) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(question, idx) in questionList"
              :key="question.image"
              @click="onRowClick(question, idx)"
              :class="{
                active: question.image === activeQuestionImage,
                completed: question.respondedCount === question.fpCount,
              }"
            >
              <td class="row-number">{{ idx + 1 }}</td>
              <td class="image-cell">
                <img :src="getImageThumbnail(question.image)" alt="Question" />
                <span class="image-name">{{ question.image }}</span>
              </td>
              <td class="fp-count">{{ question.fpCount }}</td>
              <td class="response-status">
                <span
                  :class="{
                    complete: question.respondedCount === question.fpCount,
                    partial:
                      question.respondedCount > 0 &&
                      question.respondedCount < question.fpCount,
                  }"
                >
                  {{ question.respondedCount }} / {{ question.fpCount }}
                </span>
              </td>
              <td class="agree-count">
                {{ question.agreeCount }} / {{ currentConsensusDetails.evaluatorCount || 3 }}
              </td>
              <td class="gold-standard">
                <span v-if="question.goldStandardCount > 0" class="gs-badge">
                  GS {{ question.goldStandardCount }}
                </span>
                <span v-else>-</span>
              </td>
              <!-- 개별 평가자 응답 상태 -->
              <td
                v-for="evaluator in currentConsensusDetails.evaluators"
                :key="evaluator.id"
                class="evaluator-response"
              >
                <span
                  :class="getEvaluatorResponseClass(question.image, evaluator.id)"
                  :title="getEvaluatorResponseTitle(question.image, evaluator.id, evaluator.realname)"
                >
                  {{ getEvaluatorResponseSymbol(question.image, evaluator.id) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ConsensusComponent
        :src="activeQuestionImageUrl"
        :fpSquares="currentImageFpSquares"
        :responses="localResponses"
        :questionImage="activeQuestionImage"
        :canvasInfo="canvasInfo"
        :evaluation_time="canvasInfo.evaluation_time || 0"
        :evaluatorCount="currentConsensusDetails.evaluatorCount || 3"
        :threshold="currentConsensusDetails.threshold || 2"
        :evaluators="currentConsensusDetails.evaluators || []"
        :evaluatorResponses="currentConsensusDetails.evaluatorResponses || {}"
        @commitConsensusChanges="commitConsensusChanges"
      />
    </div>

    <div class="keyboard-guide">
      <span>조작법:</span>
      <span class="key">왼클릭</span>=동의 |
      <span class="key">우클릭</span>=비동의 |
      <span class="key">Space</span>=전체 동의 |
      <span class="key">Shift+Space</span>=전체 비동의 |
      <span class="key">↑↓</span>=이미지 이동
    </div>
  </div>
  <div v-else class="loading-message">합의 과제를 불러오는 중입니다...</div>
</template>

<script>
import ConsensusComponent from "@/components/ConsensusComponent.vue";

export default {
  name: "ConsensusDetailView",

  data() {
    return {
      currentConsensusDetails: null,
      activeQuestionImage: "",
      activeQuestionImageUrl: "",
      localResponses: {}, // { fpSquareId: 'agree' | 'disagree' }
      canvasInfo: {
        width: 0,
        height: 0,
        evaluation_time: 0,
        start_time: null,
        end_time: null,
      },
      keyPressInterval: null,
      keyRepeatDelay: 200,
    };
  },

  async created() {
    await this.loadConsensusDetails(this.$route.params.id);
  },

  mounted() {
    this.$nextTick(() => {
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
    });
  },

  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.clearKeyPressInterval();
  },

  components: {
    ConsensusComponent,
  },

  computed: {
    // 평가자 이름 목록
    evaluatorNames() {
      if (!this.currentConsensusDetails || !this.currentConsensusDetails.evaluators) {
        return "";
      }
      return this.currentConsensusDetails.evaluators
        .map((e) => e.realname)
        .join(", ");
    },

    // 이미지별 FP 목록과 응답 상태 계산
    questionList() {
      if (!this.currentConsensusDetails || !this.currentConsensusDetails.fpSquares) {
        return [];
      }

      const imageMap = {};
      this.currentConsensusDetails.fpSquares.forEach((fp) => {
        if (!imageMap[fp.question_image]) {
          imageMap[fp.question_image] = {
            image: fp.question_image,
            fpCount: 0,
            respondedCount: 0,
            agreeCount: 0,
            goldStandardCount: 0,
          };
        }
        imageMap[fp.question_image].fpCount++;
        if (this.localResponses[fp.id]) {
          imageMap[fp.question_image].respondedCount++;
        }
        // 가장 높은 동의 수 추적
        if (fp.agree_count > imageMap[fp.question_image].agreeCount) {
          imageMap[fp.question_image].agreeCount = fp.agree_count;
        }
        // 골드 스탠다드 개수 집계
        if (fp.is_gold_standard) {
          imageMap[fp.question_image].goldStandardCount++;
        }
      });

      return Object.values(imageMap).sort((a, b) =>
        a.image.localeCompare(b.image)
      );
    },

    // 현재 이미지의 FP 사각형들
    currentImageFpSquares() {
      if (!this.currentConsensusDetails || !this.currentConsensusDetails.fpSquares) {
        return [];
      }
      return this.currentConsensusDetails.fpSquares.filter(
        (fp) => fp.question_image === this.activeQuestionImage
      );
    },

    // 전체 FP 개수
    totalFpCount() {
      if (!this.currentConsensusDetails || !this.currentConsensusDetails.fpSquares) {
        return 0;
      }
      return this.currentConsensusDetails.fpSquares.length;
    },

    // 응답 완료된 FP 개수
    totalRespondedCount() {
      return Object.keys(this.localResponses).length;
    },
  },

  methods: {
    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return date.toLocaleDateString();
    },

    formatDateTime(dateTimeString) {
      if (!dateTimeString) return "-";
      const date = new Date(dateTimeString);
      return date.toLocaleString();
    },

    async loadConsensusDetails(consensusId) {
      try {
        const response = await this.$axios.get(
          `/api/consensus/${consensusId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        this.currentConsensusDetails = response.data;

        // 기존 응답 데이터 로드 (API에서 객체 형태로 옴: {fpSquareId: response})
        if (this.currentConsensusDetails.responses) {
          // 객체 형태인 경우
          if (typeof this.currentConsensusDetails.responses === 'object' && !Array.isArray(this.currentConsensusDetails.responses)) {
            this.localResponses = { ...this.currentConsensusDetails.responses };
          } else if (Array.isArray(this.currentConsensusDetails.responses)) {
            // 배열 형태인 경우 (하위 호환)
            this.currentConsensusDetails.responses.forEach((resp) => {
              this.localResponses[resp.fp_square_id] = resp.response;
            });
          }
        }

        // 캔버스 정보 로드
        if (this.currentConsensusDetails.canvasInfo) {
          this.canvasInfo = {
            ...this.canvasInfo,
            ...this.currentConsensusDetails.canvasInfo,
          };
        }

        // 첫 번째 이미지로 설정 또는 마지막 작업 이미지로 설정
        if (this.questionList.length > 0) {
          const lastImage = this.canvasInfo.last_question_image;
          if (lastImage && this.questionList.some((q) => q.image === lastImage)) {
            this.activeQuestionImage = lastImage;
          } else {
            this.activeQuestionImage = this.questionList[0].image;
          }
          this.updateActiveImageUrl();
        }

        // 활성 행으로 스크롤
        this.$nextTick(() => {
          const activeRow = this.$el.querySelector("tbody tr.active");
          if (activeRow) {
            activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        });
      } catch (error) {
        console.error("Error loading consensus details:", error);
      }
    },

    updateActiveImageUrl() {
      if (this.currentConsensusDetails && this.activeQuestionImage) {
        const assignmentType = this.currentConsensusDetails.assignment_type;
        if (assignmentType) {
          this.activeQuestionImageUrl = `/api/assets/${assignmentType}/${this.activeQuestionImage}`;
        } else {
          console.warn("assignment_type이 설정되지 않았습니다.");
          this.activeQuestionImageUrl = "";
        }
      }
    },

    getImageThumbnail(imageName) {
      if (this.currentConsensusDetails) {
        const assignmentType = this.currentConsensusDetails.assignment_type;
        if (assignmentType) {
          return `/api/assets/${assignmentType}/${imageName}`;
        }
      }
      return "https://via.placeholder.com/25";
    },

    onRowClick(question, idx) {
      this.activeQuestionImage = question.image;
      this.updateActiveImageUrl();

      this.$nextTick(() => {
        const rows = this.$el.querySelectorAll(".images-table table tbody tr");
        rows.forEach((row) => row.classList.remove("active"));
        const activeRow = rows[idx];

        if (activeRow) {
          activeRow.classList.add("active");
          activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    },

    async commitConsensusChanges(data) {
      try {
        // 응답 저장 API 호출
        await this.$axios.put(
          `/api/consensus/${this.currentConsensusDetails.id}/response`,
          {
            responses: data.responses,
            question_image: this.activeQuestionImage,
            canvas_info: {
              width: data.canvasWidth || 0,
              height: data.canvasHeight || 0,
              evaluation_time: data.evaluation_time,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        // 로컬 응답 상태 업데이트
        this.localResponses = { ...this.localResponses, ...data.responses };

        // 캔버스 정보 업데이트
        this.canvasInfo.evaluation_time = data.evaluation_time;

        // 최신 데이터 다시 로드
        await this.loadConsensusDetails(this.currentConsensusDetails.id);

        // 다음 미완료 이미지로 이동 (옵션)
        if (data.goNext) {
          this.moveToNextIncompleteImage();
        }
      } catch (error) {
        console.error("합의 응답 저장 중 오류 발생:", error);
      }
    },

    moveToNextIncompleteImage() {
      const currentIdx = this.questionList.findIndex(
        (q) => q.image === this.activeQuestionImage
      );

      // 현재 이후 미완료 이미지 찾기
      for (let i = currentIdx + 1; i < this.questionList.length; i++) {
        if (this.questionList[i].respondedCount < this.questionList[i].fpCount) {
          this.onRowClick(this.questionList[i], i);
          return;
        }
      }

      // 처음부터 미완료 이미지 찾기
      for (let i = 0; i < currentIdx; i++) {
        if (this.questionList[i].respondedCount < this.questionList[i].fpCount) {
          this.onRowClick(this.questionList[i], i);
          return;
        }
      }
    },

    handleKeyDown(event) {
      if (event.repeat) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.moveQuestion(event.key);
        this.keyPressInterval = setInterval(() => {
          this.moveQuestion(event.key);
        }, this.keyRepeatDelay);
      }
    },

    handleKeyUp() {
      this.clearKeyPressInterval();
    },

    clearKeyPressInterval() {
      if (this.keyPressInterval) {
        clearInterval(this.keyPressInterval);
        this.keyPressInterval = null;
      }
    },

    moveQuestion(key) {
      if (key === "ArrowDown") {
        this.moveToNextQuestion();
      } else if (key === "ArrowUp") {
        this.moveToPreviousQuestion();
      }
    },

    moveToNextQuestion() {
      const currentIdx = this.questionList.findIndex(
        (q) => q.image === this.activeQuestionImage
      );
      if (currentIdx < this.questionList.length - 1) {
        this.onRowClick(this.questionList[currentIdx + 1], currentIdx + 1);
      }
    },

    moveToPreviousQuestion() {
      const currentIdx = this.questionList.findIndex(
        (q) => q.image === this.activeQuestionImage
      );
      if (currentIdx > 0) {
        this.onRowClick(this.questionList[currentIdx - 1], currentIdx - 1);
      }
    },

    // 평가자 이름 이니셜 가져오기
    getEvaluatorInitial(realname) {
      if (!realname) return "?";
      // 한글 이름인 경우 첫 글자, 영어인 경우 첫 글자 대문자
      return realname.charAt(0).toUpperCase();
    },

    // 이미지의 특정 평가자 응답 상태 가져오기
    getEvaluatorImageResponses(questionImage, evaluatorId) {
      if (!this.currentConsensusDetails || !this.currentConsensusDetails.evaluatorResponses) {
        return { total: 0, agree: 0, disagree: 0, pending: 0 };
      }

      const fpSquares = this.currentConsensusDetails.fpSquares.filter(
        (fp) => fp.question_image === questionImage
      );
      const evaluatorResponses = this.currentConsensusDetails.evaluatorResponses;

      let agree = 0;
      let disagree = 0;
      let pending = 0;

      fpSquares.forEach((fp) => {
        const responses = evaluatorResponses[fp.id];
        if (responses && responses[evaluatorId]) {
          if (responses[evaluatorId].response === "agree") {
            agree++;
          } else if (responses[evaluatorId].response === "disagree") {
            disagree++;
          }
        } else {
          pending++;
        }
      });

      return { total: fpSquares.length, agree, disagree, pending };
    },

    // 평가자 응답 심볼 가져오기
    getEvaluatorResponseSymbol(questionImage, evaluatorId) {
      const stats = this.getEvaluatorImageResponses(questionImage, evaluatorId);
      if (stats.total === 0) return "-";
      if (stats.pending === stats.total) return "-";
      return `${stats.agree}/${stats.total}`;
    },

    // 평가자 응답 클래스 가져오기
    getEvaluatorResponseClass(questionImage, evaluatorId) {
      const stats = this.getEvaluatorImageResponses(questionImage, evaluatorId);
      if (stats.total === 0) return "evaluator-none";
      if (stats.pending === stats.total) return "evaluator-pending";
      if (stats.pending === 0) {
        if (stats.agree === stats.total) return "evaluator-all-agree";
        if (stats.disagree === stats.total) return "evaluator-all-disagree";
        return "evaluator-mixed";
      }
      return "evaluator-partial";
    },

    // 평가자 응답 타이틀 가져오기
    getEvaluatorResponseTitle(questionImage, evaluatorId, realname) {
      const stats = this.getEvaluatorImageResponses(questionImage, evaluatorId);
      return `${realname}: 동의 ${stats.agree}, 비동의 ${stats.disagree}, 미응답 ${stats.pending}`;
    },
  },

  watch: {
    activeQuestionImage() {
      this.$nextTick(() => {
        const activeRow = this.$el.querySelector("tbody tr.active");
        if (activeRow) {
          activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    },
  },
};
</script>

<style scoped>
.consensus-detail-view {
  height: calc(100vh - 71px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  padding-left: 16px;
  height: 50px;
  border-bottom: 1px solid var(--light-gray);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.consensus-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  min-height: 40px;
  padding: 6px 0;
  flex-shrink: 0;
}

.consensus-metadata {
  display: flex;
  align-items: center;
  padding-left: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.metadata-title {
  margin: 0;
  font-size: 16px;
}

.metadata-due-date,
.metadata-start-time,
.metadata-end-time {
  font-size: 12px;
}

.evaluation-actions {
  display: flex;
  align-items: center;
  margin-right: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.evaluation-score {
  font-size: 13px;
}

.evaluation-score > strong {
  color: var(--blue);
  font-size: 16px;
}

.legend {
  display: flex;
  gap: 10px;
  font-size: 11px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.legend-item::before {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-item.pending::before {
  background-color: #ffa500;
}

.legend-item.agree::before {
  background-color: #00ff00;
}

.legend-item.disagree::before {
  background-color: #ff0000;
}

.consensus-content {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.images-table {
  width: 320px;
  min-width: 320px;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--light-gray);
  flex-shrink: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

thead {
  position: sticky;
  top: 0;
  background-color: var(--ultra-light-gray);
  z-index: 1;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background-color: #f5f5f5;
}

th,
td {
  padding: 6px 4px;
  text-align: center;
  border-bottom: 1px solid var(--light-gray);
  font-size: 11px;
}

th.col-num { width: 28px; }
th:nth-child(2) { width: auto; } /* 이미지 */
th:nth-child(3) { width: 28px; } /* FP */
th:nth-child(4) { width: 42px; } /* 응답 */
th:nth-child(5) { width: 36px; } /* 동의 */
th:nth-child(6) { width: 42px; } /* 판정 */

.image-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  text-align: left;
}

.image-cell img {
  width: 20px;
  height: 20px;
  object-fit: cover;
  flex-shrink: 0;
}

.image-name {
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-num,
.row-number {
  width: 32px;
  text-align: center;
}

.row-number {
  font-weight: bold;
  color: #666;
}

.fp-count {
  font-weight: bold;
  color: #ffa500;
}

.response-status {
  font-size: 10px;
}

.response-status .complete {
  color: #00aa00;
  font-weight: bold;
}

.response-status .partial {
  color: #ff8800;
}

.agree-count {
  font-size: 10px;
  color: #666;
}

.gold-standard {
  font-size: 10px;
}

.gs-badge {
  background-color: #4caf50;
  color: white;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 9px;
}

.metadata-evaluators {
  font-size: 12px;
  color: #666;
  background-color: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.images-table table tbody tr.active {
  background-color: var(--blue);
}

.images-table table tbody tr.active td,
.images-table table tbody tr.active .row-number,
.images-table table tbody tr.active .image-name,
.images-table table tbody tr.active .fp-count,
.images-table table tbody tr.active .response-status span {
  color: white;
}

.images-table table tbody tr.completed {
  background-color: #e8f5e9;
}

.images-table table tbody tr.completed.active {
  background-color: var(--blue);
}

.keyboard-guide {
  padding: 8px 16px;
  background-color: var(--ultra-light-gray);
  border-top: 1px solid var(--light-gray);
  font-size: 11px;
  color: #666;
  flex-shrink: 0;
}

.keyboard-guide .key {
  background-color: #e0e0e0;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  margin: 0 3px;
}

.loading-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 71px);
  font-size: 16px;
  color: #666;
}

/* 평가자 열 스타일 */
.evaluator-col {
  width: 30px;
  min-width: 30px;
  font-size: 10px;
  background-color: #f0f7ff;
}

.evaluator-response {
  font-size: 9px;
  text-align: center;
}

.evaluator-response span {
  display: inline-block;
  padding: 1px 3px;
  border-radius: 3px;
  font-weight: 500;
}

.evaluator-none {
  color: #999;
}

.evaluator-pending {
  color: #999;
  background-color: #f5f5f5;
}

.evaluator-partial {
  color: #ff8800;
  background-color: #fff3e0;
}

.evaluator-all-agree {
  color: #2e7d32;
  background-color: #e8f5e9;
}

.evaluator-all-disagree {
  color: #c62828;
  background-color: #ffebee;
}

.evaluator-mixed {
  color: #1565c0;
  background-color: #e3f2fd;
}
</style>
