<template>
  <div v-if="data.length" class="dashboard">
    <div v-if="isExporting" class="exporting-message">
      {{ exportingMessage }}
    </div>
    <h1 class="title">대시보드</h1>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">과제 이야기</span>
          <div class="slider-container" v-if="assignmentMode === 'BBox'">
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
            <strong>{{ completionPercentage }}</strong> / {{ totalPercentage }}
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
                  <th v-for="(person, index) in data" :key="index">
                    {{ !index ? "일치 없음" : `${index + 1}인 일치` }}
                  </th>
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
                    {{ person.questions[index].questionSelection }}
                  </td>
                  <td
                    v-for="(person, overlapDeepest) in data"
                    :key="person.name"
                  >
                    {{
                      getOverlapSquares(
                        item.questionId,
                        Number(overlapDeepest) + 1
                      )
                    }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-footer">
                <tr>
                  <th>답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.answeredCount }}
                  </th>
                  <th v-for="person in data" :key="person.name">
                    <i class="fa-solid fa-xmark"></i>
                  </th>
                </tr>
                <tr>
                  <th>미답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.unansweredCount }}
                  </th>
                  <th v-for="person in data" :key="person.name">
                    <i class="fa-solid fa-xmark"></i>
                  </th>
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
      exportingMessageIndex: 0,
      isExporting: false,
    };
  },

  async created() {
    await this.loadData();

    this.startExportingAnimation();
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
        this.assignmentMode = data.assignmentMode;
        this.data = data.assignment;
        this.activeImageUrl = this.data[0].questions[0].questionImage;
        this.activeQuestionIndex = this.data[0].questions[0].questionId;
        this.userSquaresList = this.data.map((person, index) => ({
          beforeCanvas: person.beforeCanvas,
          squares: person.squares,
          color: this.colorList[index % this.colorList.length].backgroundColor,
        }));
      } catch (error) {
        console.error("Failed to load data:", error);
      }
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
    },

    getOverlapSquares(questionID, overlapDeepest) {
      const originalSquares = this.tempSquares.filter(
        (s) => s.questionIndex === questionID
      );
      const squares = [];
      originalSquares.forEach((square) => {
        const count =
          originalSquares
            .filter(
              (s) =>
                Math.abs(s.x - square.x) <= 5 &&
                Math.abs(s.y - square.y) <= 5 &&
                s.user_id !== square.user_id
            )
            .filter(
              (s, index, self) =>
                index === self.findIndex((ss) => ss.user_id === s.user_id)
            ).length + 1;
        if (
          count === overlapDeepest &&
          !squares.some(
            (s) =>
              Math.abs(s.x - square.x) <= 5 &&
              Math.abs(s.y - square.y) <= 5 &&
              s.user_id !== square.user_id
          )
        ) {
          squares.push(square);
        }
      });
      return squares.length;
    },

    getAllOverlapSquares(questionID, overlapDeepest) {
      const originalSquares = this.tempSquares.filter(
        (s) => s.questionIndex === questionID
      );
      const squares = [];
      originalSquares.forEach((square) => {
        const count =
          originalSquares
            .filter(
              (s) =>
                Math.abs(s.x - square.x) <= 5 &&
                Math.abs(s.y - square.y) <= 5 &&
                s.user_id !== square.user_id
            )
            .filter(
              (s, index, self) =>
                index === self.findIndex((ss) => ss.user_id === s.user_id)
            ).length + 1;
        if (count === overlapDeepest) {
          squares.push([square.x, square.y, 20, 20, square.user_id]);
        }
      });
      return squares;
    },

    AiTest(aiData = [], questionID, overlapDeepest, isMatched = true) {
      if (!aiData.length) return [];

      aiData = aiData.filter((ai) => ai.questionIndex === questionID);

      const originalSquares = this.tempSquares.filter(
        (s) => s.questionIndex === questionID
      );

      const potentialMatches = originalSquares.reduce((acc, square) => {
        const hasMatch = aiData.some((ai) => {
          return (
            Math.abs(ai.x - square.x) <= 5 && Math.abs(ai.y - square.y) <= 5
          );
        });

        if (hasMatch === isMatched) {
          acc.push(square);
        }

        return acc;
      }, []);

      const squares = [];
      potentialMatches.forEach((square) => {
        const count =
          potentialMatches
            .filter((s) => {
              return (
                Math.abs(s.x - square.x) <= 5 &&
                Math.abs(s.y - square.y) <= 5 &&
                s.user_id !== square.user_id
              );
            })
            .filter(
              (s, index, self) =>
                index === self.findIndex((ss) => ss.user_id === s.user_id)
            ).length + 1; // Include the current square in the count

        if (count === overlapDeepest) {
          squares.push(square);
        }
      });

      return squares;
    },

    calculateImagePosition(
      canvasWidth,
      canvasHeight,
      originalWidth,
      originalHeight
    ) {
      const scale = Math.min(
        canvasWidth / originalWidth,
        canvasHeight / originalHeight
      );
      const x = (canvasWidth - originalWidth * scale) / 2;
      const y = (canvasHeight - originalHeight * scale) / 2;
      return { x, y, scale };
    },

    async exportToExcel() {
      const aiData = await this.$axios
        .get(`/api/assignments/${this.assignmentId}/ai/`, {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        })
        .then((res) => res.data);
      this.data[0].questions.forEach((q) => {
        const filterAiData = aiData.filter(
          (ai) => ai.questionIndex === q.questionId
        );
        if (!filterAiData.length) return;
        const img = new Image();
        img.src = q.questionImage;
        const { width, height } = document.querySelector("canvas");
        const currentPosition = this.calculateImagePosition(
          width,
          height,
          img.width,
          img.height
        );
        const scaleRatio = currentPosition.scale / 1;
        aiData.forEach((square) => {
          square.x = (square.x - 0) * scaleRatio + currentPosition.x;
          square.y = (square.y - 0) * scaleRatio + currentPosition.y;
        });
      });
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");
      const columns = [
        { header: "문제 번호", key: "questionNumber", width: 10 },
        ...this.data.map((user) => ({
          header: user.name,
          key: user.name,
          width: 15,
        })),
      ];
      if (this.assignmentMode === "BBox") {
        for (let i = this.data.length; i >= 1; i--) {
          columns.push({ header: `+${i}인`, key: `overlap${i}`, width: 10 });
        }
        for (let i = this.data.length; i >= 1; i--) {
          columns.push({ header: `${i}일치`, key: `matched${i}`, width: 10 });
        }
        for (let i = this.data.length; i >= 1; i--) {
          columns.push({
            header: `${i}불일치`,
            key: `unmatched${i}`,
            width: 10,
          });
        }
        columns.push({ header: "Json", key: "json", width: 15 });
      }
      worksheet.columns = columns;
      this.data[0].questions.forEach((question, qIndex) => {
        const questionImageFileName = question.questionImage.split("/").pop();
        const row = { questionNumber: questionImageFileName };
        this.data.forEach((user) => {
          row[user.name] = user.questions[qIndex].questionSelection;
        });
        if (this.assignmentMode === "BBox") {
          for (let i = 1; i <= this.data.length; i++) {
            row[`overlap${i}`] = this.getOverlapSquares(question.questionId, i);
          }
          for (let i = 1; i <= this.data.length; i++) {
            row[`matched${i}`] = this.AiTest(
              aiData,
              question.questionId,
              i,
              true
            ).length;
          }
          for (let i = 1; i <= this.data.length; i++) {
            row[`unmatched${i}`] = this.AiTest(
              aiData,
              question.questionId,
              i,
              false
            ).length;
          }
          row["json"] = JSON.stringify({
            filename: questionImageFileName,
            annotation: this.getAllOverlapSquares(
              question.questionId,
              Number(this.sliderValue)
            ),
          });
        }
        worksheet.addRow(row);
      });
      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, "assignment_responses.xlsx");
    },

    startExportingAnimation() {
      this.interval = setInterval(() => {
        this.exportingMessageIndex++;
      }, 500); // 0.5초마다 점의 개수 변경
    },
    stopExportingAnimation() {
      clearInterval(this.interval);
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
              zip.file(`image_${index + 1}.png`, blob);
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

    setActiveImage(imageUrl, index) {
      this.activeImageUrl = imageUrl;
      this.activeIndex = index;
      this.activeQuestionIndex = this.data[0].questions[index].questionId;
    },

    getStyleForPerson(index) {
      return this.assignmentMode === "BBox" ? this.colorList[index] : {};
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
        const count = this.getOverlapSquares(
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
        return this.tempSquares
          .filter((s) => s.questionIndex === this.activeQuestionIndex)
          .length.toString();
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
      // 파일 생성 메시지에 점을 순환적으로 추가
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

.completed-status > strong {
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
  position: sticky;
  bottom: 0;
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

.exporting-message {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--white);
  font-size: 24px;

  z-index: 100;
}
</style>
