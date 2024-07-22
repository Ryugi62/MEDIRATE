<template>
  <div v-if="currentAssignmentDetails" class="assignment-detail-view">
    <h1 class="header-title">검수 작업</h1>

    <div class="assignment-overview">
      <div class="assignment-metadata">
        <h2 class="metadata-assignment-title">
          {{ currentAssignmentDetails.FileName }}
        </h2>
        <span class="metadata-student-name">
          {{ currentAssignmentDetails.studentName }}
        </span>
        <span class="metadata-due-date">
          마감일: {{ currentAssignmentDetails.Deadline.split("T")[0] }}
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
              <th>문제</th>
              <th v-if="!isTextBoxMode">BBox 개수</th>
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
        v-else
        :src="activeQuestionImageUrl"
        :questionIndex="activeQuestionId"
        :squares="currentAssignmentDetails.squares"
        :beforeCanvas="currentAssignmentDetails.beforeCanvas"
        :assignmentType="currentAssignmentDetails.assignmentType"
        :assignmentIndex="currentAssignmentDetails.id"
        @update:squares="currentAssignmentDetails.squares = $event"
        :commitAssignmentChanges="commitAssignmentChanges"
      />
    </div>
  </div>
  <div v-else class="loading-message">과제를 불러오는 중입니다...</div>
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";
import BBoxComponent from "@/components/BBoxComponent.vue";

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
      this.makeTdClickable();
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
  },

  computed: {
    isTextBoxMode() {
      return this.currentAssignmentDetails.assignmentMode === "TextBox";
    },
    uniqueQuestionCount() {
      return this.currentAssignmentDetails.squares
        .map((square) => square.questionIndex)
        .filter((value, index, self) => self.indexOf(value) === index).length;
    },
  },

  methods: {
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
        this.currentAssignmentDetails = response.data;

        const score = this.currentAssignmentDetails.score || 0;
        this.currentAssignmentDetails.score = score;

        if (!this.isTextBoxMode) {
          this.currentAssignmentDetails.selectionType = [];
        }

        this.$nextTick(() => {
          this.makeTdClickable();
        });

        this.activeQuestionImageUrl =
          this.currentAssignmentDetails.questions[0].image;
        this.activeQuestionId =
          this.currentAssignmentDetails.beforeCanvas.lastQuestionIndex;

        // Find the active row and ensure it is visible by scrolling it into view
        this.$nextTick(() => {
          const activeRow = this.$el.querySelector("tbody tr.active");
          if (activeRow) {
            activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
          } else {
            console.warn("Active row not found!");
          }
        });
      } catch (error) {
        console.error("Error loading assignment details:", error);
      }
    },

    async commitAssignmentChanges(mode = "textbox", goNext = true) {
      const radioButtons = this.$el.querySelectorAll(
        ".grades-table table tbody input[type='radio']"
      );
      radioButtons.forEach((radio) => (radio.disabled = true));

      // 현재 활성화된 질문에 대한 박스가 없는 경우 더미 박스 추가
      const currentQuestionSquares =
        this.currentAssignmentDetails.squares.filter(
          (square) =>
            square.questionIndex === this.activeQuestionId &&
            !square.isTemporary
        );
      if (currentQuestionSquares.length === 0) {
        if (
          !this.currentAssignmentDetails.squares.some(
            (square) =>
              square.questionIndex === this.activeQuestionId &&
              square.isTemporary
          )
        ) {
          this.currentAssignmentDetails.squares.push({
            x: 0,
            y: 0,
            questionIndex: this.activeQuestionId,
            isTemporary: true,
          });
        }
      }

      const dataToSubmit = {
        id: this.currentAssignmentDetails.id,
        questions: this.currentAssignmentDetails.questions.map((question) => ({
          id: question.id,
          selectedValue:
            question.selectedValue !== undefined
              ? question.selectedValue
              : null,
        })),
        beforeCanvas: this.currentAssignmentDetails.beforeCanvas,
        squares: this.currentAssignmentDetails.squares,
        lastQuestionIndex: this.activeQuestionId,
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
        if (!this.isOut && mode == "textbox") this.$router.push("/assignment");
        if (!this.isOut && mode == "bbox" && goNext) {
          // 다음 문제로 이동 만약 마지막 문제라면 이동하지 않음
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

        // 저장 후 화면 갱신
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
          return {
            ...question,
            isInspected: hasSquare,
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
      return this.currentAssignmentDetails.squares.filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      ).length;
    },

    // 기존 onRowClick 메서드 업데이트
    onRowClick(question, idx) {
      this.activeQuestionId = question.id;
      this.activeQuestionImageUrl = question.image;

      this.$nextTick(() => {
        const rows = this.$el.querySelectorAll(".grades-table table tbody tr");
        rows.forEach((row) => row.classList.remove("active"));
        const activeRow = rows[idx];

        if (activeRow) {
          activeRow.classList.add("active");
          activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
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

.assignment-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  height: 60px;
}

.assignment-metadata {
  display: flex;
  align-items: center;
  padding-left: 24px;
  gap: 16px;
}

.metadata-assignment-title {
  margin: 0;
  font-size: 20px;
}

.evaluation-actions {
  display: flex;
  align-items: center;
  margin-right: 46px;
  gap: 16px;
}

.evaluation-score {
  font-size: 14px;
}

.evaluation-score > strong {
  color: var(--blue);
  font-size: 20px;
}

.assignment-content {
  display: flex;
  gap: 24px;
  padding: 24px;
  max-height: 673px;
}

.grades-table {
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--light-gray);
}

table {
  width: 100%;
  border-collapse: collapse;
}

td > img {
  width: 25px;
}

thead {
  position: sticky;
  top: 0;
  background-color: var(--ultra-light-gray);
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
  background-color: black;
}
.isInspected:hover {
  background-color: #333;
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

tr.isInspected > *,
tr.active > * {
  color: white;
}
</style>
