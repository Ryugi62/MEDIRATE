<template>
  <div class="bbox-component">
    <div class="bbox-component__body">
      <canvas
        @click="handleCanvasClick"
        @mousemove="handleCanvasMouseMove"
      ></canvas>
    </div>
  </div>
</template>

<script>
export default {
  name: "BBoxComponent",

  props: {
    beforeCanvas: {
      type: Object,
      required: true,
      default: () => ({ width: null, height: null }),
    },

    squares: {
      type: Array,
      required: true,
      default: () => [],
    },

    src: {
      type: String,
      required: true,
      default: "",
    },

    questionIndex: {
      type: Number,
      required: true,
      default: 0,
    },
  },

  data() {
    return {
      localBeforeCanvas: { width: null, height: null },
      beforeResizePosition: { x: 0, y: 0, questionIndex: null }, // 리사이징 이전의 이미지 포지션 저장
      localSquares: [],
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
    };
  },

  computed: {
    isSliderActive() {
      return this.$store.getters.isSlideBarOpen;
    },
  },

  methods: {
    fetchLocalInfo() {
      this.localBeforeCanvas = this.beforeCanvas;
      this.localSquares = this.squares;
    },

    async loadBackgroundImage() {
      const img = await this.createImage(this.src);
      this.setBackgroundImage(img);
      this.resizeCanvas();
    },

    createImage(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    },

    setBackgroundImage(img) {
      this.backgroundImage = img;
      this.originalWidth = img.width;
      this.originalHeight = img.height;
    },

    drawBackgroundImage() {
      const canvas = this.getCanvasElement();
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
      const canvas = this.getCanvasElement();
      if (!canvas) return;

      if (this.localBeforeCanvas.width && this.localBeforeCanvas.height) {
        canvas.width = this.localBeforeCanvas.width;
        canvas.height = this.localBeforeCanvas.height;
      }

      const beforePosition = this.calculateImagePosition(
        canvas.width,
        canvas.height
      ); // 리사이징 이전 포지션 저장
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
      await this.setSquaresPosition(beforePosition); // 변경된 위치에 따라 사각형 포지션 조정

      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      const { width, height } = this.getCanvasElement();
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale; // 스케일 비율 계산

      this.localSquares.forEach((square) => {
        // 사각형의 위치를 조정합니다. 이미지의 위치 변화와 스케일 변화를 반영합니다.
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });
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
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      this.localSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "red";
        ctx.strokeRect(square.x - 10, square.y - 10, 20, 20);
      });

      if (event) {
        this.activeEnlarge(event);
        this.activeSquareCursor(event);
      }
    },

    getCanvasCoordinates({ clientX, clientY }) {
      const canvas = this.getCanvasElement();
      if (!canvas) return {};

      const { left, top, width, height } = canvas.getBoundingClientRect();
      return {
        x: (clientX - left) * (canvas.width / width),
        y: (clientY - top) * (canvas.height / height),
      };
    },

    getCanvasElement() {
      return this.$el.querySelector("canvas");
    },

    handleCanvasMouseMove(event) {
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const closestSquare = this.getClosestSquare(x, y);

      this.redrawSquares(event);

      if (closestSquare && this.eraserActive) {
        this.localSquares.forEach((square) => {
          if (square.questionIndex === this.questionIndex) {
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "red";
            ctx.strokeRect(square.x - 10, square.y - 10, 20, 20);
          }
        });

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "blue";
        ctx.strokeRect(closestSquare.x - 10, closestSquare.y - 10, 20, 20);
      }
    },

    activeEnlarge(event) {
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 200; // 확대될 사각형의 너비
      const zoomHeight = 200; // 확대될 사각형의 높이
      const zoomLevel = 2.5; // 확대 비율

      // 이미지 위치 및 크기 계산
      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(canvas.width, canvas.height);

      // 마우스 위치를 이미지 상의 좌표로 변환
      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      // 확대할 이미지 부분 계산 (이미지 상의 좌표를 사용)
      const sourceX = mouseXOnImage - zoomWidth / zoomLevel / 2;
      const sourceY = mouseYOnImage - zoomHeight / zoomLevel / 2;
      const sourceWidth = zoomWidth / zoomLevel;
      const sourceHeight = zoomHeight / zoomLevel;

      this.redrawSquares();

      if (!this.backgroundImage) return;

      ctx.save(); // 현재 드로잉 상태 저장
      ctx.beginPath();
      ctx.rect(0, 0, zoomWidth, zoomHeight); // 확대될 영역에 사각형 그리기 (상단 좌측에 표출)
      ctx.closePath();
      ctx.clip(); // 클리핑 경로 설정

      // 확대된 이미지 부분 그리기
      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        zoomWidth,
        zoomHeight
      );

      ctx.restore(); // 드로잉 상태 복원 (클리핑 경로 제거)
    },

    activeSquareCursor(event) {
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const squareSize = 20;

      ctx.lineWidth = 2.5;
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

.bbox-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  background-color: rgb(0, 0, 0);
}
</style>