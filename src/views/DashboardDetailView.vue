<template>
  <div v-if="data.length" class="dashboard">
    <div v-if="isExporting" class="exporting-message">
      {{ exportingMessage }}
    </div>
    <h1 class="title">대시보드</h1>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">{{ assignmentTitle }}</span>
          <div v-if="assignmentMode === 'BBox'" class="slider-container">
            <i
              class="fa-solid fa-robot"
              :class="{ active: isAiMode }"
              @click="toggleAiMode"
            ></i>
            <span id="sliderValue">{{ `${sliderRange}인 일치` }}</span>
            <input
              type="range"
              min="1"
              :max="data.length"
              class="slider"
              id="slider"
              v-model="sliderValue"
            />
          </div>
          <span class="completed-status">
            <strong>{{ completionPercentage }}</strong>
          </span>
          <button class="edit-button" @click="moveToAssignmentManagement">
            과제수정
          </button>
          <button class="delete" @click="deleteAssignment">과제삭제</button>
          <button class="export-button" @click="exportToExcel">내보내기</button>
          <button @click="exportImage">이미지 다운로드</button>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="assignment-table">
              <thead class="table-head">
                <tr>
                  <th>이미지</th>
                  <th
                    v-for="(person, index) in data"
                    :key="person.name"
                    :style="getStyleForPerson(index)"
                  >
                    {{ person.name }}
                  </th>
                  <template v-if="assignmentMode === 'BBox'">
                    <th
                      v-for="index in [null, ...Array(data.length - 1).keys()]"
                      :key="index === null ? 'none' : index"
                    >
                      {{ index === null ? "일치 없음" : `${index + 2}인 일치` }}
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in data[0].questions"
                  :key="index"
                  :class="{ active: index === activeIndex }"
                  @click="setActiveImage(item.questionImage, index)"
                >
                  <td>
                    <img :src="item.questionImage" alt="과제 이야기 이미지" />
                  </td>
                  <td v-for="person in data" :key="person.name">
                    {{ getQuestionValue(person, item.questionId, index) }}
                  </td>
                  <template v-if="assignmentMode === 'BBox'">
                    <td>{{ getTotalBboxes(item.questionId) }}</td>
                    <td
                      v-for="overlapCount in Array(data.length - 1).keys()"
                      :key="overlapCount"
                    >
                      {{ getOverlaps(item.questionId, overlapCount + 2) }}
                    </td>
                  </template>
                </tr>
              </tbody>
              <tfoot class="table-footer">
                <tr>
                  <th>답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.answeredCount }}
                  </th>
                  <template v-if="assignmentMode === 'BBox'">
                    <th v-for="i in data.length" :key="i">
                      <i class="fa-solid fa-xmark"></i>
                    </th>
                  </template>
                </tr>
                <tr>
                  <th>미답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.unansweredCount }}
                  </th>
                  <template v-if="assignmentMode === 'BBox'">
                    <th v-for="i in data.length" :key="i">
                      <i class="fa-solid fa-xmark"></i>
                    </th>
                  </template>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="image-box">
            <component
              :is="
                assignmentMode === 'TextBox'
                  ? 'ImageComponent'
                  : 'BBoxViewerComponent'
              "
              :src="activeImageUrl"
              :questionIndex="activeQuestionIndex"
              :userSquaresList="userSquaresList"
              :sliderValue="Number(sliderValue)"
              :updateSquares="updateSquares"
              :aiData="isAiMode ? aiData : []"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="!data.length" class="loading-message">
    <p>과제를 불러오는 중입니다...</p>
  </div>
</template>

<script>
import { saveAs } from "file-saver";
import JSZip from "jszip";

export default {
  name: "DashboardDetailView",

  components: {
    ImageComponent: () => import("@/components/ImageComponent.vue"),
    BBoxViewerComponent: () => import("@/components/BBoxViewerComponent.vue"),
  },

  data() {
    return {
      data: [],
      activeImageUrl: "https://via.placeholder.com/1050",
      assignmentId: this.$route.params.id,
      activeIndex: 0,
      assignmentMode: "",
      colorList: [
        { backgroundColor: "#F70101", color: "white" },
        { backgroundColor: "#36A2EB", color: "white" },
        { backgroundColor: "#FF9F40", color: "white" },
        { backgroundColor: "#B2F302", color: "black" },
        { backgroundColor: "#FFA07A", color: "white" },
      ],
      sliderValue: 1,
      userSquaresList: [],
      tempSquares: [],
      flatSquares: [],
      exportingMessageIndex: 0,
      isExporting: false,
      keyPressInterval: null,
      keyRepeatDelay: 200,
      isAiMode: true,
      aiData: [],
    };
  },

  async created() {
    await this.loadData();
    await this.loadAiData();
    this.startExportingAnimation();
  },

  mounted() {
    this.addKeyboardEventListeners();
  },

  beforeUnmount() {
    this.removeKeyboardEventListeners();
  },

  watch: {
    sliderValue() {
      this.updateActiveRowValues();
    },
  },

  methods: {
    async loadData() {
      try {
        const { data } = await this.fetchAssignmentData();
        this.processAssignmentData(data);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    },

    async fetchAssignmentData() {
      return await this.$axios.get(`/api/dashboard/${this.assignmentId}`, {
        headers: {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        },
      });
    },

    processAssignmentData(data) {
      this.assignmentTitle = data.FileName;
      this.assignmentMode = data.assignmentMode;
      this.data = data.assignment;
      this.activeImageUrl = this.data[0].questions[0].questionImage;
      this.activeQuestionIndex = this.data[0].questions[0].questionId;
      this.flatSquares = this.data.flatMap((person) => person.squares);
      this.userSquaresList = this.createUserSquaresList();
    },

    createUserSquaresList() {
      return this.data.map((person, index) => ({
        beforeCanvas: person.beforeCanvas,
        squares: person.squares,
        color: this.colorList[index % this.colorList.length].backgroundColor,
      }));
    },

    async loadAiData() {
      try {
        const { data } = await this.fetchAiData();
        this.aiData = this.processAiData(data);
      } catch (error) {
        console.error("Failed to load AI data:", error);
      }
    },

    async fetchAiData() {
      return await this.$axios.get(
        `/api/assignments/${this.assignmentId}/ai/`,
        {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        }
      );
    },

    processAiData(data) {
      return data.map((ai) => ({
        ...ai,
        x: ai.x + 12.5,
        y: ai.y + 12.5,
      }));
    },

    addKeyboardEventListeners() {
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
    },

    removeKeyboardEventListeners() {
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
      this.clearKeyPressInterval();
    },

    handleKeyDown(event) {
      if (event.repeat) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        this.moveQuestion(event.key);
        this.keyPressInterval = setInterval(
          () => this.moveQuestion(event.key),
          this.keyRepeatDelay
        );
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
      const currentIndex = this.activeIndex;
      const questionsLength = this.data[0].questions.length;
      let newIndex = currentIndex;

      if (key === "ArrowDown" && currentIndex < questionsLength - 1) {
        newIndex = currentIndex + 1;
      } else if (key === "ArrowUp" && currentIndex > 0) {
        newIndex = currentIndex - 1;
      }

      if (newIndex !== currentIndex) {
        this.setActiveImage(
          this.data[0].questions[newIndex].questionImage,
          newIndex
        );
      }
    },

    setActiveImage(imageUrl, index) {
      this.activeImageUrl = imageUrl;
      this.activeIndex = index;
      this.activeQuestionIndex = this.data[0].questions[index].questionId;
      this.scrollToActiveRow();
      this.resetSliderValue();
    },

    scrollToActiveRow() {
      this.$nextTick(() => {
        const activeRow = this.$el.querySelector(
          ".assignment-table tbody tr.active"
        );
        if (activeRow) {
          activeRow.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    },

    resetSliderValue() {
      const oldSlideValue = this.sliderValue;
      this.sliderValue = null;
      this.$nextTick(() => {
        this.sliderValue = oldSlideValue;
      });
    },

    updateActiveRowValues() {
      const currentRow = this.data[0].questions[this.activeIndex];
      this.data.forEach((person) => {
        person.questions[this.activeIndex].questionSelection =
          this.getValidSquaresCount(person.squares, currentRow.questionId);
      });
    },

    moveToAssignmentManagement() {
      this.$router.push(`/edit-assignment/${this.assignmentId}`);
    },

    async deleteAssignment() {
      if (
        !confirm(
          "정말로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다."
        )
      )
        return;
      try {
        await this.$axios.delete(`/api/assignments/${this.assignmentId}`, {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        });
        this.$router.push({ name: "dashboard" });
      } catch (error) {
        console.error("과제 삭제 중 오류 발생:", error);
      }
    },

    updateSquares(squares) {
      this.tempSquares = squares;
      this.flatSquares = this.data.flatMap((person) => person.squares);
    },

    getValidSquaresCount(squares, questionId) {
      return squares.filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      ).length;
    },

    getTotalBboxes(questionId) {
      if (this.assignmentMode !== "BBox") return "";
      return this.data.reduce((acc, person) => {
        return acc + this.getValidSquaresCount(person.squares, questionId);
      }, 0);
    },

    getOverlaps(questionId, overlapCount) {
      if (this.assignmentMode !== "BBox") return "";
      const squares = this.getAllValidSquares(questionId);

      if (overlapCount === 1) {
        return squares.length;
      }

      const groups = this.findOverlappingGroups(squares);
      return groups.filter((group) => group.length >= overlapCount).length;
    },

    getAllValidSquares(questionId) {
      return this.data.flatMap((person) =>
        person.squares.filter(
          (square) => square.questionIndex === questionId && !square.isTemporary
        )
      );
    },

    findOverlappingGroups(squares) {
      const groups = [];
      const visited = new Set();

      squares.forEach((square) => {
        if (!visited.has(square)) {
          const group = [];
          this.dfs(square, squares, visited, group);
          groups.push(group);
        }
      });

      return groups;
    },

    dfs(square, squares, visited, group) {
      if (visited.has(square)) return;
      visited.add(square);
      group.push(square);

      squares.forEach((otherSquare) => {
        if (
          !visited.has(otherSquare) &&
          this.isOverlapping(square, otherSquare)
        ) {
          this.dfs(otherSquare, squares, visited, group);
        }
      });
    },

    isOverlapping(square1, square2) {
      return (
        Math.abs(square1.x - square2.x) <= 12.5 &&
        Math.abs(square1.y - square2.y) <= 12.5
      );
    },

    getMatchedCount(overlapGroups, aiData) {
      return overlapGroups.filter((group) =>
        group.some((bbox) =>
          aiData.some(
            (ai) =>
              Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
          )
        )
      ).length;
    },

    getOverlapsBBoxes(questionId, overlapCount) {
      const squares = this.getAllValidSquares(questionId);

      if (overlapCount === 1) {
        return squares.map((square) => [square]);
      }

      const adjustedSquares = this.adjustSquareCoordinates(squares, questionId);
      const groups = this.findOverlappingGroups(adjustedSquares);
      return groups.filter((group) => group.length >= overlapCount);
    },

    adjustSquareCoordinates(squares, questionId) {
      const question = this.data[0].questions.find(
        (q) => q.questionId === questionId
      );
      const image = new Image();
      image.src = question.questionImage;

      return squares.map((square) => {
        const { x, y } = this.convertToOriginalImageCoordinates(
          square.x,
          square.y,
          image.width,
          image.height
        );
        return { ...square, x, y };
      });
    },

    async exportToExcel() {
      this.isExporting = true;
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");

      this.setupWorksheetColumns(worksheet);
      this.populateWorksheetData(worksheet);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, "assignment_responses.xlsx");
      this.isExporting = false;
    },

    setupWorksheetColumns(worksheet) {
      const columns = [
        { header: "문제 번호", key: "questionNumber", width: 10 },
        ...this.data.map((user) => ({
          header: user.name,
          key: user.name,
          width: 15,
        })),
      ];

      if (this.assignmentMode === "BBox") {
        const halfRoundedEvaluatorCount = Math.round(this.data.length / 2);
        columns.push(
          {
            header: `+${halfRoundedEvaluatorCount}인`,
            key: `overlap${halfRoundedEvaluatorCount}`,
            width: 10,
          },
          {
            header: `${halfRoundedEvaluatorCount}일치`,
            key: `matched${halfRoundedEvaluatorCount}`,
            width: 10,
          },
          {
            header: `${halfRoundedEvaluatorCount}불일치`,
            key: `unmatched${halfRoundedEvaluatorCount}`,
            width: 10,
          },
          { header: "Json", key: "json", width: 30 }
        );
      }

      worksheet.columns = columns;
    },

    populateWorksheetData(worksheet) {
      const halfRoundedEvaluatorCount = Math.round(this.data.length / 2);

      this.data[0].questions.forEach((question, index) => {
        const row = this.createRowData(question, index);

        if (this.assignmentMode === "BBox") {
          this.addBBoxSpecificData(row, question, halfRoundedEvaluatorCount);
        }

        worksheet.addRow(row);
      });

      worksheet.getRow(1).font = { bold: true };
    },

    createRowData(question) {
      const questionImageFileName = question.questionImage.split("/").pop();
      const row = { questionNumber: questionImageFileName };

      this.data.forEach((user) => {
        row[user.name] = this.getValidSquaresCount(
          user.squares,
          question.questionId
        );
      });

      return row;
    },

    addBBoxSpecificData(row, question, halfRoundedEvaluatorCount) {
      const overlapGroups = this.getOverlapsBBoxes(
        question.questionId,
        halfRoundedEvaluatorCount
      );
      const overlapCount = overlapGroups.length;
      const matchedCount = this.getMatchedCount(overlapGroups, this.aiData);
      const unmatchedCount = overlapCount - matchedCount;

      row[`overlap${halfRoundedEvaluatorCount}`] = overlapCount;
      row[`matched${halfRoundedEvaluatorCount}`] = matchedCount;
      row[`unmatched${halfRoundedEvaluatorCount}`] = unmatchedCount;

      const adjustedBBoxes = this.getAdjustedBBoxes(question, overlapGroups);
      row["json"] = JSON.stringify({
        filename: question.questionImage.split("/").pop(),
        annotation: adjustedBBoxes,
      });
    },

    getAdjustedBBoxes(question, overlapGroups) {
      const image = new Image();
      image.src = question.questionImage;
      const originalWidth = image.width;
      const originalHeight = image.height;

      return overlapGroups.flat().map((bbox) => {
        const { x: adjustedX, y: adjustedY } =
          this.convertToOriginalImageCoordinates(
            bbox.x,
            bbox.y,
            originalWidth,
            originalHeight
          );
        return {
          category_id: bbox.category_id,
          bbox: [
            Math.round(adjustedX - 12.5),
            Math.round(adjustedY - 12.5),
            25,
            25,
          ],
        };
      });
    },

    convertToOriginalImageCoordinates(x, y, originalWidth, originalHeight) {
      const canvas = document.querySelector("canvas");
      const { width: canvasWidth, height: canvasHeight } = canvas;

      const currentPosition = this.calculateImagePosition(
        canvasWidth,
        canvasHeight,
        originalWidth,
        originalHeight
      );

      const scaleRatio = 1 / currentPosition.scale;

      const adjustedX = (x - currentPosition.x) * scaleRatio;
      const adjustedY = (y - currentPosition.y) * scaleRatio;

      return { x: adjustedX, y: adjustedY };
    },

    calculateImagePosition(canvasWidth, canvasHeight, imageWidth, imageHeight) {
      const scale = Math.min(
        canvasWidth / imageWidth,
        canvasHeight / imageHeight
      );
      const x = (canvasWidth - imageWidth * scale) / 2;
      const y = (canvasHeight - imageHeight * scale) / 2;
      return { x, y, scale };
    },

    async exportImage() {
      this.isExporting = true;
      this.startExportingAnimation();

      const zip = new JSZip();
      await this.addImagesToZip(zip);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "images.zip");

      this.isExporting = false;
      this.stopExportingAnimation();
      alert("이미지 다운로드가 완료되었습니다.");
    },

    async addImagesToZip(zip) {
      for (const question of this.data[0].questions) {
        const blob = await this.getImageBlob(question.questionImage);
        zip.file(`${question.questionImage.split("/").pop()}`, blob);
      }
    },

    getImageBlob(src) {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.src = src;
        image.onload = () => {
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);
          canvas.toBlob(resolve);
        };
      });
    },

    startExportingAnimation() {
      this.interval = setInterval(() => {
        this.exportingMessageIndex++;
      }, 500);
    },

    stopExportingAnimation() {
      clearInterval(this.interval);
    },

    toggleAiMode() {
      this.isAiMode = !this.isAiMode;
    },

    getQuestionValue(person, questionId, index) {
      if (this.assignmentMode === "TextBox") {
        const selection = person.questions[index].questionSelection;
        return selection === -1 ? "선택되지 않음" : selection;
      } else {
        return this.getValidSquaresCount(person.squares, questionId);
      }
    },

    getStyleForPerson(index) {
      return this.assignmentMode === "BBox" ? this.colorList[index] : {};
    },
  },

  computed: {
    completionPercentage() {
      return this.assignmentMode === "TextBox"
        ? this.calculateTextBoxCompletion()
        : this.calculateBBoxCompletion();
    },

    calculateTextBoxCompletion() {
      if (!this.data.length) return "0%";
      const totalAnswered = this.data.reduce(
        (acc, user) => acc + user.answeredCount,
        0
      );
      const totalUnanswered = this.data.reduce(
        (acc, user) => acc + user.unansweredCount,
        0
      );
      const totalQuestions = totalAnswered + totalUnanswered;
      return totalQuestions
        ? ((totalAnswered / totalQuestions) * 100).toFixed(2) + "%"
        : "0%";
    },

    calculateBBoxCompletion() {
      const count = this.getOverlaps(
        this.activeQuestionIndex,
        Number(this.sliderValue)
      );
      return count.toString();
    },

    totalPercentage() {
      if (this.assignmentMode === "TextBox") {
        return "100%";
      } else {
        return this.flatSquares.filter(
          (s) => s.questionIndex === this.activeQuestionIndex && !s.isTemporary
        ).length;
      }
    },

    sliderRange() {
      const rangeValues = Array.from(
        { length: this.data.length },
        (_, i) => i + 1
      );
      return rangeValues[this.sliderValue - 1] || "";
    },

    exportingMessage() {
      const baseMessage = "파일을 생성 중입니다";
      const dots = ".".repeat((this.exportingMessageIndex % 3) + 1);
      return `${baseMessage}${dots}`;
    },
  },
};
</script>

<style scoped>
.title {
  font-size: 24px;
  height: 60px;
  display: flex;
  align-items: center;
  padding-left: 24px;
  font-weight: 500;
  margin: 0;
  border-bottom: 1px solid var(--light-gray);
}

.table-header {
  height: 60px;
  display: flex;
  padding-left: 24px;
  padding-right: 46px;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--light-gray);
}

.table-body {
  display: flex;
  gap: 16px;
  padding-left: 24px;
}

.table-section {
  max-height: 710px;
  overflow-y: auto;
}

.assignment-table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
  min-width: 35px;
}

tr.active {
  color: var(--white);
  background-color: var(--blue);
}

td > img {
  width: 25px;
}

.image-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-right: 46px;
}

.image-box > img {
  width: 100%;
  margin: auto;
  object-fit: contain;
  max-height: 710px;
}

.table-head,
.table-footer {
  position: sticky;
  background-color: var(--white);
  bottom: 0;
}

.table-head {
  top: 0;
}

.export-button {
  background-color: var(--green);
}

.delete {
  background-color: var(--pink);
}

tfoot > tr > th {
  border: 0;
}

.fa-robot.active {
  color: var(--blue);
}

.fa-robot:hover {
  cursor: pointer;
}

.fa-robot.active:hover {
  color: var(--blue-hover);
}

.fa-robot:active {
  color: var(--blue-active);
}
</style>
