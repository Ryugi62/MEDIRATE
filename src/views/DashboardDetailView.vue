<!-- DashboardDetailView.vue -->

<template>
  <div v-if="data.length" class="dashboard">
    <!-- Breadcrumb 경로 -->
    <div class="dashboard-overview">
      <div class="dashboard-metadata">
        <div class="breadcrumb-path">
          <router-link to="/dashboard" class="path-link">평가 결과</router-link>
          <span class="path-separator">&gt;</span>
          <span class="path-item">{{ projectName || '미지정' }}</span>
          <span class="path-separator">&gt;</span>
          <span class="path-item">{{ cancerTypeName || '미분류' }}</span>
          <span class="path-separator">&gt;</span>
          <span class="path-item current">{{ assignmentTitle }}</span>
        </div>
      </div>
    </div>
    <div v-if="isExporting" class="exporting-message">
      {{ exportingMessage }}
    </div>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">{{ assignmentTitle }}</span>
          <div v-if="isBBoxOrSegment" class="slider-container">
            <i
              class="fa-solid fa-robot"
              :class="{ active: isAiMode }"
              @click="isAiMode = !isAiMode"
            ></i>
            <span id="sliderValue" class="score_percent">
              {{ score_percent }}%
            </span>
            <input
              type="range"
              name="score_percent"
              id="score_percent"
              min="0"
              max="100"
              v-model="score_percent"
            />
            <span id="sliderValue">{{ `${sliderRange}인 일치` }}</span>
            <input
              type="range"
              min="1"
              :max="data.length"
              class="slider"
              id="slider"
              v-model="sliderValue"
            />
            <span class="completed-status">
              <strong>{{ completionPercentage }}</strong>
            </span>
          </div>
          <button class="edit-button" @click="moveToAssignmentManagement">
            과제수정
          </button>
          <button v-if="isAdmin" class="edit-button" @click="showBulkAssignModal = true">
            평가자 변경
          </button>
          <button v-if="isAdmin" class="delete" @click="deleteAssignment">과제삭제</button>
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
                  <template v-if="isBBoxOrSegment">
                    <th
                      v-for="index in [null, ...Array(data.length - 1).keys()]"
                      :key="index === null ? 'none' : index"
                    >
                      {{ index === null ? "전체개수" : `${index + 2}인 일치` }}
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
                    <img :src="item.questionImage" alt="과제 이미지" />
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
                  <template
                    v-if="
                      isBBoxOrSegment && overlaps[item.questionId]
                    "
                  >
                    <td>{{ getOverlapValue(item.questionId, 1) }}</td>
                    <td
                      v-for="overlapCount in Array(data.length - 1).keys()"
                      :key="overlapCount"
                    >
                      {{ getOverlapValue(item.questionId, overlapCount + 2) }}
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
                  <template v-if="isBBoxOrSegment">
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
                  <template v-if="isBBoxOrSegment">
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
              :score_percent="score_percent"
            />
          </div>
        </div>
      </div>
    </div>
    <img src="../assets/dashboard_detial_guide.png" alt="" width="600" />
  </div>
  <div v-else-if="loadError" class="error-message">
    <i class="fas fa-exclamation-triangle"></i>
    <h2>과제를 불러올 수 없습니다</h2>
    <p>{{ loadError }}</p>
    <button class="retry-button" @click="$router.go(-1)">
      <i class="fas fa-arrow-left"></i> 뒤로 가기
    </button>
  </div>
  <div v-else-if="!data.length" class="loading-message">
    <p>과제를 불러오는 중입니다...</p>
  </div>

  <!-- 평가자 변경 모달 -->
  <BulkAssignModal
    v-if="showBulkAssignModal"
    :regularAssignmentIds="[parseInt(assignmentId)]"
    :assignmentIds="[]"
    @close="showBulkAssignModal = false"
    @assigned="handleAssignmentComplete"
  />
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";
import BBoxViewerComponent from "@/components/BBoxViewerComponent.vue";
import BulkAssignModal from "@/components/BulkAssignModal.vue";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { format } from "date-fns";

export default {
  name: "DashboardDetailView",

  components: {
    ImageComponent,
    BBoxViewerComponent,
    BulkAssignModal,
  },

  data() {
    return {
      data: [],
      originalData: [],
      activeImageUrl: "https://via.placeholder.com/1050",
      assignmentId: this.$route.params.id,
      activeIndex: 0,
      activeQuestionIndex: null,
      assignmentTitle: "",
      assignmentMode: "",
      projectName: null,
      cancerTypeName: null,
      loadError: null,
      colorList: [
        { backgroundColor: "#00838F", color: "white" },
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
      score_percent: 50,
      overlaps: {},
      metadataKeys: new Set(),
      metadataJson: null,
      showBulkAssignModal: false,
    };
  },

  async created() {
    this.isExporting = true;
    this.loadError = null;

    try {
      await this.loadData();
      await this.loadAiData();
      await this.fix_loadData();
      await this.calculateOverlaps();
      await this.collectMetadataKeys();
    } catch (error) {
      console.error("Failed to load data:", error);
      this.loadError = error.response?.data?.message || error.message || "과제를 불러오는 중 오류가 발생했습니다.";
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
    handleAssignmentComplete() {
      this.showBulkAssignModal = false;
      // 데이터 새로고침
      this.loadData();
    },

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
        this.projectName = data.projectName || null;
        this.cancerTypeName = data.cancerTypeName || null;
        this.data = data.assignment || [];
        this.originalData = JSON.parse(JSON.stringify(this.data));

        // data가 있고 questions가 있을 때만 초기값 설정
        if (this.data.length > 0 && this.data[0].questions && this.data[0].questions.length > 0) {
          this.activeImageUrl = this.data[0].questions[0].questionImage;
          this.activeQuestionIndex = this.data[0].questions[0].questionId;
        }

        this.flatSquares = this.data.map((person) => person.squares || []).flat();
        this.userSquaresList = this.data.map((person, index) => ({
          beforeCanvas: person.beforeCanvas,
          squares: person.squares || [],
          color: this.colorList[index % this.colorList.length].backgroundColor,
        }));
      } catch (error) {
        console.error("Failed to load data:", error);
        throw error;
      }
    },

    async loadAiData() {
      const cacheKey = `assignment_all_${this.assignmentId}`;

      try {
        // Vuex Store 캐시에서 먼저 확인
        const cachedData = this.$store.getters.getAiDataByKey(cacheKey);
        if (cachedData) {
          this.aiData = cachedData;
          return;
        }

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
          score: ai.score ? ai.score : 0.6,
        }));

        // Vuex Store에 캐시
        this.$store.commit("setAiData", { key: cacheKey, data: this.aiData });
      } catch (error) {
        console.error("Failed to load AI data:", error);
      }
    },

    async fix_loadData() {
      try {
        let dataChanged = false;

        for (
          let userIndex = 0;
          userIndex < this.userSquaresList.length;
          userIndex++
        ) {
          const user = this.userSquaresList[userIndex];
          const originalUser = this.originalData[userIndex];

          for (let i = 0; i < user.squares.length; i++) {
            const square = user.squares[i];

            if (square.isAI) {
              const matchingAiData = this.aiData.find(
                (ai) =>
                  ai.questionIndex === square.questionIndex &&
                  Math.abs(ai.x - square.x) <= 0.9 &&
                  Math.abs(ai.y - square.y) <= 0.9
              );

              if (matchingAiData) {
                const { width: originalWidth, height: originalHeight } =
                  await this.getImageDimensions(
                    this.data[0].questions.find(
                      (q) => q.questionId === square.questionIndex
                    ).questionImage
                  );

                const { x: adjustedX, y: adjustedY } =
                  this.convertToOriginalImageCoordinates(
                    matchingAiData.x,
                    matchingAiData.y,
                    originalWidth,
                    originalHeight,
                    user.beforeCanvas.width,
                    user.beforeCanvas.height
                  );

                const currentPosition = this.calculateImagePosition(
                  user.beforeCanvas.width,
                  user.beforeCanvas.height,
                  originalWidth,
                  originalHeight
                );

                const newX =
                  (adjustedX - currentPosition.x) / currentPosition.scale;
                const newY =
                  (adjustedY - currentPosition.y) / currentPosition.scale;

                if (
                  Math.abs(square.x - newX) > 0.1 ||
                  Math.abs(square.y - newY) > 0.1
                ) {
                  square.x = newX;
                  square.y = newY;
                  originalUser.squares[i].x = newX;
                  originalUser.squares[i].y = newY;
                  dataChanged = true;
                }
              }
            }
          }
        }

        if (dataChanged) {
          this.flatSquares = this.data.map((person) => person.squares).flat();
          console.log("Coordinates have been updated.");
        } else {
          console.log("No changes were necessary.");
        }
      } catch (error) {
        console.error("Failed to update data:", error);
      }
    },

    async calculateOverlaps() {
      this.overlaps = {};

      // 데이터가 없거나 questions가 없으면 종료
      if (!this.data.length || !this.data[0]?.questions?.length) {
        return;
      }

      for (const question of this.data[0].questions) {
        const questionId = question.questionId;
        this.overlaps[questionId] = {};

        for (
          let overlapCount = 1;
          overlapCount <= this.data.length;
          overlapCount++
        ) {
          const count = await this.getOverlaps(questionId, overlapCount);
          this.overlaps[questionId][overlapCount] = count;
        }
      }
    },

    async getOverlaps(questionId, overlapCount) {
      if (!this.isBBoxOrSegment) return "";

      const question = this.data[0].questions.find(
        (q) => q.questionId === questionId
      );
      const { width: originalWidth, height: originalHeight } =
        await this.getImageDimensions(question.questionImage);

      let squares = [];
      this.data.forEach((person) => {
        const adjustedSquares = person.squares
          .filter(
            (square) =>
              square.questionIndex === questionId && !square.isTemporary
          )
          .map((square) => {
            const { x: adjustedX, y: adjustedY } =
              this.convertToOriginalImageCoordinates(
                square.x,
                square.y,
                person.beforeCanvas.width,
                person.beforeCanvas.height,
                originalWidth,
                originalHeight
              );
            return {
              ...square,
              x: adjustedX,
              y: adjustedY,
            };
          });
        squares = squares.concat(adjustedSquares);
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

    getOverlapValue(questionId, overlapCount) {
      if (
        this.overlaps &&
        this.overlaps[questionId] &&
        this.overlaps[questionId][overlapCount] !== undefined
      ) {
        return this.overlaps[questionId][overlapCount];
      }
      return "";
    },

    async collectMetadataKeys() {
      const response = await this.$axios.get(
        `/api/assignments/${this.assignmentId}/metadata`,
        {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        }
      );

      if (response.data) {
        this.metadataJson = response.data;
        Object.keys(this.metadataJson).forEach((key) => {
          if (key !== "userid") {
            this.metadataKeys.add(key);
          }
        });
      }

      console.log(`
      this.metadataJson : ${JSON.stringify(this.metadataJson)}
      `);
    },

    getFolderNameFromImageUrl(imageUrl) {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split("/");
      return pathParts[pathParts.length - 2];
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
      if (!squares || !Array.isArray(squares)) return 0;
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
        const activeRow = document.querySelector(
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
      if (!this.isBBoxOrSegment) return "";
      return this.data.reduce((acc, person) => {
        const count = person.squares.filter(
          (square) => square.questionIndex === questionId && !square.isTemporary
        ).length;
        return acc + count;
      }, 0);
    },

    async getAdjustedSquares(users, question) {
      const { width: originalWidth, height: originalHeight } =
        await this.getImageDimensions(question.questionImage);

      const squares = users.flatMap((user) =>
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

      return squares;
    },

    async getImageDimensions(imageUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = imageUrl;
      });
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

      try {
        const workbook = new ExcelJS.Workbook();

        // 시간 Sheet 생성
        const timeSheet = workbook.addWorksheet("시간 Sheet");

        // 시간 시트의 열 정의
        const timeSheetColumns = [
          { header: "과제 ID", key: "assignmentId", width: 15 },
          { header: "평가자 이름", key: "evaluatorName", width: 20 },
          { header: "시작 시간", key: "startTime", width: 20 },
          { header: "종료 시간", key: "endTime", width: 20 },
          { header: "소요 시간", key: "duration", width: 15 },
          { header: "AI 표시 여부", key: "aiIndicator", width: 15 },
        ];

        for (const key of this.metadataKeys) {
          timeSheetColumns.push({ header: key, key: key, width: 20 });
        }

        timeSheet.columns = timeSheetColumns;

        // 시간 시트 데이터 추가
        for (const user of this.data) {
          const startTime = user.beforeCanvas.start_time
            ? format(
                new Date(user.beforeCanvas.start_time),
                "yyyy-MM-dd HH:mm:ss"
              )
            : "";
          const endTime = user.beforeCanvas.end_time
            ? format(
                new Date(user.beforeCanvas.end_time),
                "yyyy-MM-dd HH:mm:ss"
              )
            : "";
          const duration = user.beforeCanvas.evaluation_time
            ? this.formatDuration(user.beforeCanvas.evaluation_time)
            : "";

          const row = {
            assignmentId: this.assignmentId,
            evaluatorName: user.name,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            aiIndicator: this.isAiMode ? "Yes" : "No",
          };

          if (this.metadataJson) {
            for (const key of Object.keys(this.metadataJson)) {
              if (key !== "userid") {
                row[key] = this.metadataJson[key];
              }
            }
          }

          timeSheet.addRow(row);
        }

        timeSheet.getRow(1).font = { bold: true };

        // 결과 Sheet 생성
        const resultSheet = workbook.addWorksheet("결과 Sheet");
        const columns = [
          { header: "과제 ID", key: "assignmentId", width: 15 },
          { header: "이미지", key: "questionNumber", width: 20 },
          ...this.data.map((user) => ({
            header: user.name,
            key: user.name,
            width: 15,
          })),
        ];

        if (this.isBBoxOrSegment) {
          columns.push(
            {
              header: `+${this.sliderValue}인`,
              key: `overlap${this.sliderValue}`,
              width: 15,
            },
            {
              header: `AI개수`,
              key: `aiCount`,
              width: 10,
            },
            {
              header: `${this.sliderValue}일치`,
              key: `matched${this.sliderValue}`,
              width: 15,
            },
            {
              header: `FN`,
              key: `fn${this.sliderValue}`,
              width: 10,
            },
            {
              header: `FP`,
              key: `fp${this.sliderValue}`,
              width: 10,
            },
            {
              header: `JSON`,
              key: `json`,
              width: 50,
            },
            {
              header: "AI-Json",
              key: "aiJson",
              width: 50,
            }
          );
        }
        resultSheet.columns = columns;

        for (let index = 0; index < this.data[0].questions.length; index++) {
          const question = this.data[0].questions[index];
          const questionImageFileName = question.questionImage.split("/").pop();
          const row = {
            assignmentId: this.assignmentId,
            questionNumber: questionImageFileName,
          };
          this.data.forEach((user) => {
            row[user.name] = this.getValidSquaresCount(
              user.squares,
              question.questionId
            );
          });

          if (this.isBBoxOrSegment) {
            const adjustedSquares = await this.getAdjustedSquares(
              this.originalData,
              question
            );

            const relevantAiData = this.aiData.filter(
              (ai) =>
                ai.questionIndex === question.questionId &&
                ai.score >= this.score_percent / 100
            );

            const overlapGroups = this.getOverlapsBBoxes(
              adjustedSquares,
              this.sliderValue
            );

            const overlapCount = overlapGroups.length;
            const matchedCount = this.getMatchedCount(
              overlapGroups,
              relevantAiData
            );

            row[`overlap${this.sliderValue}`] = overlapCount;
            row["aiCount"] = relevantAiData.length;
            row[`matched${this.sliderValue}`] = matchedCount;
            row[`fn${this.sliderValue}`] = overlapCount - matchedCount;
            row[`fp${this.sliderValue}`] = relevantAiData.length - matchedCount;

            // JSON 데이터 생성
            row["json"] = JSON.stringify({
              filename: questionImageFileName,
              mitosis: overlapGroups.map((group) => {
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
              hardneg: [], // 필요에 따라 추가
            });

            // AI-Json 내용 읽기
            const aiJsonContent = await this.fetchAiJsonContent(
              question.questionImage
            );
            row["aiJson"] = aiJsonContent;
          }

          resultSheet.addRow(row);
        }

        resultSheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(blob, `${this.assignmentTitle}.xlsx`);
      } catch (error) {
        console.error("Failed to export to Excel:", error);
      } finally {
        this.isExporting = false;
      }
    },

    async fetchAiJsonContent(questionImage) {
      const imagePathParts = questionImage.split("/");
      const folderName = imagePathParts[imagePathParts.length - 2];
      const fileName = imagePathParts[imagePathParts.length - 1].replace(
        /\.(jpg|png|jpeg)$/i,
        ".json"
      );

      try {
        const response = await this.$axios.get(
          `/api/assets/${folderName}/${fileName}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        return JSON.stringify(response.data);
      } catch (error) {
        console.error("Failed to fetch AI-Json content:", error);
        return "";
      }
    },

    formatDuration(ms) {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = ("0" + Math.floor(totalSeconds / 3600)).slice(-2);
      const minutes = ("0" + Math.floor((totalSeconds % 3600) / 60)).slice(-2);
      const seconds = ("0" + (totalSeconds % 60)).slice(-2);
      return `${hours}:${minutes}:${seconds}`;
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
      return this.isBBoxOrSegment ? this.colorList[index] : {};
    },

    startExportingAnimation() {
      this.interval = setInterval(() => {
        this.exportingMessageIndex++;
      }, 500);
    },

    stopExportingAnimation() {
      clearInterval(this.interval);
    },

    getOverlapsBBoxes(squares, overlapCount) {
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
  },

  computed: {
    isAdmin() {
      const user = this.$store.getters.getUser;
      return user?.isAdministrator || user?.role === 'admin';
    },
    isBBoxOrSegment() {
      return this.assignmentMode === "BBox" || this.assignmentMode === "Segment";
    },
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
        const overlapsForQuestion = this.overlaps[this.activeQuestionIndex];
        if (
          !overlapsForQuestion ||
          overlapsForQuestion[Number(this.sliderValue)] === undefined
        ) {
          return "0";
        }
        const count = overlapsForQuestion[Number(this.sliderValue)] || 0;
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
.dashboard {
  height: calc(100vh - 71px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Breadcrumb 스타일 */
.dashboard-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  height: 50px;
  flex-shrink: 0;
}

.dashboard-metadata {
  display: flex;
  align-items: center;
  padding-left: 12px;
  gap: 8px;
}

.breadcrumb-path {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.path-link {
  color: #007bff;
  text-decoration: none;
}

.path-link:hover {
  text-decoration: underline;
}

.path-separator {
  color: #6c757d;
}

.path-item {
  color: #495057;
}

.path-item.current {
  font-weight: 600;
  color: #212529;
}

.dashboard-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header {
  height: 45px;
  display: flex;
  padding-left: 16px;
  padding-right: 16px;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--light-gray);
  white-space: nowrap;
  flex-shrink: 0;
}

.table-header button {
  font-size: 11px;
  padding: 4px 8px;
}

.table-body {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.table-title {
  font-weight: bold;
  font-size: 13px;
  margin: 0;
  padding: 0;
  margin-right: auto;
}

.slider-container {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
}

.slider-container input[type="range"] {
  width: 80px;
}

.completed-status {
  font-size: 12px;
}

.completed-status > strong {
  color: var(--blue);
  font-size: 16px;
}

.table-section {
  overflow-y: auto;
  overflow-x: auto;
  flex-shrink: 0;
  max-width: 50%;
}

.assignment-table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ddd;
  padding: 4px 6px;
  text-align: center;
  min-width: 30px;
  font-size: 11px;
}

tr.active {
  color: var(--white);
  background-color: var(--blue);
}

td > img {
  width: 20px;
}

.image-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.image-box > img {
  width: 100%;
  margin: auto;
  object-fit: contain;
  max-height: 100%;
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

.exporting-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px 24px;
  border-radius: 8px;
  z-index: 1000;
  font-size: 14px;
}

.loading-message {
  height: calc(100vh - 71px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #666;
}

.error-message {
  height: calc(100vh - 71px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #666;
}

.error-message i.fa-exclamation-triangle {
  font-size: 48px;
  color: #dc3545;
}

.error-message h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.error-message p {
  margin: 0;
  font-size: 14px;
  color: #666;
  max-width: 400px;
  text-align: center;
}

.error-message .retry-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.error-message .retry-button:hover {
  background-color: #5a6268;
}

/* 가이드 이미지 숨김 */
.dashboard > img {
  display: none;
}
</style>
