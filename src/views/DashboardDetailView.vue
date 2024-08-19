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
            <i class="fa-solid fa-robot" :class="{ active: isAiMode }" @click="isAiMode = !isAiMode"></i>
            <span id="sliderValue">{{ `${sliderRange}인 일치` }}</span>
            <input type="range" min="1" :max="data.length" class="slider" id="slider" v-model="sliderValue" />
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
                  <th v-for="(person, index) in data" :key="person.name" :style="getStyleForPerson(index)">
                    {{ person.name }}
                  </th>
                  <template v-if="assignmentMode === 'BBox'">
                    <th v-for="index in [null, ...Array(data.length - 1).keys()]"
                      :key="index === null ? 'none' : index">
                      {{ index === null ? "전체 갯수" : `${index + 2}인 일치` }}
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in data[0].questions" :key="index" :class="{ active: index === activeIndex }"
                  @click="setActiveImage(item.questionImage, index)">
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
                    <td v-for="overlapCount in Array(data.length - 1).keys()" :key="overlapCount">
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
            <component :is="assignmentMode === 'TextBox'
              ? 'ImageComponent'
              : 'BBoxViewerComponent'
              " :src="activeImageUrl" :questionIndex="activeQuestionIndex" :userSquaresList="userSquaresList"
              :sliderValue="Number(sliderValue)" :updateSquares="updateSquares" :aiData="isAiMode ? aiData : []" />
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
      originalData: [],
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
    this.isExporting = true;

    try {
      await this.loadData();
      await this.loadAiData();
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      this.isExporting = false;
    }
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
        const { data } = await this.$axios.get(
          `/api/dashboard/${this.assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        this.assignmentTitle = data.FileName;
        this.assignmentMode = data.assignmentMode;
        this.data = data.assignment;
        this.originalData = JSON.parse(JSON.stringify(data.assignment));
        this.activeImageUrl = this.data[0].questions[0].questionImage;
        this.activeQuestionIndex = this.data[0].questions[0].questionId;

        const imageSizes = await Promise.all(this.data[0].questions.map(async (question) => {
          const { width, height } = await this.getImageDimensions(question.questionImage);
          return { questionId: question.questionId, width, height };
        }));

        this.userSquaresList = await Promise.all(this.data.map((person, index) => {
          const color = this.colorList[index % this.colorList.length].backgroundColor;
          const { width: canvasWidth, height: canvasHeight } = person.beforeCanvas;

          const processedSquares = person.squares.map(square => {
            const imageSize = imageSizes.find(size => size.questionId === square.questionIndex);
            return this.detectAndConvertCoordinates(square, imageSize.width, imageSize.height, canvasWidth, canvasHeight);
          });

          return {
            beforeCanvas: person.beforeCanvas,
            squares: processedSquares,
            color
          };
        }));

        console.log("userSquaresList:", this.userSquaresList);

      } catch (error) {
        console.error("Failed to load data:", error);
      }
    },

    detectAndConvertCoordinates(square, imageWidth, imageHeight, canvasWidth, canvasHeight) {
      if (!square.isAI) return { ...square, wasConverted: false };

      if (this.isDebugMode) {
        console.log(`Input square:`, JSON.stringify(square));
        console.log(`Image dimensions: ${imageWidth}x${imageHeight}, Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
      }

      try {
        const isWithinCanvas = this.checkWithinCanvas(square, canvasWidth, canvasHeight);
        const { squareRatio, imageRatio, canvasRatio } = this.calculateRatios(square, imageWidth, imageHeight, canvasWidth, canvasHeight);
        const { imageScale, canvasScale } = this.calculateScales(square, imageWidth, canvasWidth);

        if (this.isDebugMode) {
          console.log(`isWithinCanvas: ${isWithinCanvas}, squareRatio: ${squareRatio}, imageRatio: ${imageRatio}, canvasRatio: ${canvasRatio}, imageScale: ${imageScale}, canvasScale: ${canvasScale}`);
        }

        if (this.shouldConvertCoordinates(isWithinCanvas, squareRatio, imageRatio, canvasRatio, imageScale, canvasScale)) {
          const convertedCoordinates = this.convertCoordinates(square, imageWidth, imageHeight, canvasWidth, canvasHeight);
          if (this.isDebugMode) {
            console.log(`Converted coordinates:`, JSON.stringify(convertedCoordinates));
          }
          return convertedCoordinates;
        }

        return { ...square, wasConverted: false };
      } catch (error) {
        console.error('Error in detectAndConvertCoordinates:', error);
        return { ...square, wasConverted: false, error: error.message };
      }
    },

    checkWithinCanvas(square, canvasWidth, canvasHeight) {
      return square.x <= canvasWidth && square.y <= canvasHeight;
    },

    calculateRatios(square, imageWidth, imageHeight, canvasWidth, canvasHeight) {
      const squareRatio = (square.height && square.width) ? square.width / square.height : 1;
      const imageRatio = imageHeight ? imageWidth / imageHeight : 1;
      const canvasRatio = canvasHeight ? canvasWidth / canvasHeight : 1;
      return { squareRatio, imageRatio, canvasRatio };
    },

    calculateScales(square, imageWidth, canvasWidth) {
      const imageScale = (square.width && imageWidth) ? square.width / imageWidth : 1;
      const canvasScale = (square.width && canvasWidth) ? square.width / canvasWidth : 1;
      return { imageScale, canvasScale };
    },

    shouldConvertCoordinates(isWithinCanvas, squareRatio, imageRatio, canvasRatio, imageScale, canvasScale) {
      return isWithinCanvas &&
        Math.abs(squareRatio - imageRatio) < Math.abs(squareRatio - canvasRatio) &&
        Math.abs(imageScale - 1) < Math.abs(canvasScale - 1);
    },

    convertCoordinates(square, imageWidth, imageHeight, canvasWidth, canvasHeight) {
      const scaleX = canvasWidth / imageWidth;
      const scaleY = canvasHeight / imageHeight;
      const scale = Math.min(scaleX, scaleY);

      const adjustedX = (square.x * scale) + (canvasWidth - imageWidth * scale) / 2;
      const adjustedY = (square.y * scale) + (canvasHeight - imageHeight * scale) / 2;
      const adjustedWidth = (square.width || 25) * scale;
      const adjustedHeight = (square.height || 25) * scale;

      return {
        ...square,
        x: adjustedX,
        y: adjustedY,
        width: adjustedWidth,
        height: adjustedHeight,
        wasConverted: true
      };
    },

    getImageDimensions(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = src;
      });
    },


    // 원본 이미지 좌표를 캔버스 좌표로 변환하는 메서드
    convertToCanvasCoordinates(x, y, originalWidth, originalHeight, canvasWidth, canvasHeight) {
      const scaleX = canvasWidth / originalWidth;
      const scaleY = canvasHeight / originalHeight;
      const scale = Math.min(scaleX, scaleY);

      const canvasX = (x * scale) + (canvasWidth - originalWidth * scale) / 2;
      const canvasY = (y * scale) + (canvasHeight - originalHeight * scale) / 2;

      return { x: canvasX, y: canvasY };
    },

    async loadAiData() {
      try {
        const { data } = await this.$axios.get(
          `/api/assignments/${this.assignmentId}/ai/`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        this.aiData = data.map((ai) => ({
          ...ai,
          x: ai.x + 12.5,
          y: ai.y + 12.5,
        }));
      } catch (error) {
        console.error("Failed to load AI data:", error);
      }
    },

    handleKeyDown(event) {
      if (event.repeat) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        this.moveQuestion(event.key);
        this.keyPressInterval = setInterval(() => {
          this.moveQuestion(event.key);
        }, this.keyRepeatDelay);
      }
    },

    getValidSquaresCount(squares, questionId) {
      const count = squares.filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      ).length;
      return count;
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

      if (key === "ArrowDown" && currentIndex < questionsLength - 1) {
        this.setActiveImage(
          this.data[0].questions[currentIndex + 1].questionImage,
          currentIndex + 1
        );
      } else if (key === "ArrowUp" && currentIndex > 0) {
        this.setActiveImage(
          this.data[0].questions[currentIndex - 1].questionImage,
          currentIndex - 1
        );
      }
    },

    setActiveImage(imageUrl, index) {
      this.activeImageUrl = imageUrl;
      this.activeIndex = index;
      this.activeQuestionIndex = this.data[0].questions[index].questionId;

      this.$nextTick(() => {
        const activeRow = this.$el.querySelector(
          ".assignment-table tbody tr.active"
        );
        if (activeRow) {
          activeRow.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

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
      this.flatSquares = this.data.map((person) => person.squares).flat();
    },

    getTotalBboxes(questionId) {
      if (this.assignmentMode !== "BBox") return "";
      return this.data.reduce((acc, person) => {
        const count = person.squares.filter(
          (square) => square.questionIndex === questionId && !square.isTemporary
        ).length;
        return acc + count;
      }, 0);
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

      if (overlapCount === 1) {
        return squares.length;
      }

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

      return groups.length;
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

    getOverlapsBBoxes(squares, overlapCount) {
      if (overlapCount === 1) {
        return squares.map((square) => [square]);
      }

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

    async getAdjustedSquares(users, question) {
      const { width: originalWidth, height: originalHeight } =
        await this.getImageDimensions(question.questionImage);

      return users.flatMap((user) =>
        user.squares
          .filter(
            (square) =>
              square.questionIndex === question.questionId &&
              !square.isTemporary
          )
          .map((square) => {
            const { x: adjustedX, y: adjustedY } =
              this.convertToOriginalImageCoordinates(
                square.x,
                square.y,
                user.beforeCanvas.width,
                user.beforeCanvas.height,
                originalWidth,
                originalHeight
              );
            return {
              ...square,
              x: adjustedX,
              y: adjustedY,
              width: 25,
              height: 25,
            };
          })
      );
    },

    convertToOriginalImageCoordinates(
      x,
      y,
      canvasWidth,
      canvasHeight,
      originalWidth,
      originalHeight
    ) {
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

    async exportToExcel() {
      this.isExporting = true;
      const aiData = this.aiData;
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");
      const halfRoundedEvaluatorCount = Math.round(this.data.length / 2);
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
            header: `AI개수`,
            key: `aiCount`,
            width: 10,
          },
          {
            header: `${halfRoundedEvaluatorCount}일치`,
            key: `matched${halfRoundedEvaluatorCount}`,
            width: 10,
          },
          {
            header: `FN`,
            key: `fn${halfRoundedEvaluatorCount}`,
            width: 10,
          },
          {
            header: `FP`,
            key: `fp${halfRoundedEvaluatorCount}`,
            width: 10,
          },
          {
            header: `JSON`,
            key: `json`,
            width: 30,
          }
        );
      }
      worksheet.columns = columns;

      for (let index = 0; index < this.data[0].questions.length; index++) {
        const question = this.data[0].questions[index];
        const questionImageFileName = question.questionImage.split("/").pop();
        const row = { questionNumber: questionImageFileName };
        this.data.forEach((user) => {
          row[user.name] = this.getValidSquaresCount(
            user.squares,
            question.questionId
          );
        });

        if (this.assignmentMode === "BBox") {
          const adjustedSquares = await this.getAdjustedSquares(
            this.originalData,
            question
          );
          const relevantAiData = aiData.filter(
            (ai) => ai.questionIndex === question.questionId
          );
          const overlapGroups = this.getOverlapsBBoxes(
            adjustedSquares,
            halfRoundedEvaluatorCount
          );
          const overlapCount = overlapGroups.length;
          const matchedCount = this.getMatchedCount(
            overlapGroups,
            relevantAiData
          );

          row[`overlap${halfRoundedEvaluatorCount}`] = overlapCount;
          row["aiCount"] = relevantAiData.length;
          row[`matched${halfRoundedEvaluatorCount}`] = matchedCount;
          row[`fn${halfRoundedEvaluatorCount}`] = overlapCount - matchedCount;
          row[`fp${halfRoundedEvaluatorCount}`] =
            relevantAiData.length - matchedCount;
          row["json"] = JSON.stringify({
            fileName: questionImageFileName,
            annotation: overlapGroups.map((group) => {
              const x = Math.round(
                group.reduce((acc, bbox) => acc + bbox.x, 0) / group.length -
                12.5
              );
              const y = Math.round(
                group.reduce((acc, bbox) => acc + bbox.y, 0) / group.length -
                12.5
              );

              return [x, y, 25, 25];
            }),
          });
        }

        worksheet.addRow(row);
      }

      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `${this.assignmentTitle}.xlsx`);
      this.isExporting = false;
    },

    async exportImage() {
      this.isExporting = true;
      this.startExportingAnimation();

      const zip = new JSZip();
      for (let index = 0; index < this.data[0].questions.length; index++) {
        const question = this.data[0].questions[index];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.src = question.questionImage;
        await new Promise((resolve) => {
          image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
              zip.file(`${question.questionImage.split("/").pop()}`, blob);
              resolve();
            });
          };
        });
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "images.zip");

      this.isExporting = false;
      this.stopExportingAnimation();
      alert("이미지 다운로드가 완료되었습니다.");
    },

    getStyleForPerson(index) {
      return this.assignmentMode === "BBox" ? this.colorList[index] : {};
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

  computed: {
    completionPercentage() {
      if (this.assignmentMode === "TextBox") {
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
      } else {
        const count = this.getOverlaps(
          this.activeQuestionIndex,
          Number(this.sliderValue)
        );

        return count.toString();
      }
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
      const baseMessage = "잠시만 기다려주세요. 데이터를 다운로드 중입니다.";
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
  padding-left: 24px;
}

.table-title {
  font-weight: bold;
  margin: 0;
  padding: 0;
  margin-right: auto;
}

.slider-container {
  display: flex;
  gap: 8px;
}

.completed-status {
  font-size: 14px;
}

.completed-status>strong {
  color: var(--blue);
  font-size: 20px;
}

.table-body {
  display: flex;
  gap: 16px;
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

td>img {
  width: 25px;
}

.image-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-right: 46px;
}

.image-box>img {
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

tfoot>tr>th {
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