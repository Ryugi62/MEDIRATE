<template>
  <div class="bbox-component">
    <div class="bbox-component__body">
      <canvas
        ref="canvas"
        @mousemove="handleCanvasMouseMove"
        @resize="resizeCanvas"
        @mouseleave="redrawSquares"
      ></canvas>
    </div>
    <div class="bbox-component__footer">
      <strong>{{ getFileNameFromSrc() }}</strong>
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
    aiData: {
      type: Array,
      required: true,
      default: () => [],
    },
    score_percent: {
      type: Number,
      required: true,
      default: 50,
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
      aiSquares: [],
      // 슬라이드 전환 시 race condition 방지
      currentLoadId: 0,
      isUnmounted: false,
    };
  },

  computed: {
    isSliderActive() {
      return this.$store.getters.isSlideBarOpen;
    },
  },

  methods: {
    async fetchLocalInfo() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const { width, height } = canvas.getBoundingClientRect();
      const img = await this.createImage(this.src);
      this.setBackgroundImage(img);
      this.localBeforeCanvas = { width, height };

      this.localSquares = []; // 기존 데이터 초기화

      for (const user of this.userSquaresList) {
        if (!user.beforeCanvas) {
          user.beforeCanvas = { width: img.width, height: img.height };
        } else if (!user.beforeCanvas.width || !user.beforeCanvas.height) {
          user.beforeCanvas.width = img.width;
          user.beforeCanvas.height = img.height;
        }

        if (!user.squares || !Array.isArray(user.squares)) continue;

        const beforePosition = this.calculateImagePosition(width, height);
        const userBeforePosition = this.calculateImagePosition(
          user.beforeCanvas.width,
          user.beforeCanvas.height
        );
        const scaleRatio = beforePosition.scale / userBeforePosition.scale;

        for (const square of user.squares) {
          const localSquare = JSON.parse(JSON.stringify(square)); // 깊은 복사
          localSquare.color = user.color;
          localSquare.x =
            (square.x - userBeforePosition.x) * scaleRatio + beforePosition.x;
          localSquare.y =
            (square.y - userBeforePosition.y) * scaleRatio + beforePosition.y;
          this.localSquares.push(localSquare);
        }
      }

      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(width, height);
      this.aiSquares = this.aiData.map((square) => ({
        x: square.x * scale + imgX,
        y: square.y * scale + imgY,
        questionIndex: square.questionIndex,
        isAI: true,
        color: "#FFFF00",
        score: square.score,
      }));

      this.originalLocalSquares = this.localSquares.map((square) =>
        JSON.parse(JSON.stringify(square))
      ); // 깊은 복사
      this.updateSquares([...this.localSquares]);
    },

    async filterSquares() {
      // 원본 이미지 좌표로 변환
      const adjustedSquares = this.originalLocalSquares
        .filter(
          (square) =>
            square.questionIndex === this.questionIndex && !square.isTemporary
        )
        .map((square) => {
          const { x, y } = this.convertToOriginalImageCoordinates(
            square.x,
            square.y,
            this.localBeforeCanvas.width,
            this.localBeforeCanvas.height,
            this.originalWidth,
            this.originalHeight
          );
          return { ...square, x, y };
        });

      // 그룹화 진행
      const groups = [];
      const visited = new Set();

      const dfs = (square, group) => {
        if (visited.has(square)) return;
        visited.add(square);
        group.push(square);

        adjustedSquares.forEach((otherSquare) => {
          if (
            !visited.has(otherSquare) &&
            Math.abs(square.x - otherSquare.x) <= 12.5 &&
            Math.abs(square.y - otherSquare.y) <= 12.5 &&
            square.color !== otherSquare.color
          ) {
            dfs(otherSquare, group);
          }
        });
      };

      adjustedSquares.forEach((square) => {
        if (!visited.has(square)) {
          const group = [];
          dfs(square, group);
          groups.push(group);
        }
      });

      const filteredGroups = groups.filter(
        (group) => group.length >= this.sliderValue
      );

      // 다시 캔버스 좌표로 변환하여 렌더링
      this.localSquares = filteredGroups.flat().map((square) => {
        const { x, y } = this.convertToCanvasCoordinates(
          square.x,
          square.y,
          this.localBeforeCanvas.width,
          this.localBeforeCanvas.height,
          this.originalWidth,
          this.originalHeight
        );
        return { ...square, x, y };
      });

      this.redrawSquares();
      this.updateSquares([...this.localSquares]);
    },

    convertToOriginalImageCoordinates(x, y, canvasWidth, canvasHeight) {
      const currentPosition = this.calculateImagePosition(
        canvasWidth,
        canvasHeight
      );
      const scaleRatio = 1 / currentPosition.scale;

      const adjustedX = (x - currentPosition.x) * scaleRatio;
      const adjustedY = (y - currentPosition.y) * scaleRatio;

      return { x: adjustedX, y: adjustedY };
    },

    convertToCanvasCoordinates(x, y, canvasWidth, canvasHeight) {
      const currentPosition = this.calculateImagePosition(
        canvasWidth,
        canvasHeight
      );

      const adjustedX = x * currentPosition.scale + currentPosition.x;
      const adjustedY = y * currentPosition.scale + currentPosition.y;

      return { x: adjustedX, y: adjustedY };
    },

    async loadBackgroundImage() {
      const loadId = ++this.currentLoadId;

      if (!this.src) return;

      try {
        const img = await this.createImage(this.src);

        // 로드 완료 시 현재 로드인지 확인 (stale 로드 방지)
        if (loadId !== this.currentLoadId || this.isUnmounted) {
          return;
        }

        this.setBackgroundImage(img);
        this.resizeCanvas();
      } catch (error) {
        if (loadId !== this.currentLoadId || this.isUnmounted) return;
        console.error("이미지 로드 오류:", error);
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
      // 0으로 나누기 방지
      if (!this.originalWidth || !this.originalHeight) {
        return { x: 0, y: 0, scale: 1 };
      }

      // contain 방식: 이미지가 캔버스에 완전히 들어가도록 스케일 계산
      const scaleX = canvasWidth / this.originalWidth;
      const scaleY = canvasHeight / this.originalHeight;
      const scale = Math.min(scaleX, scaleY);

      return { x: 0, y: 0, scale };
    },

    resizeCanvas() {
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
      this.setSquaresPosition(beforePosition);

      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      const { width, height } = canvas;
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale;

      for (const square of this.localSquares) {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      }

      for (const square of this.aiSquares) {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      }
    },

    redrawSquares(event = null) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      this.drawBackgroundImage();
      const ctx = canvas.getContext("2d");

      // 이미지 영역 계산 (이미지 밖의 박스는 표시하지 않음)
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imageLeft = imgX;
      const imageTop = imgY;
      const imageRight = imgX + this.originalWidth * scale;
      const imageBottom = imgY + this.originalHeight * scale;

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      this.localSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex || square.isTemporary)
          return;

        // 이미지 영역 밖의 박스는 표시하지 않음
        if (square.x < imageLeft || square.x > imageRight ||
            square.y < imageTop || square.y > imageBottom) {
          return;
        }

        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = square.color || "#FF0000";
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(square.x - boxHalf, square.y - boxHalf, boxSize, boxSize);
        ctx.globalAlpha = 1;
      });

      this.aiSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        if (square.score < this.score_percent / 100) return;

        // 이미지 영역 밖의 박스는 표시하지 않음
        if (square.x < imageLeft || square.x > imageRight ||
            square.y < imageTop || square.y > imageBottom) {
          return;
        }

        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = square.color;
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(square.x - boxHalf, square.y - boxHalf, boxSize, boxSize);
        ctx.globalAlpha = 1;
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
      this.redrawSquares(event);
    },

    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(canvas.width, canvas.height);

      // 확대경 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const baseZoomSize = 300;
      const zoomLevel = 2.0;
      const zoomWidth = baseZoomSize * scale;
      const zoomHeight = baseZoomSize * scale;

      // 캡처 영역은 고정 (스케일과 무관하게 항상 동일한 영역 표시)
      const sourceWidth = baseZoomSize / zoomLevel;
      const sourceHeight = baseZoomSize / zoomLevel;

      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      // 이미지 영역 밖(검은 영역)에서는 줌을 표시하지 않음
      if (
        !this.backgroundImage ||
        mouseXOnImage < 0 ||
        mouseYOnImage < 0 ||
        mouseXOnImage > this.originalWidth ||
        mouseYOnImage > this.originalHeight
      ) {
        return;
      }

      const sourceX = mouseXOnImage - sourceWidth / 2;
      const sourceY = mouseYOnImage - sourceHeight / 2;

      // 확대경 위치: 이미지 우측 끝에서 20px * scale 떨어진 곳
      const imageRightEdge = imgX + this.originalWidth * scale;
      const zoomGap = 20 * scale;
      const zoomX = imageRightEdge + zoomGap;

      this.redrawSquares();

      ctx.save();
      ctx.beginPath();
      ctx.rect(zoomX, 0, zoomWidth, zoomHeight);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        zoomX,
        0,
        zoomWidth,
        zoomHeight
      );

      ctx.restore();
    },

    activeSquareCursor(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = "white";
      ctx.strokeRect(x - boxHalf, y - boxHalf, boxSize, boxSize);
    },

    getFileNameFromSrc() {
      return this.src.split("/").pop();
    },
  },

  async mounted() {
    await this.fetchLocalInfo();
    await this.filterSquares();
    await this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
  },

  beforeUnmount() {
    this.isUnmounted = true;
    this.currentLoadId++;  // 진행 중인 로드 무효화
    window.removeEventListener("resize", this.resizeCanvas);
  },

  watch: {
    async src(newVal, oldVal) {
      if (newVal !== oldVal) {
        await this.fetchLocalInfo();
        await this.filterSquares();
        await this.loadBackgroundImage();
        this.redrawSquares();
      }
    },

    isSliderActive() {
      this.resizeCanvas();
    },

    async sliderValue() {
      await this.filterSquares();
      this.redrawSquares();
    },

    aiData: {
      handler(newAiData) {
        const canvas = this.$refs.canvas;
        if (!canvas || this.isUnmounted) return;

        const { width, height } = canvas.getBoundingClientRect();
        const {
          x: imgX,
          y: imgY,
          scale,
        } = this.calculateImagePosition(width, height);
        this.aiSquares = newAiData.map((square) => ({
          x: square.x * scale + imgX,
          y: square.y * scale + imgY,
          questionIndex: square.questionIndex,
          isAI: true,
          color: "#FFFF00",
          score: square.score,
        }));
        this.redrawSquares();
      },
      deep: true,
    },

    score_percent() {
      this.redrawSquares();
    },
  },
};
</script>

<style scoped>
.bbox-component {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.bbox-component__header,
.bbox-component__footer {
  display: flex;
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
  min-height: 0;
  overflow: hidden;
}

canvas {
  max-height: 100%;
  background-color: white;
}

.bbox-component__footer {
  padding: 5px;
  color: #333;
  background-color: #f5f5f5;
}
</style>
