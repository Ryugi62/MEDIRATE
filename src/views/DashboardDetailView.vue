<template>
  <div v-if="hasData" class="dashboard">
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
                    {{
                      assignmentMode === "TextBox"
                        ? person.questions[index].questionSelection === -1
                          ? "선택되지 않음"
                          : person.questions[index].questionSelection
                        : getValidSquaresCount(person.squares, item.questionId)
                    }}
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
  <div v-else class="loading-message">
    <p>과제를 불러오는 중입니다...</p>
  </div>
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";
import BBoxViewerComponent from "@/components/BBoxViewerComponent.vue";
import { saveAs } from "file-saver";
import JSZip from "jszip";

export default {
  name: "DashboardDetailView",
  components: {
    ImageComponent,
    BBoxViewerComponent,
  },
  data() {
    return {
      data: [],
      activeImageUrl: "https://via.placeholder.com/1050",
      assignmentId: this.$route.params.id,
      activeIndex: 0,
      assignmentMode: "",
      colorList: this.getColorList(),
      sliderValue: 1,
      userSquaresList: [],
      tempSquares: [],
      flatSquares: [],
      isExporting: false,
      keyPressInterval: null,
      keyRepeatDelay: 200,
      isAiMode: true,
      aiData: [],
    };
  },
  computed: {
    hasData() {
      return this.data.length > 0;
    },
    completionPercentage() {
      if (this.assignmentMode === "TextBox") {
        return this.calculateCompletionPercentage();
      } else {
        return this.getOverlaps(
          this.activeQuestionIndex,
          Number(this.sliderValue)
        ).toString();
      }
    },
    exportingMessage() {
      const baseMessage = "파일을 생성 중입니다";
      const dots = ".".repeat((this.exportingMessageIndex % 3) + 1);
      return `${baseMessage}${dots}`;
    },
    sliderRange() {
      const rangeValues = Array.from(
        { length: this.data.length },
        (_, i) => i + 1
      );
      return rangeValues[this.sliderValue - 1] || "";
    },
  },
  async created() {
    await this.loadData();
    await this.loadAiData();
    this.startExportingAnimation();
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
  watch: {
    sliderValue() {
      this.updateActiveRowValues();
    },
  },
  methods: {
    async loadData() {
      try {
        const response = await this.$axios.get(
          `/api/dashboard/${this.assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        this.initializeAssignmentData(response.data);
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    },
    async loadAiData() {
      try {
        const response = await this.$axios.get(
          `/api/assignments/${this.assignmentId}/ai/`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        this.processAiData(response.data);
      } catch (error) {
        console.error("Failed to load AI data:", error);
      }
    },
    initializeAssignmentData(data) {
      this.assignmentTitle = data.FileName;
      this.assignmentMode = data.assignmentMode;
      this.data = data.assignment;
      this.activeImageUrl = this.data[0].questions[0].questionImage;
      this.activeQuestionIndex = this.data[0].questions[0].questionId;
      this.flatSquares = this.data.flatMap((person) => person.squares);
      this.userSquaresList = this.data.map((person, index) => ({
        beforeCanvas: person.beforeCanvas,
        squares: person.squares,
        color: this.colorList[index % this.colorList.length].backgroundColor,
      }));
    },
    processAiData(aiData) {
      this.aiData = aiData.map((ai) => ({
        ...ai,
        x: ai.x + 12.5,
        y: ai.y + 12.5,
      }));
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
      const direction = key === "ArrowDown" ? 1 : -1;
      const newIndex = currentIndex + direction;
      if (newIndex >= 0 && newIndex < this.data[0].questions.length) {
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
    async exportToExcel() {
      this.isExporting = true;
      const halfRoundedEvaluatorCount = Math.round(this.data.length / 2);
      const columns = this.getExportColumns(halfRoundedEvaluatorCount);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");
      worksheet.columns = columns;
      this.data[0].questions.forEach((question, index) => {
        const row = this.prepareExportRow(
          question,
          index,
          halfRoundedEvaluatorCount
        );
        worksheet.addRow(row);
      });
      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      this.downloadExcel(buffer);
      this.isExporting = false;
    },
    getExportColumns(halfRoundedEvaluatorCount) {
      const columns = [
        { header: "문제 번호", key: "questionNumber", width: 10 },
        ...this.data.map((user) => ({
          header: user.name,
          key: user.name,
          width: 15,
        })),
      ];
      if (this.assignmentMode === "BBox") {
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
      return columns;
    },
    prepareExportRow(question, index, halfRoundedEvaluatorCount) {
      const questionImageFileName = question.questionImage.split("/").pop();
      const row = { questionNumber: questionImageFileName };
      this.data.forEach((user) => {
        row[user.name] = this.getValidSquaresCount(
          user.squares,
          question.questionId
        );
      });
      if (this.assignmentMode === "BBox") {
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
        const adjustedBBoxes = this.adjustBoundingBoxes(
          overlapGroups,
          question
        );
        row["json"] = JSON.stringify({
          filename: questionImageFileName,
          annotation: adjustedBBoxes,
        });
      }
      return row;
    },
    adjustBoundingBoxes(overlapGroups, question) {
      const image = new Image();
      image.src = question.questionImage;
      const { width, height } = image;
      return overlapGroups.flat().map((bbox) => {
        const { x, y } = this.convertToOriginalImageCoordinates(
          bbox.x,
          bbox.y,
          width,
          height
        );
        return {
          category_id: bbox.category_id,
          bbox: [Math.round(x - 12.5), Math.round(y - 12.5), 25, 25],
        };
      });
    },
    downloadExcel(buffer) {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, "assignment_responses.xlsx");
    },
    async exportImage() {
      this.isExporting = true;
      this.startExportingAnimation();
      const zip = new JSZip();
      for (const question of this.data[0].questions) {
        const blob = await this.createImageBlob(question);
        zip.file(question.questionImage.split("/").pop(), blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "images.zip");
      this.isExporting = false;
      this.stopExportingAnimation();
      alert("이미지 다운로드가 완료되었습니다.");
    },
    createImageBlob(question) {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.src = question.questionImage;
        image.onload = () => {
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);
          canvas.toBlob((blob) => resolve(blob));
        };
      });
    },
    toggleAiMode() {
      this.isAiMode = !this.isAiMode;
    },
    getValidSquaresCount(squares, questionId) {
      return squares.filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      ).length;
    },
    getTotalBboxes(questionId) {
      return this.assignmentMode === "BBox"
        ? this.data.reduce(
            (acc, person) =>
              acc + this.getValidSquaresCount(person.squares, questionId),
            0
          )
        : "";
    },
    getOverlaps(questionId, overlapCount) {
      if (this.assignmentMode !== "BBox") return "";
      let squares = [];
      this.data.forEach((person) => {
        squares = squares.concat(
          person.squares.filter(
            (square) =>
              square.questionIndex === questionId && !square.isTemporary
          )
        );
      });
      return this.calculateOverlapGroups(squares, overlapCount).length;
    },
    calculateOverlapGroups(squares, overlapCount) {
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

      return groups;
    },
    getOverlapsBBoxes(questionId, overlapCount) {
      let squares = this.data.flatMap((person) =>
        person.squares.filter(
          (square) => square.questionIndex === questionId && !square.isTemporary
        )
      );
      squares.forEach((square) => {
        const question = this.data[0].questions.find(
          (q) => q.questionId === questionId
        );
        const image = new Image();
        image.src = question.questionImage;
        const { x, y } = this.convertToOriginalImageCoordinates(
          square.x,
          square.y,
          image.width,
          image.height
        );
        square.x = x;
        square.y = y;
      });
      return this.calculateOverlapGroups(squares, overlapCount);
    },
    getMatchedCount(overlapGroups, aiData) {
      let matchedCount = 0;
      overlapGroups.forEach((group) => {
        if (
          group.some((bbox) =>
            aiData.some(
              (ai) =>
                Math.abs(bbox.x - ai.x) <= 12.5 &&
                Math.abs(bbox.y - ai.y) <= 12.5
            )
          )
        ) {
          matchedCount++;
        }
      });
      return matchedCount;
    },
    convertToOriginalImageCoordinates(x, y, originalWidth, originalHeight) {
      const canvas = document.querySelector("canvas");
      const { width: canvasWidth, height: canvasHeight } = canvas;
      const {
        x: posX,
        y: posY,
        scale,
      } = this.calculateImagePosition(
        canvasWidth,
        canvasHeight,
        originalWidth,
        originalHeight
      );
      return { x: (x - posX) / scale, y: (y - posY) / scale };
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
    calculateCompletionPercentage() {
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
    getColorList() {
      return [
        { backgroundColor: "#F70101", color: "white" },
        { backgroundColor: "#36A2EB", color: "white" },
        { backgroundColor: "#FF9F40", color: "white" },
        { backgroundColor: "#B2F302", color: "black" },
        { backgroundColor: "#FFA07A", color: "white" },
      ];
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
    startExportingAnimation() {
      this.interval = setInterval(() => {
        this.exportingMessageIndex++;
      }, 500);
    },
    stopExportingAnimation() {
      clearInterval(this.interval);
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

.table-body {
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
