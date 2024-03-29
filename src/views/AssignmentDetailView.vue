<template>
  <div v-if="currentAssignmentDetails" class="assignment-detail-view">
    <h1 class="header-title">과제 평가</h1>

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
        <!-- <span class="evaluation-score"><strong>20</strong> / 300</span> -->
        <span class="evaluation-score">
          <strong
            v-if="currentAssignmentDetails.assignmentMode === 'TextBox'"
            >{{ currentAssignmentDetails.score }}</strong
          >
          <strong v-else>{{
            currentAssignmentDetails.squares
              .map((square) => square.questionIndex)
              .filter((value, index, self) => self.indexOf(value) === index)
              .length
          }}</strong>
          /
          {{ currentAssignmentDetails.totalScore }}</span
        >
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
              :class="{ active: question.id === activeQuestionId }"
            >
              <td>
                <img :src="question.image" alt="Question" />
              </td>
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
        v-if="currentAssignmentDetails.assignmentMode === 'TextBox'"
        class="student-response-image"
        :class="{ 'full-screen': isFullScreenImage }"
      >
        <ImageComponent
          :src="activeQuestionImageUrl"
          ref="studentResponseImage
        "
          alt="Student Response"
        />
        <i class="fa-solid fa-expand fa-2x" @click="toggleFullScreenImage"></i>
      </div>

      <!-- <BBoxComponent
        v-else
        :src="activeQuestionImageUrl"
        :questionIndex="activeQuestionId"
        :squares="currentAssignmentDetails.squares"
        :beforeCanvas="currentAssignmentDetails.beforeCanvas"
      /> -->
      <NewBBoxComponent
        v-else
        :src="activeQuestionImageUrl"
        :questionIndex="activeQuestionId"
        :squares="currentAssignmentDetails.squares"
        :beforeCanvas="currentAssignmentDetails.beforeCanvas"
      />
    </div>
  </div>
  <div v-else class="loading-message">과제를 불러오는 중입니다...</div>
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";
// import BBoxComponent from "@/components/BBoxComponent.vue";
import NewBBoxComponent from "@/components/newBBoxComponent.vue";

export default {
  name: "AssignmentEvaluationView",

  data() {
    return {
      currentAssignmentDetails: null,
      draftAssignmentDetails: {},
      isEditEnabled: false,
      activeQuestionId: 1,
      activeQuestionImageUrl: "https://via.placeholder.com/1050",
      gradingScale: {
        ungraded: ["Unknown", "Negative", "Positive"],
        grades: ["Unknown", "Grade1", "Grade2", "Grade3", "Grade4"],
      },
      gradingType: "grades",
      isFullScreenImage: false,
      isSaving: false,
    };
  },

  async created() {
    await this.loadAssignmentDetails(this.$route.params.id);
  },

  mounted() {
    this.$nextTick(() => {
      this.makeTdClickable();
    });
  },

  components: {
    ImageComponent,
    // BBoxComponent,
    NewBBoxComponent,
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

        // this.currentAssignmentDetails.score 이 null이 아니고 0 이상일 때만 score를 업데이트합니다.
        const score = this.currentAssignmentDetails.score || 0;

        this.currentAssignmentDetails.score = score;

        if (this.currentAssignmentDetails.assignmentMode === "BBox") {
          this.currentAssignmentDetails.selectionType = [];
        }

        // Ensure the DOM is updated before making TDs clickable
        this.$nextTick(() => {
          this.makeTdClickable();
        });

        // 현재 선택된 질문의 이미지 URL을 업데이트합니다.
        this.activeQuestionImageUrl =
          this.currentAssignmentDetails.questions[0].image;

        // 현재 선택된 질문의 ID를 업데이트합니다.
        this.activeQuestionId = this.currentAssignmentDetails.questions[0].id;
      } catch (error) {
        console.error("Error loading assignment details:", error);
      }
    },
    async commitAssignmentChanges() {
      // radio 버튼 비활성화
      const radioButtons = this.$el.querySelectorAll(
        ".grades-table table tbody input[type='radio']"
      );
      radioButtons.forEach((radio) => (radio.disabled = true));
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
        alert("과제 평가가 성공적으로 저장되었습니다!");
        this.$router.push("/assignment");
      } catch (error) {
        console.error("과제 저장 중 오류 발생:", error);
        // 오류 처리 로직
      }
      // radio 버튼 활성화
      radioButtons.forEach((radio) => (radio.disabled = false));
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

          // TD 내부의 라디오 버튼 또는 레이블을 클릭했을 경우를 처리
          if (target.tagName === "TD" || target.tagName === "LABEL") {
            if (target.tagName === "LABEL") {
              // LABEL 클릭 시, 관련 라디오 버튼으로 타겟 변경
              target = document.getElementById(target.getAttribute("for"));
            } else {
              // TD 클릭 시, 해당 TD 내부의 첫 번째 라디오 버튼을 타겟으로 설정
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

    onRowClick(question, idx) {
      this.activeQuestionId = question.id;

      this.activeQuestionImageUrl = question.image;

      // 모든 행의 'active' 클래스 제거 후 현재 클릭된 행에만 'active' 클래스 추가
      this.$nextTick(() => {
        const rows = this.$el.querySelectorAll(".grades-table table tbody tr");
        rows.forEach((row) => row.classList.remove("active"));
        const activeRow = rows[idx];

        if (activeRow) {
          activeRow.classList.add("active");
        }
      });
    },

    updateSelectedValue(questionIdx, value) {
      const selectedValue = parseInt(value);
      // 지정된 질문의 selectedValue를 업데이트합니다.
      this.currentAssignmentDetails.questions[questionIdx].selectedValue =
        selectedValue;

      // 전체 선택된 라디오 버튼의 개수를 재계산합니다.
      this.recalculateScore();
    },

    recalculateScore() {
      // 선택된 라디오 버튼의 개수를 계산합니다.
      const score = this.currentAssignmentDetails.questions.reduce(
        (acc, question) => {
          return (
            acc +
            (question.selectedValue !== null && question.selectedValue >= 0
              ? 1
              : 0)
          );
        },
        0
      );

      // 계산된 score를 currentAssignmentDetails 객체에 반영합니다.
      this.currentAssignmentDetails.score = score;
    },

    toggleFullScreenImage() {
      this.isFullScreenImage = !this.isFullScreenImage;
    },
  },

  // 페이지를 떠나기전 저장하실지 물어보는 기능
  beforeRouteLeave(to, from, next) {
    // 저장 버튼을 누른거면 안물어보고 넘어가기
    if (this.isSaving) {
      next();
      return;
    } else {
      if (confirm("저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?")) {
        this.commitAssignmentChanges();
        next();
      } else {
        next();
      }
    }
  },

  watch: {
    testScore() {
      console.log("testScore changed:", this.testScore);
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

.grades-table table tbody tr.active {
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
</style>
