<template>
  <div v-if="data.length" class="dashboard">
    <h1 class="title">대시보드</h1>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">과제 이야기</span>
          <div class="slider-container">
            <span id="sliderValue">+{{ getSliderRange }}</span>
            <input
              type="range"
              min="1"
              :max="data.length"
              class="slider"
              id="slider"
              v-model="sliderValue"
            />
          </div>
          <span class="completed-status"
            ><strong>{{ completedPercentage }}%</strong> / 100%</span
          >
          <button class="edit-button" @click="moveToAssignmentManagement">
            수정
          </button>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="assignment-table">
              <thead class="table-head">
                <tr>
                  <th>문번</th>
                  <th
                    v-for="(person, index) in data"
                    :key="person.name"
                    :style="getStyleForPerson(index)"
                  >
                    {{ person.name }}
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
                </tr>
              </tbody>
              <tfoot class="table-footer">
                <tr>
                  <th>답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.answeredCount }}
                  </th>
                </tr>
                <tr>
                  <th>미답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.unansweredCount }}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="image-box">
            <ImageComponent
              v-if="assignmentMode === 'TextBox'"
              :src="activeImageUrl"
            />

            <BBoxViewerComponent
              v-else
              :src="activeImageUrl"
              :questionIndex="activeIndex"
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
      colorList: COLOR_LIST, // 상수로 정의된 색상 리스트 사용
      sliderValue: 1,
    };
  },
  created() {
    this.loadData();
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

        console.log(data);

        this.assignmentMode = data.assignmentMode;
        this.data = data.assignment;
        this.activeImageUrl = this.data[0].questions[0].questionImage;
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    },
    moveToAssignmentManagement() {
      this.$router.push(`/edit-assignment/${this.assignmentId}`);
    },
    setActiveImage(imageUrl, index) {
      this.activeImageUrl = imageUrl;
      this.activeIndex = index;
    },
    getStyleForPerson(index) {
      const style = this.colorList[index % this.colorList.length];
      return this.assignmentMode === "BBox" ? style : {};
    },
  },
  computed: {
    completedPercentage() {
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

    getSliderRange() {
      // this.data.length만큼 배열을 만들어서 1부터 10까지의 값을 순서대로 넣어줍니다.
      const rangeValues = Array.from(
        { length: this.data.length },
        (_, i) => i + 1
      );
      return rangeValues[this.sliderValue - 1] || "";
    },
  },
};

const COLOR_LIST = [
  { backgroundColor: "#FF6384", color: "white" }, // 밝은 분홍
  { backgroundColor: "#36A2EB", color: "white" }, // 밝은 파랑
  { backgroundColor: "#FF9F40", color: "white" }, // 주황색
  { backgroundColor: "#9966FF", color: "white" }, // 연보라
  { backgroundColor: "#FFCE56", color: "white" }, // 밝은 노랑
  { backgroundColor: "#4BC0C0", color: "white" }, // 청록색
  { backgroundColor: "#FF6EFF", color: "white" }, // 밝은 자주색
  { backgroundColor: "#B2F302", color: "white" }, // 라임 그린
  { backgroundColor: "#DDA0DD", color: "black" }, // 자두색
  { backgroundColor: "#50BFE6", color: "white" }, // 밝은 하늘색
  { backgroundColor: "#7ED957", color: "white" }, // 밝은 녹색
  { backgroundColor: "#D860F1", color: "white" }, // 자홍색
  { backgroundColor: "#FFD300", color: "white" }, // 금색
  { backgroundColor: "#009B77", color: "white" }, // 에메랄드 그린
  { backgroundColor: "#800080", color: "white" }, // 보라색
  { backgroundColor: "#E77200", color: "white" }, // 양갱 오렌지
  { backgroundColor: "#FFA07A", color: "black" }, // 연어색
  { backgroundColor: "#AAF0D1", color: "black" }, // 밝은 민트
  { backgroundColor: "#E6E6FA", color: "black" }, // 라벤더
  { backgroundColor: "#FF5A09", color: "white" }, // 어두운 주황색
];
</script>

<style scoped>
.dashboard {
  /* border: 1px solid red; */
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
}

tr.active {
  color: var(--white);
  background-color: var(--blue);
}
w td {
  text-align: center;
  padding: 4px 8px;
  width: 70px;
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

.table-head {
  position: sticky;
  top: 0;
  background-color: var(--white);
}

.table-footer {
  position: sticky;
  bottom: 0;
  background-color: var(--white);
}
</style>
