<template>
  <div class="bbox-component">
    <div class="bbox-component__header">
      <i
        v-for="icon in iconList"
        :key="icon.name"
        :class="['fas', icon.name, { active: icon.active }]"
        @click="activateIcon(icon)"
      >
        <span>({{ icon.explanation }})</span>
      </i>
    </div>
    <div class="bbox-component__body">
      <canvas
        ref="canvas"
        @click="handleCanvasClick"
        @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave"
        @mouseenter="redrawSquares"
        @contextmenu.prevent
        @contextmenu="redrawSquares"
      ></canvas>
    </div>
    <div class="bbox-component__footer">
      <strong>{{ fileName }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: "BBoxComponent",

  props: {
    beforeCanvas: { type: Object, required: true, default: () => ({}) },
    squares: { type: Array, required: true, default: () => [] },
    src: { type: String, required: true, default: "" },
    questionIndex: { type: Number, required: true, default: 0 },
    assignmentType: { type: String, required: true, default: "" },
    assignmentIndex: { type: Number, required: true, default: 0 },
  },

  data() {
    return {
      iconList: [
        { name: "fa-square", active: true, explanation: "추가" },
        { name: "fa-eraser", active: false, explanation: "선택삭제" },
        { name: "fa-circle-minus", active: false, explanation: "전체삭제" },
        { name: "fa-robot", active: false, explanation: "AI" },
      ],
      localBeforeCanvas: {},
      localSquares: [],
      aiSquares: [],
      aiFirst: true,
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
    };
  },

  computed: {
    eraserActive() {
      return this.iconList.some(
        (icon) => icon.name === "fa-eraser" && icon.active
      );
    },

    isSliderActive() {
      return this.$store.getters.isSlideBarOpen;
    },
    fileName() {
      return this.src.split("/").pop();
    },
  },

  methods: {
    async fetchLocalInfo() {
      this.localBeforeCanvas = this.beforeCanvas;
      this.localSquares = this.squares;
    },

    async activateIcon(selectedIcon) {
      if (selectedIcon.name === "fa-circle-minus") {
        if (!confirm("정말로 모든 사각형을 삭제하시겠습니까?")) return;

        this.localSquares = this.localSquares.filter(
          (square) => square.questionIndex !== this.questionIndex
        );
        this.$emit("update:squares", this.localSquares);
        this.redrawSquares();

        const squareIcon = this.iconList.find(
          (icon) => icon.name === "fa-square"
        );
        this.activateIcon(squareIcon);

        return;
      } else if (selectedIcon.name === "fa-robot") {
        try {
          const response = await this.$axios.get("/api/assignments/ai/", {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
            params: {
              src: this.src.split("/").pop(),
              assignmentType: this.assignmentType,
              questionIndex: this.questionIndex,
            },
          });

          this.aiSquares = response.data.map((e) => ({
            x: e.x + 12.5,
            y: e.y + 12.5,
            questionIndex: this.questionIndex,
            isAI: true,
          }));

          this.setAiSquarePosition();
          this.localSquares = this.localSquares.concat(this.aiSquares);
          this.$emit("update:squares", this.localSquares);
          this.redrawSquares();
        } catch (error) {
          selectedIcon = this.iconList.find(
            (icon) => icon.name === "fa-square"
          );

          this.aiSquares = [];
          this.aiFirst = false;

          alert("AI 데이터 파일이 존재하는지 확인해주세요.");

          console.error(error);
        }
      }

      this.resizeCanvas();
      this.iconList = this.iconList.map((icon) => ({
        ...icon,
        active: icon === selectedIcon,
      }));
    },

    async loadBackgroundImage() {
      try {
        const img = await this.createImage(this.src);
        this.setBackgroundImage(img);
        this.resizeCanvas();
      } catch (error) {
        console.error(error);
      }
    },

    createImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (error) => reject(error);
        img.src = src;
      });
    },

    setBackgroundImage(img) {
      this.backgroundImage = img;
      this.originalWidth = img.width;
      this.originalHeight = img.height;
    },

    drawBackgroundImage() {
      const canvas = this.$refs.canvas;
      if (!this.backgroundImage || !canvas) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x, y, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      ctx.drawImage(
        this.backgroundImage,
        x,
        y,
        this.backgroundImage.width * scale,
        this.backgroundImage.height * scale
      );
    },

    calculateImagePosition(canvasWidth, canvasHeight) {
      const scale = Math.min(
        canvasWidth / this.originalWidth,
        canvasHeight / this.originalHeight
      );
      const x = (canvasWidth - this.originalWidth * scale) / 2;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      if (this.localBeforeCanvas.width && this.localBeforeCanvas.height) {
        canvas.width = this.localBeforeCanvas.width;
        canvas.height = this.localBeforeCanvas.height;
      }

      const beforePosition = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      this.beforeResizePosition = beforePosition;

      canvas.width = 0;
      canvas.height = 0;

      const bboxBody = this.$el
        .querySelector(".bbox-component__body")
        .getBoundingClientRect();
      canvas.width = bboxBody.width;
      canvas.height = bboxBody.height;

      this.localBeforeCanvas.width = canvas.width;
      this.localBeforeCanvas.height = canvas.height;

      this.drawBackgroundImage();
      await this.setSquaresPosition(beforePosition);
      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      if (!this.localSquares.length) return;

      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale;

      this.localSquares.forEach((square) => {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });
    },

    setAiSquarePosition() {
      if (!this.aiSquares.length) return;

      const beforePosition = this.calculateImagePosition(
        this.originalWidth,
        this.originalHeight
      );

      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale;

      this.aiSquares.forEach((square) => {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });

      this.aiFirst = false;
    },

    handleCanvasClick(event) {
      const { x, y } = this.getCanvasCoordinates(event);
      this.eraserActive ? this.eraseSquare(x, y) : this.drawSquare(x, y);
    },

    drawSquare(x, y) {
      this.localSquares.push({ x, y, questionIndex: this.questionIndex });
      this.redrawSquares();
    },

    eraseSquare(mouseX, mouseY) {
      const closestSquare = this.getClosestSquare(mouseX, mouseY);

      if (closestSquare) {
        const index = this.localSquares.indexOf(closestSquare);
        this.localSquares.splice(index, 1);
        this.redrawSquares();
      }
    },

    getClosestSquare(x, y) {
      return this.localSquares.reduce(
        (closest, square) => {
          const distance = Math.hypot(square.x - x, square.y - y);
          if (distance <= 50 && square.questionIndex === this.questionIndex) {
            return distance < closest.distance ? { square, distance } : closest;
          }
          return closest;
        },
        { square: null, distance: Infinity }
      ).square;
    },

    redrawSquares(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");

      this.localSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        ctx.lineWidth = 2;
        ctx.strokeStyle = square.isAI ? "#FFFF00" : "#FF0000";
        ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
      });

      if (event) {
        this.activeEnlarge(event);
        this.activeSquareCursor(event);
      }

      this.$emit("update:squares", this.localSquares);
    },

    getCanvasCoordinates({ clientX, clientY }) {
      const canvas = this.$refs.canvas;
      if (!canvas) return {};

      const { left, top, width, height } = canvas.getBoundingClientRect();
      return {
        x: (clientX - left) * (canvas.width / width),
        y: (clientY - top) * (canvas.height / height),
      };
    },

    handleCanvasMouseMove(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const closestSquare = this.getClosestSquare(x, y);

      this.redrawSquares(event);

      if (closestSquare && this.eraserActive) {
        this.localSquares.forEach((square) => {
          if (square.questionIndex === this.questionIndex) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = square.isAI ? "yellow" : "red";
            ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
          }
        });

        ctx.lineWidth = 2;
        ctx.strokeStyle = "blue";
        ctx.strokeRect(closestSquare.x - 12.5, closestSquare.y - 12.5, 25, 25);
      }
    },

    handleCanvasMouseLeave() {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.redrawSquares();
    },

    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 200;
      const zoomHeight = 200;
      const zoomLevel = 2.5;

      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(canvas.width, canvas.height);
      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      const sourceX = mouseXOnImage - zoomWidth / zoomLevel / 2;
      const sourceY = mouseYOnImage - zoomHeight / zoomLevel / 2;
      const sourceWidth = zoomWidth / zoomLevel;
      const sourceHeight = zoomHeight / zoomLevel;

      this.redrawSquares();

      if (!this.backgroundImage) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(canvas.width - zoomWidth, 0, zoomWidth, zoomHeight);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        canvas.width - zoomWidth,
        0,
        zoomWidth,
        zoomHeight
      );

      ctx.restore();
    },

    activeSquareCursor(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const squareSize = 25;

      ctx.lineWidth = 2;
      ctx.strokeStyle = "orange";
      ctx.strokeRect(
        x - squareSize / 2,
        y - squareSize / 2,
        squareSize,
        squareSize
      );
    },
  },

  mounted() {
    this.fetchLocalInfo();
    this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
  },

  watch: {
    src(newVal, oldVal) {
      if (newVal !== oldVal) this.loadBackgroundImage();
    },

    isSliderActive() {
      this.resizeCanvas();
    },
  },
};
</script>

<style scoped>
.bbox-component {
  flex: 1;
  display: flex;
  padding-right: 22px;
  flex-direction: column;
}

.bbox-component__header {
  gap: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bbox-component__header i {
  cursor: pointer;
  padding: 10px;
}

.bbox-component__header i.active {
  color: var(--blue);
}

.bbox-component__header i span {
  margin-left: 6px;
}

.bbox-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  background-color: rgb(0, 0, 0);
}

.bbox-component__footer {
  padding: 5px;
  color: white;
  display: flex;
  justify-content: center;
  background-color: black;
}
</style>
