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
        <span v-if="canvasInfo.start_time" class="metadata-start-time">
          시작 시간: {{ formatDateTime(canvasInfo.start_time) }}
        </span>
        <span v-if="canvasInfo.end_time" class="metadata-end-time">
          종료 시간: {{ formatDateTime(canvasInfo.end_time) }}
        </span>
      </div>

      <div class="evaluation-actions">
        <span class="evaluation-score">
          <strong>{{ totalRespondedCount }}</strong> / {{ totalFpCount }}
        </span>
        <span class="legend">
          <span class="legend-item pending">미응답</span>
          <span class="legend-item agree">동의</span>
          <span class="legend-item disagree">비동의</span>
        </span>
      </div>
    </div>

    <div class="consensus-content">
      <div class="images-table">
        <table>
          <thead>
            <tr>
              <th>이미지</th>
              <th>FP 개수</th>
              <th>응답</th>
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
          };
        }
        imageMap[fp.question_image].fpCount++;
        if (this.localResponses[fp.id]) {
          imageMap[fp.question_image].respondedCount++;
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
.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  padding-left: 24px;
  height: 60px;
  border-bottom: 1px solid var(--light-gray);
  display: flex;
  align-items: center;
}

.consensus-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  min-height: 60px;
  padding: 8px 0;
}

.consensus-metadata {
  display: flex;
  align-items: center;
  padding-left: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.metadata-title {
  margin: 0;
  font-size: 20px;
}

.metadata-due-date,
.metadata-start-time,
.metadata-end-time {
  font-size: 14px;
}

.evaluation-actions {
  display: flex;
  align-items: center;
  margin-right: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.evaluation-score {
  font-size: 14px;
}

.evaluation-score > strong {
  color: var(--blue);
  font-size: 20px;
}

.legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-item::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
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
  gap: 24px;
  padding: 24px;
  max-height: calc(100vh - 220px);
}

.images-table {
  width: 300px;
  min-width: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--light-gray);
}

table {
  width: 100%;
  border-collapse: collapse;
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
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid var(--light-gray);
}

.image-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.image-cell img {
  width: 25px;
  height: 25px;
  object-fit: cover;
}

.image-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.fp-count {
  font-weight: bold;
  color: #ffa500;
}

.response-status .complete {
  color: #00aa00;
  font-weight: bold;
}

.response-status .partial {
  color: #ff8800;
}

.images-table table tbody tr.active {
  background-color: var(--blue);
}

.images-table table tbody tr.active td,
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
  padding: 12px 24px;
  background-color: var(--ultra-light-gray);
  border-top: 1px solid var(--light-gray);
  font-size: 12px;
  color: #666;
}

.keyboard-guide .key {
  background-color: #e0e0e0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  margin: 0 4px;
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
