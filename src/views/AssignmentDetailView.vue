<template>
  <div class="assignment-detail-view">
    <h1 class="header-title">과제 평가</h1>

    <div class="assignment-overview">
      <div class="assignment-metadata">
        <h2 class="metadata-assignment-title">과제 제목</h2>
        <span class="metadata-student-name">남궁민수</span>
        <span class="metadata-due-date">2024-02-02</span>
      </div>

      <div class="evaluation-actions">
        <span class="evaluation-score"><strong>20</strong> / 300</span>
        <button
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
              <th v-for="grade in gradingScale[gradingType]" :key="grade">
                {{ grade }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(question, idx) in currentAssignmentDetails.questions"
              :key="question.id"
              :class="{ active: activeQuestionId === question.id }"
              @click="onRowClick(question)"
            >
              <td>
                <img
                  :src="`https://via.placeholder.com/1025x1025.png?text=Q${idx}`"
                  alt="Question"
                />
              </td>
              <td v-for="grade in gradingScale[gradingType]" :key="grade">
                <input
                  type="radio"
                  :id="`grade-${question.id}-${grade}`"
                  :name="`grade-${question.id}`"
                  :value="grade"
                  :checked="question.selectValue === grade"
                  @change="updateSelectedValue(question.id, grade)"
                />
                <label :for="`grade-${question.id}-${grade}`">{{
                  grade
                }}</label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="student-response-image"
        :class="{ 'full-screen': isFullScreenImage }"
      >
        <img
          src="https://via.placeholder.com/1025x1025.png?text=Q1"
          alt="Student Response"
        />
        <i class="fa-solid fa-expand fa-2x" @click="toggleFullScreenImage"></i>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "AssignmentEvaluationView",

  data() {
    return {
      currentAssignmentDetails: null,
      draftAssignmentDetails: {},
      isEditEnabled: false,
      activeQuestionId: 1,
      gradingScale: {
        ungraded: ["Unknown", "Negative", "Positive"],
        grades: ["Unknown", "Grade1", "Grade2", "Grade3", "Grade4"],
      },
      gradingType: "grades",
      isFullScreenImage: false,
    };
  },

  created() {
    this.loadAssignmentDetails(this.$route.params.id);
  },

  mounted() {
    this.updateActiveImage();
    this.makeTdClickable();
  },

  methods: {
    loadAssignmentDetails(assignmentId) {
      this.currentAssignmentDetails = {
        id: assignmentId,
        questions: Array.from({ length: 30 }, (_, i) => ({
          id: i + 1,
          title: `문제 ${i + 1}`,
          image: `https://via.placeholder.com/1080x1080.png?text=Q${i + 1}`,
          selectValue: -1,
        })),
      };
      this.draftAssignmentDetails = JSON.parse(
        JSON.stringify(this.currentAssignmentDetails)
      );
    },

    commitAssignmentChanges() {
      console.log("과제 변경사항을 저장합니다", this.draftAssignmentDetails);
      this.isEditEnabled = false;

      this.draftAssignmentDetails.questions.forEach((question) => {
        const originalQuestion = this.currentAssignmentDetails.questions.find(
          (q) => q.id === question.id
        );
        if (originalQuestion) {
          question.selectValue = originalQuestion.selectValue;
        }
      });
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
      table.addEventListener("click", (event) => {
        const target = event.target;
        if (target.tagName === "TD") {
          const radio = target.querySelector('input[type="radio"]');
          if (radio) {
            radio.click();
          }
        }
      });
    },

    updateActiveImage() {
      const studentResponseImage = this.$el.querySelector(
        ".student-response-image img"
      );
      const firstQuestion = this.currentAssignmentDetails.questions[0];
      if (firstQuestion) {
        studentResponseImage.src = firstQuestion.image;
        const firstTr = this.$el.querySelector(".grades-table table tbody tr");
        if (firstTr) {
          firstTr.classList.add("active");
        }
      }
    },

    onRowClick(question) {
      this.activeQuestionId = question.id;
      const studentResponseImage = this.$el.querySelector(
        ".student-response-image img"
      );
      studentResponseImage.src = question.image;

      this.$nextTick(() => {
        const rows = this.$el.querySelectorAll(".grades-table table tbody tr");
        rows.forEach((row) => row.classList.remove("active"));
        const activeRow = rows[this.activeQuestionId - 1];
        if (activeRow) {
          activeRow.classList.add("active");
        }
      });
    },

    updateSelectedValue(questionId, selectedValue) {
      const questionIndex = this.currentAssignmentDetails.questions.findIndex(
        (question) => question.id === questionId
      );
      if (questionIndex !== -1) {
        const gradeIndex =
          this.gradingScale[this.gradingType].indexOf(selectedValue);
        this.currentAssignmentDetails.questions[questionIndex].selectValue =
          gradeIndex !== -1 ? gradeIndex + 1 : -1;
      }
      this.$forceUpdate();
    },

    toggleFullScreenImage() {
      this.isFullScreenImage = !this.isFullScreenImage;
    },
  },
};
</script>

<style scoped>
* {
  /* border: 1px solid var(--pink); */
}

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

tbody tr.active {
  background-color: var(--blue);
}

.student-response-image {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 100%;
}

.student-response-image img {
  width: fit-content;
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
</style>
