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
  name: "BBoxViewerComponent",

  props: {
    userSquaresList: {
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

    sliderValue: {
      type: Number,
      required: true,
      default: 0,
    },

    updateSquares: {
      type: Function,
      required: true,
      default: () => {},
    },
  },

  data() {
    return {
      localBeforeCanvas: { width: null, height: null },
      originalLocalSquares: [],
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
    async fetchLocalInfo() {
      const { width, height } = this.$el
        .querySelector(".bbox-component__body")
        .getBoundingClientRect();

      const img = await this.createImage(this.src);
      this.setBackgroundImage(img);

      this.localBeforeCanvas = { width, height };

      this.userSquaresList.forEach(async (user) => {
        const beforePosition = this.calculateImagePosition(width, height);

        const userBeforePosition = this.calculateImagePosition(
          user.beforeCanvas.width,
          user.beforeCanvas.height
        );

        const scaleRatio = beforePosition.scale / userBeforePosition.scale;

        for (const square of user.squares) {
          square.color = user.color;

          square.x =
            (square.x - userBeforePosition.x) * scaleRatio + beforePosition.x;
          square.y =
            (square.y - userBeforePosition.y) * scaleRatio + beforePosition.y;

          this.localSquares.push(square);
        }
      });

      this.originalLocalSquares = [...this.localSquares];
      this.updateSquares([...this.localSquares]);
    },

    async filterSquares() {
      this.localSquares = [...this.originalLocalSquares];
      const squares = [];

      this.localSquares.forEach((square) => {
        const overlap = this.localSquares.filter((s) => {
          return (
            Math.abs(s.x - square.x) < 30 &&
            Math.abs(s.y - square.y) < 30 &&
            s.color !== square.color
          );
        });

        if (overlap.length + 1 >= this.sliderValue) squares.push(square);
      });

      this.localSquares = [...squares];
      this.redrawSquares();
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
        ctx.strokeStyle = square.color;
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

      // 마우스 위치에 따라 확대 화면의 위치를 결정합니다.
      const enlargePosition = this.getEnlargePosition(
        x,
        canvas.width,
        zoomWidth
      );

      // 이미지 위치 및 크기 계산
      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(canvas.width, canvas.height);

      console.log(imgX, imgY, scale);

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
      ctx.rect(enlargePosition.x, enlargePosition.y, zoomWidth, zoomHeight);
      ctx.closePath();
      ctx.clip();

      // 확대된 이미지 부분 그리기
      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        enlargePosition.x,
        enlargePosition.y,
        zoomWidth,
        zoomHeight
      );

      ctx.restore(); // 드로잉 상태 복원 (클리핑 경로 제거)
    },

    // 확대 화면 위치 결정 함수
    getEnlargePosition(mouseX, canvasWidth, zoomWidth) {
      let positionX = 0;
      let positionY = 0;

      if (mouseX < canvasWidth / 2) {
        // 마우스가 화면의 좌측에 있을 경우 확대 화면은 우측에 위치
        positionX = canvasWidth - zoomWidth;
        positionY = 0;
      } else {
        // 마우스가 화면의 우측에 있을 경우 확대 화면은 좌측에 위치
        positionX = 0;
        positionY = 0;
      }

      return { x: positionX, y: positionY };
    },

    activeSquareCursor(event) {
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const squareSize = 20;

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "white";
      ctx.strokeRect(
        x - squareSize / 2,
        y - squareSize / 2,
        squareSize,
        squareSize
      );
    },
  },

  async mounted() {
    await this.fetchLocalInfo();
    await this.filterSquares();

    await this.loadBackgroundImage();
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

    async sliderValue() {
      await this.filterSquares();
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
