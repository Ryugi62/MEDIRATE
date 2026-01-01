<!-- AssignmentDetailView.vue -->

<template>
  <div v-if="currentAssignmentDetails" class="assignment-detail-view">
    <div class="assignment-overview">
      <div class="assignment-metadata">
        <h2 class="metadata-assignment-title">
          {{ currentAssignmentDetails.FileName }}
        </h2>
        <span class="metadata-student-name">
          {{ currentAssignmentDetails.studentName }}
        </span>
        <span class="metadata-due-date">
          마감일: {{ formatDate(currentAssignmentDetails.Deadline) }}
        </span>
        <span
          v-if="currentAssignmentDetails.beforeCanvas.start_time"
          class="metadata-start-time"
        >
          시작 시간:
          {{ formatDateTime(currentAssignmentDetails.beforeCanvas.start_time) }}
        </span>
        <span
          v-if="currentAssignmentDetails.beforeCanvas.end_time"
          class="metadata-end-time"
        >
          종료 시간:
          {{ formatDateTime(currentAssignmentDetails.beforeCanvas.end_time) }}
        </span>
      </div>

      <div class="evaluation-actions">
        <span class="evaluation-score">
          <strong v-if="isTextBoxMode">
            {{ currentAssignmentDetails.score }}
          </strong>
          <strong v-else>
            {{ uniqueQuestionCount }}
          </strong>
          / {{ currentAssignmentDetails.totalScore }}
        </span>
        <button
          v-if="isTextBoxMode"
          type="button"
          class="save-button"
          @click="commitAssignmentChanges"
        >
          저장
        </button>
      </div>
    </div>

    <div class="assignment-content">
      <div class="grades-table">
        <table>
          <thead>
            <tr>
              <th>순번</th>
              <th>문제</th>
              <th v-if="!isTextBoxMode">개수</th>
              <th
                v-for="grade in currentAssignmentDetails.selectionType"
                :key="grade"
              >
                {{ grade }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(question, idx) in currentAssignmentDetails.questions"
              :key="question.id"
              @click="onRowClick(question, idx)"
              :class="{
                active: question.id === activeQuestionId,
                isInspected: question.isInspected,
              }"
            >
              <td class="row-number">
                {{ idx + 1 }}
                <i v-if="question.isInspected" class="fas fa-check completed-check"></i>
              </td>
              <td>
                <img :src="question.image" alt="Question" />
              </td>
              <td v-if="!isTextBoxMode">{{ getBBoxCount(question.id) }}</td>
              <td
                v-for="(grade, index) in currentAssignmentDetails.selectionType"
                :key="index"
              >
                <input
                  type="radio"
                  :id="`grade-${idx}-${index}`"
                  :name="`grade-${idx}`"
                  :value="index"
                  :checked="question.selectedValue == index"
                  @change="updateSelectedValue(idx, $event.target.value)"
                />
                <label :for="`grade-${idx}-${index}`">{{ grade }}</label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="isTextBoxMode"
        class="student-response-image"
        :class="{ 'full-screen': isFullScreenImage }"
      >
        <ImageComponent
          :src="activeQuestionImageUrl"
          ref="studentResponseImage"
          alt="Student Response"
        />
        <i class="fa-solid fa-expand fa-2x" @click="toggleFullScreenImage"></i>
      </div>

      <BBoxComponent
        v-else-if="isBBoxMode"
        :src="activeQuestionImageUrl"
        :questionIndex="activeQuestionId"
        v-model:squares="currentAssignmentDetails.squares"
        :beforeCanvas="currentAssignmentDetails.beforeCanvas"
        :assignmentType="currentAssignmentDetails.assignmentType"
        :assignmentIndex="currentAssignmentDetails.id"
        @commitAssignmentChanges="commitAssignmentChanges"
        :is_score="!!currentAssignmentDetails.is_score"
        :is_ai_use="!!currentAssignmentDetails.is_ai_use"
        :is_timer="currentAssignmentDetails.is_timer !== false"
        :evaluation_time="currentAssignmentDetails.beforeCanvas.evaluation_time"
      />

      <SegmentComponent
        v-else-if="isSegmentMode"
        :src="activeQuestionImageUrl"
        :questionIndex="activeQuestionId"
        v-model:polygons="currentAssignmentDetails.polygons"
        :beforeCanvas="currentAssignmentDetails.beforeCanvas"
        :assignmentType="currentAssignmentDetails.assignmentType"
        :assignmentIndex="currentAssignmentDetails.id"
        @commitAssignmentChanges="commitAssignmentChanges"
        :is_score="!!currentAssignmentDetails.is_score"
        :is_ai_use="!!currentAssignmentDetails.is_ai_use"
        :is_timer="currentAssignmentDetails.is_timer !== false"
        :evaluation_time="currentAssignmentDetails.beforeCanvas.evaluation_time"
      />
    </div>
  </div>
  <div v-else class="loading-message">과제를 불러오는 중입니다...</div>
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";
import BBoxComponent from "@/components/BBoxComponent.vue";
import SegmentComponent from "@/components/SegmentComponent.vue";

export default {
  name: "AssignmentEvaluationView",

  data() {
    return {
      currentAssignmentDetails: null,
      isEditEnabled: false,
      activeQuestionId: 1,
      activeQuestionImageUrl: "https://via.placeholder.com/1050",
      isFullScreenImage: false,
      isSaving: false,
      isOut: false,
      keyPressInterval: null,
      keyRepeatDelay: 200, // 밀리초 단위, 필요에 따라 조정
    };
  },

  async created() {
    await this.loadAssignmentDetails(this.$route.params.id);
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
    ImageComponent,
    BBoxComponent,
    SegmentComponent,
  },

  computed: {
    isTextBoxMode() {
      return this.currentAssignmentDetails.assignmentMode === "TextBox";
    },
    isBBoxMode() {
      return this.currentAssignmentDetails.assignmentMode === "BBox";
    },
    isSegmentMode() {
      return this.currentAssignmentDetails.assignmentMode === "Segment";
    },
    uniqueQuestionCount() {
      return this.currentAssignmentDetails.questions.filter(
        (question) => question.isInspected
      ).length;
    },
  },

  methods: {
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    },
    formatDateTime(dateTimeString) {
      const date = new Date(dateTimeString);
      return date.toLocaleString();
    },
    async loadAssignmentDetails(assignmentId) {
      try {
        const response = await this.$axios.get(
          `/api/assignments/${assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        this.originalAssignmentDetails = JSON.parse(
          JSON.stringify(response.data)
        );
        this.currentAssignmentDetails = response.data;

        const score = this.currentAssignmentDetails.score || 0;
        this.currentAssignmentDetails.score = score;

        if (!this.isTextBoxMode) {
          this.currentAssignmentDetails.selectionType = [];
        }

        this.$nextTick(() => {
          this.makeTdClickable();
        });

        this.activeQuestionId =
          this.currentAssignmentDetails.beforeCanvas.lastQuestionIndex;

        const last_index = this.currentAssignmentDetails.questions.findIndex(
          (q) => q.id === this.activeQuestionId
        );

        this.activeQuestionImageUrl =
          this.currentAssignmentDetails.questions[
            last_index >= 0 ? last_index : 0
          ].image;

        if (this.activeQuestionId === 1) {
          this.activeQuestionId = this.currentAssignmentDetails.questions[0].id;
        }

        // 현재 활성화된 행을 찾아 스크롤하여 보이게 함 (테이블 내 스크롤만)
        this.$nextTick(() => {
          const activeRow = this.$el.querySelector("tbody tr.active");
          if (activeRow) {
            activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
          } else {
            console.warn("Active row not found!");
          }
        });
      } catch (error) {
        console.error("Error loading assignment details:", error);
      }
    },

    async commitAssignmentChanges(
      mode = "textbox",
      goNext = true,
      evaluation_time = 0
    ) {
      const radioButtons = this.$el.querySelectorAll(
        ".grades-table table tbody input[type='radio']"
      );
      radioButtons.forEach((radio) => (radio.disabled = true));

      // Apply 버튼을 누르지 않은 임시 AI 박스만 제거 (isTemporaryAI && isTemporary)
      const squaresToRemove = this.currentAssignmentDetails.squares.filter(
        (square) => square.questionIndex === this.activeQuestionId && square.isTemporaryAI && square.isTemporary
      );
      squaresToRemove.forEach((square) => {
        const index = this.currentAssignmentDetails.squares.indexOf(square);
        if (index > -1) {
          this.currentAssignmentDetails.squares.splice(index, 1);
        }
      });

      if (
        !this.currentAssignmentDetails.squares.some(
          (square) =>
            square.questionIndex === this.activeQuestionId && square.isTemporary
        )
      ) {
        this.currentAssignmentDetails.squares.push({
          x: 0,
          y: 0,
          questionIndex: this.activeQuestionId,
          isTemporary: true,
        });
      }

      const dataToSubmit = {
        id: this.currentAssignmentDetails.id,
        questions: this.currentAssignmentDetails.questions.map(
          (question, index) => ({
            id: question.id,
            selectedValue:
              question.selectedValue !== undefined
                ? question.selectedValue
                : null,
            index: index,
          })
        ),
        beforeCanvas: this.currentAssignmentDetails.beforeCanvas,
        squares: this.currentAssignmentDetails.squares,
        polygons: this.currentAssignmentDetails.polygons || [],  // Segment 모드용
        lastQuestionIndex: this.activeQuestionId,
        evaluation_time: evaluation_time, // Always use the new evaluation_time
      };

      try {
        await this.$axios.put(
          "/api/assignments/" + this.currentAssignmentDetails.id,
          dataToSubmit,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        this.isSaving = true;

        // 다른 탭에 업데이트 신호 전송 (실시간 상태 업데이트)
        localStorage.setItem('assignmentUpdated', JSON.stringify({
          id: this.currentAssignmentDetails.id,
          timestamp: Date.now()
        }));

        // 저장 후 최신 과제 정보를 다시 로드하여 start_time과 end_time 업데이트
        await this.loadAssignmentDetails(this.currentAssignmentDetails.id);

        if (!this.isOut && mode == "textbox") this.$router.push("/assignment");
        if (!this.isOut && (mode == "bbox" || mode == "segment") && goNext) {
          // 다음 문제로 이동, 만약 마지막 문제라면 이동하지 않음
          const currentIndex =
            this.currentAssignmentDetails.questions.findIndex(
              (q) => q.id === this.activeQuestionId
            );
          if (
            currentIndex <
            this.currentAssignmentDetails.questions.length - 1
          ) {
            const nextQuestion =
              this.currentAssignmentDetails.questions[currentIndex + 1];
            this.onRowClick(nextQuestion, currentIndex + 1);
          }

          this.isSaving = false;
        }

        this.originalAssignmentDetails = JSON.parse(
          JSON.stringify(this.currentAssignmentDetails)
        );
        this.updateQuestionStatus();
      } catch (error) {
        console.error("과제 저장 중 오류 발생:", error);
      }

      radioButtons.forEach((radio) => (radio.disabled = false));
    },

    updateQuestionStatus() {
      this.currentAssignmentDetails.questions =
        this.currentAssignmentDetails.questions.map((question) => {
          const hasSquare = this.currentAssignmentDetails.squares.some(
            (square) => square.questionIndex === question.id
          );
          // Segment 모드: polygons도 체크
          const hasPolygon = (this.currentAssignmentDetails.polygons || []).some(
            (polygon) => polygon.questionIndex === question.id
          );
          return {
            ...question,
            isInspected: hasSquare || hasPolygon,
          };
        });

      this.recalculateScore();
    },

    toggleEditState() {
      this.isEditEnabled = !this.isEditEnabled;
      if (!this.isEditEnabled) {
        this.draftAssignmentDetails = JSON.parse(
          JSON.stringify(this.currentAssignmentDetails)
        );
      }
    },

    makeTdClickable() {
      const table = this.$el.querySelector(".grades-table table");
      if (table) {
        table.addEventListener("click", (event) => {
          let target = event.target;

          if (target.tagName === "TD" || target.tagName === "LABEL") {
            if (target.tagName === "LABEL") {
              target = document.getElementById(target.getAttribute("for"));
            } else {
              target = target.querySelector('input[type="radio"]');
            }
            if (target) {
              const questionId = parseInt(target.name.split("-")[1], 10);
              const selectedValue = target.value;
              this.updateSelectedValue(questionId, selectedValue);
            }
          }
        });
      } else {
        console.warn("Table not found!");
      }
    },

    handleKeyDown(event) {
      if (event.repeat) return; // 키 반복 이벤트 무시

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); // B1: 웹페이지 스크롤 방지
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
      const currentIndex = this.currentAssignmentDetails.questions.findIndex(
        (q) => q.id === this.activeQuestionId
      );
      if (currentIndex < this.currentAssignmentDetails.questions.length - 1) {
        const nextQuestion =
          this.currentAssignmentDetails.questions[currentIndex + 1];
        this.onRowClick(nextQuestion, currentIndex + 1);
      }
    },

    moveToPreviousQuestion() {
      const currentIndex = this.currentAssignmentDetails.questions.findIndex(
        (q) => q.id === this.activeQuestionId
      );
      if (currentIndex > 0) {
        const previousQuestion =
          this.currentAssignmentDetails.questions[currentIndex - 1];
        this.onRowClick(previousQuestion, currentIndex - 1);
      }
    },

    getBBoxCount(questionId) {
      if (this.originalAssignmentDetails) {
        // BBox 개수
        const squareCount = this.originalAssignmentDetails.squares.filter(
          (square) => square.questionIndex === questionId && !square.isTemporary
        ).length;
        // Segment 폴리곤 개수
        const polygonCount = (this.originalAssignmentDetails.polygons || []).filter(
          (polygon) => polygon.questionIndex === questionId && !polygon.isTemporary
        ).length;
        return squareCount + polygonCount;
      }
      return 0;
    },

    onRowClick(question, idx) {
      this.activeQuestionId = question.id;
      this.activeQuestionImageUrl = question.image;

      this.$nextTick(() => {
        const rows = this.$el.querySelectorAll(".grades-table table tbody tr");
        rows.forEach((row) => row.classList.remove("active"));
        const activeRow = rows[idx];

        if (activeRow) {
          activeRow.classList.add("active");
          activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
          console.warn("Active row not found!");
        }
      });

      // BBox 개수 업데이트
      this.$forceUpdate();
    },

    updateSelectedValue(questionIdx, value) {
      const selectedValue = parseInt(value);
      this.currentAssignmentDetails.questions[questionIdx].selectedValue =
        selectedValue;
      this.recalculateScore();
    },

    recalculateScore() {
      const uniqueQuestionIndices = [
        ...new Set(
          this.currentAssignmentDetails.squares.map(
            (square) => square.questionIndex
          )
        ),
      ];
      this.currentAssignmentDetails.score = uniqueQuestionIndices.length;
    },

    toggleFullScreenImage() {
      this.isFullScreenImage = !this.isFullScreenImage;
    },
  },

  watch: {
    activeQuestionId() {
      this.$nextTick(() => {
        const activeRow = this.$el.querySelector("tbody tr.active");
        if (activeRow) {
          activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else {
          console.warn("Active row not found!");
        }
      });
    },
  },
};
</script>

<style scoped>
.assignment-detail-view {
  height: calc(100vh - 71px);
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.assignment-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  height: 50px;
  flex-shrink: 0;
}

.assignment-metadata {
  display: flex;
  align-items: center;
  padding-left: 12px;
  gap: 8px;
  flex-wrap: wrap;
}

.metadata-assignment-title {
  margin: 0;
  font-size: 16px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.metadata-student-name,
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
}

.evaluation-score {
  font-size: 13px;
}

.evaluation-score > strong {
  color: var(--blue);
  font-size: 18px;
}

.assignment-content {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.grades-table {
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--light-gray);
  word-break: keep-all;
  min-width: 150px;
  max-width: 300px;
  flex-shrink: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td > img {
  width: 22px;
}

thead {
  position: sticky;
  top: 0;
  background-color: white;
}

tbody tr:hover {
  background-color: #f5f5f5;
}

th,
td {
  padding: 6px 8px;
  text-align: center;
  border-bottom: 1px solid var(--light-gray);
  font-size: 12px;
}

.grades-table table tbody tr.active {
  background-color: var(--blue);
}

.student-response-image {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  max-height: 100%;
}

.student-response-image img {
  width: 100%;
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
}

.fa-expand {
  position: absolute;
  bottom: 16px;
  right: 16px;
  color: var(--white);
  background-color: var(--black);
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
}

.fa-expand:hover {
  max-height: fit-content;
}

.full-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background-color: var(--black);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  transition: all 1s;
}

.full-screen img {
  max-width: 100%;
  max-height: 100%;
}

.isInspected {
  background-color: #a8d4ff;
}
.isInspected:hover {
  background-color: #8bc4ff;
}

/* BBox 개수 셀에 대한 스타일 추가 */
td:nth-child(2) {
  font-weight: bold;
  color: var(--blue);

  /* 만약 셀렉트와 active는 font-color 변경 */
  &.active {
    color: var(--white);
  }
}

tr.isInspected > * {
  color: #333;
}
tr.active > * {
  color: white;
}

.row-number {
  font-weight: bold;
  color: #666;
  width: 45px;
  min-width: 45px;
}

.completed-check {
  color: #28a745;
  margin-left: 3px;
  font-size: 10px;
}

tr.active .completed-check {
  color: white;
}

.shortcut-help {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 16px;
  background-color: #f5f5f5;
  border-bottom: 1px solid var(--light-gray);
  font-size: 11px;
  color: #666;
  flex-shrink: 0;
}

.shortcut-help span {
  white-space: nowrap;
}

.shortcut-help kbd {
  background-color: #e0e0e0;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
  font-size: 10px;
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
