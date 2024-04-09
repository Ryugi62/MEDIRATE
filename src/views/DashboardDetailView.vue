<template>
  <div v-if="data.length" class="dashboard">
    <h1 class="title">대시보드</h1>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">과제 이야기</span>
          <div class="slider-container" v-if="assignmentMode === 'BBox'">
            <span id="sliderValue">+{{ sliderRange }}</span>
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
            <strong>{{ completionPercentage }}%</strong> / 100%
          </span>
          <button class="edit-button" @click="moveToAssignmentManagement">
            수정
          </button>
          <button class="delete" @click="deleteAssignment">삭제</button>
          <button class="export-button" @click="exportToExcel">내보내기</button>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="assignment-table">
              <thead class="table-head">
                <tr>
                  <th>이미지</th>
                  <th>파일</th>
                  <th
                    v-for="(person, index) in data"
                    :key="person.name"
                    :style="getStyleForPerson(index)"
                  >
                    {{ person.name }}
                  </th>
                  <th v-for="(person, index) in data" :key="index">
                    +{{ index + 1 }}
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
                  <td>{{ item.questionImage.split("/").pop() }}</td>
                  <td v-for="person in data" :key="person.name">
                    {{ person.questions[index].questionSelection }}
                  </td>
                  <td
                    v-for="(person, overlapDeepest) in data"
                    :key="person.name"
                  >
                    {{
                      getOverlapSquares(
                        person.questions[index].questionId,
                        overlapDeepest + 1
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
        { backgroundColor: "#FF6384", color: "white" },
        { backgroundColor: "#36A2EB", color: "white" },
        { backgroundColor: "#FF9F40", color: "white" },
        { backgroundColor: "#B2F302", color: "black" },
        { backgroundColor: "#FFA07A", color: "white" },
      ],
      sliderValue: 1,
      userSquaresList: [],
      tempSquares: [],
    };
  },

  async created() {
    await this.loadData();
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

        this.userSquaresList = this.data.map((person, index) => {
          return {
            beforeCanvas: person.beforeCanvas,
            squares: person.squares,
            color:
              this.colorList[index % this.colorList.length].backgroundColor,
          };
        });
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
      const originalSquares = [
        ...this.tempSquares.filter((s) => s.questionIndex === questionID),
      ];
      const squares = [];

      originalSquares.forEach((square) => {
        const count =
          originalSquares.filter(
            (s) =>
              Math.abs(s.x - square.x) <= 5 &&
              Math.abs(s.y - square.y) <= 5 &&
              s.user_id !== square.user_id
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

    async exportToExcel() {
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
        for (let i = 1; i <= this.data.length; i++) {
          columns.push({ header: `+${i}`, key: `overlap${i}`, width: 10 });
        }
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

    setActiveImage(imageUrl, index) {
      this.activeImageUrl = imageUrl;
      this.activeIndex = index;
      this.activeQuestionIndex = this.data[0].questions[index].questionId;
    },

    getStyleForPerson(index) {
      const style = this.colorList[index];

      return this.assignmentMode === "BBox" ? style : {};
    },
  },
  computed: {
    completionPercentage() {
      if (!this.data.length) return 0;
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
        ? ((totalAnswered / totalQuestions) * 100).toFixed(2)
        : 0;
    },

    sliderRange() {
      const rangeValues = Array.from(
        { length: this.data.length },
        (_, i) => i + 1
      );
      return rangeValues[this.sliderValue - 1] || "";
    },
  },
};
</script>

<style scoped>
.dashboard {
}

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
}

.export-button {
  background-color: var(--green);
}

.delete {
  background-color: var(--pink);
}
</style>
