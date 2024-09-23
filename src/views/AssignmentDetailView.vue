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
        <div class="slider-group">
          <!-- 기존 #인일치 슬라이더 -->
          <label for="match-slider">#인일치:</label>
          <input
            type="range"
            id="match-slider"
            v-model="matchSliderValue"
            min="1"
            max="100"
            step="1"
          />
          <span>{{ matchSliderValue }}/100</span>
        </div>

        <div class="slider-group">
          <!-- 새로운 Score 슬라이더 -->
          <label for="score-slider">Score:</label>
          <input
            type="range"
            id="score-slider"
            v-model="scoreSliderValue"
            min="1"
            max="100"
            step="1"
          />
          <span>{{ scoreSliderValue }}/100</span>
        </div>

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

        <!-- 내보내기 버튼 -->
        <button
          type="button"
          class="export-button"
          @click="exportAssignmentResults"
        >
          내보내기
        </button>
      </div>
    </div>

    <div class="assignment-content">
      <div class="grades-table">
        <table>
          <thead>
            <tr>
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
        :squares="filteredSquares"
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
import * as XLSX from "xlsx"; // SheetJS 라이브러리 임포트

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
      keyRepeatDelay: 200, // milliseconds
      matchSliderValue: 50, // 기존 #인일치 슬라이더 값
      scoreSliderValue: 50, // 새로운 Score 슬라이더 값 (기본값 50, 즉 0.5)
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
      return this.currentAssignmentDetails.questions.filter(
        (question) => question.isInspected
      ).length;
    },
    filteredSquares() {
      // 슬라이더 값을 소수로 변환 (1~100 -> 0.01~1.00)
      const threshold = this.scoreSliderValue / 100;
      return this.currentAssignmentDetails.squares
        .map((square) => {
          // score가 없는 경우 0.6으로 설정
          if (square.score === undefined || square.score === null) {
            return { ...square, score: 0.6 };
          }
          return square;
        })
        .filter((square) => square.score >= threshold);
    },
    truePositives() {
      // #인일치 bboxes와 비교하여 TP 계산
      const matchedBBoxes = this.currentAssignmentDetails.inMatchBboxes || [];
      return this.filteredSquares.filter((aiBox) => {
        return matchedBBoxes.some((matchBox) =>
          this.isBBoxMatching(aiBox, matchBox)
        );
      }).length;
    },
    falsePositives() {
      return this.filteredSquares.length - this.truePositives;
    },
    falseNegatives() {
      const matchedBBoxes = this.currentAssignmentDetails.inMatchBboxes || [];
      return matchedBBoxes.length - this.truePositives;
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

        console.log(`
        ========================

        response.data : ${JSON.stringify(response.data)}
        
        ========================
        `);

        this.originalAssignmentDetails = JSON.parse(
          JSON.stringify(response.data)
        );

        this.currentAssignmentDetails = response.data;

        // 각 annotation에 score가 없으면 0.6으로 설정
        this.currentAssignmentDetails.questions.forEach((question) => {
          if (question.annotations) {
            question.annotations.forEach((annotation) => {
              if (annotation.score === undefined || annotation.score === null) {
                annotation.score = 0.6;
              }
            });
          }
        });

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
        if (this.activeQuestionId === 1) {
          this.activeQuestionId = this.currentAssignmentDetails.questions[0].id;
        }

        // 활성화된 행을 스크롤하여 보기
        this.$nextTick(() => {
          const activeRow = this.$el.querySelector("tbody tr.active");
          if (activeRow) {
            activeRow.scrollIntoView({
              block: "center",
              behavior: "smooth",
            });
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

      console.log(this.currentAssignmentDetails.squares);

      // 현재 질문에 대한 임시 박스가 없는 경우 더미 박스 추가
      const currentQuestionSquares =
        this.currentAssignmentDetails.squares.filter(
          (square) =>
            square.questionIndex === this.activeQuestionId &&
            !square.isTemporary
        );

      // 임시 AI 박스 제거
      currentQuestionSquares.forEach((square) => {
        if (square.isTemporaryAI) {
          this.currentAssignmentDetails.squares.splice(
            this.currentAssignmentDetails.squares.indexOf(square),
            1
          );
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
          // 다음 문제로 이동 (마지막 문제가 아니면)
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
      if (this.originalAssignmentDetails) {
        return this.originalAssignmentDetails.squares.filter(
          (square) => square.questionIndex === questionId && !square.isTemporary
        ).length;
      }
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
          activeRow.scrollIntoView({
            block: "center",
            behavior: "smooth",
          });
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

    isBBoxMatching(boxA, boxB, iouThreshold = 0.5) {
      const iou = this.calculateIoU(boxA.bbox, boxB.bbox);
      return iou >= iouThreshold;
    },

    calculateIoU(bboxA, bboxB) {
      const [xA, yA, wA, hA] = bboxA;
      const [xB, yB, wB, hB] = bboxB;

      const x1 = Math.max(xA, xB);
      const y1 = Math.max(yA, yB);
      const x2 = Math.min(xA + wA, xB + wB);
      const y2 = Math.min(yA + hA, yB + hB);

      const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const boxAArea = wA * hA;
      const boxBArea = wB * hB;

      const unionArea = boxAArea + boxBArea - intersectionArea;

      return unionArea === 0 ? 0 : intersectionArea / unionArea;
    },

    exportAssignmentResults() {
      // 엑셀 데이터 준비
      const exportData = [];

      // 각 질문에 대해 TP, FP, FN 계산
      this.currentAssignmentDetails.questions.forEach((question) => {
        // 질문에 관련된 AI 탐지 바운딩 박스를 필터링합니다.
        const aiBoxes = (this.currentAssignmentDetails.squares || []).filter(
          (square) =>
            square.questionIndex === question.id &&
            (square.score || 0.6) >= this.scoreSliderValue / 100
        );

        // #인일치 바운딩 박스 (매칭된 바운딩 박스) 데이터가 없는 경우 빈 배열로 설정
        const matchBBoxes =
          (this.currentAssignmentDetails.inMatchBboxes || []).filter(
            (matchBox) => matchBox.questionIndex === question.id
          ) || [];

        // TP, FP, FN 계산
        let TP = 0;
        let FP = 0;
        let FN = 0;

        aiBoxes.forEach((aiBox) => {
          const isTP = matchBBoxes.some((matchBox) =>
            this.isBBoxMatching(aiBox, matchBox)
          );
          if (isTP) {
            TP += 1;
          } else {
            FP += 1;
          }
        });

        FN = matchBBoxes.length - TP;

        exportData.push({
          파일명: this.currentAssignmentDetails.FileName,
          "질문 ID": question.id,
          "질문 이미지": question.image,
          TP: TP,
          FP: FP,
          FN: FN,
        });
      });

      // 엑셀 워크북과 시트 생성
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

      // 엑셀 파일 생성 및 다운로드
      XLSX.writeFile(
        workbook,
        `${this.currentAssignmentDetails.FileName}-results.xlsx`
      );
    },
  },

  watch: {
    activeQuestionId() {
      this.$nextTick(() => {
        const activeRow = this.$el.querySelector("tbody tr.active");
        if (activeRow) {
          activeRow.scrollIntoView({
            block: "center",
            behavior: "smooth",
          });
        } else {
          console.warn("Active row not found!");
        }
      });
    },
    // scoreSliderValue에 대한 watcher 제거
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

.slider-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-group label {
  margin-right: 4px;
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
  word-break: keep-all;
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
  z-index: 1000;
  background-color: var(--black);
  display: flex;
  justify-content: center;
  align-items: center;
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

/* BBox count cell styling */
td:nth-child(2) {
  font-weight: bold;
  color: var(--blue);
}

tr.isInspected > *,
tr.active > * {
  color: white;
}

.export-button {
  padding: 8px 16px;
  background-color: var(--blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.export-button:hover {
  background-color: darken(var(--blue), 10%);
}
</style>
