<template>
  <div class="bbox-component">
    <div class="bbox-component__header">
      <i
        v-for="icon in iconList"
        :key="icon.name"
        :class="['fas', icon.name, { active: icon.active }]"
        @click="activateIcon(icon)"
      ></i>
    </div>
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
    src: {
      type: String,
      required: true,
    },

    questionIndex: {
      type: Number,
      required: true,
    },
  },

  data() {
    return {
      iconList: [
        { name: "fa-square", active: true },
        { name: "fa-eraser", active: false },
        { name: "fa-circle-minus", active: false },
      ],
      beforeCanvas: { width: null, height: null },
      beforeResizePosition: { x: 0, y: 0, questionIndex: null }, // 리사이징 이전의 이미지 포지션 저장
      squares: [],
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
  },

  methods: {
    activateIcon(selectedIcon) {
      if (selectedIcon.name === "fa-circle-minus") {
        // confirm 창을 띄워서 삭제 여부를 확인합니다.
        const isConfirmed = confirm("정말로 모든 사각형을 삭제하시겠습니까?");
        if (!isConfirmed) return;

        this.squares = [];
        this.redrawSquares();

        // fa-square 아이콘을 활성화합니다.
        const squareIcon = this.iconList.find(
          (icon) => icon.name === "fa-square"
        );
        this.activateIcon(squareIcon);

        return;
      }

      this.iconList.forEach((icon) => (icon.active = icon === selectedIcon));
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

      this.drawBackgroundImage();
      await this.setSquaresPosition(beforePosition); // 변경된 위치에 따라 사각형 포지션 조정

      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      const { width, height } = this.getCanvasElement();
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale; // 스케일 비율 계산

      this.squares.forEach((square) => {
        // 사각형의 위치를 조정합니다. 이미지의 위치 변화와 스케일 변화를 반영합니다.
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });
    },

    handleCanvasClick(event) {
      const { x, y } = this.getCanvasCoordinates(event);
      this.eraserActive ? this.eraseSquare(x, y) : this.drawSquare(x, y);
    },

    drawSquare(x, y) {
      this.squares.push({ x, y, questionIndex: this.questionIndex });
      this.redrawSquares();
    },

    eraseSquare(mouseX, mouseY) {
      const closestSquare = this.getClosestSquare(mouseX, mouseY);
      if (closestSquare) {
        const index = this.squares.indexOf(closestSquare);
        this.squares.splice(index, 1);
        this.redrawSquares();
      }
    },

    getClosestSquare(x, y) {
      return this.squares.reduce(
        (closest, square) => {
          const distance = Math.hypot(square.x - x, square.y - y);
          if (distance <= 50) {
            return distance < closest.distance ? { square, distance } : closest;
          }
          return closest;
        },
        { square: null, distance: Infinity }
      ).square;
    },

    redrawSquares() {
      this.drawBackgroundImage();
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      this.squares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "red";
        ctx.strokeRect(square.x - 10, square.y - 10, 20, 20);
      });
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

    isSquareClicked({ x, y }, mouseX, mouseY) {
      return Math.abs(x - mouseX) <= 10 && Math.abs(y - mouseY) <= 10;
    },

    getCanvasElement() {
      return this.$el.querySelector("canvas");
    },

    handleCanvasMouseMove(event) {
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const closestSquare = this.getClosestSquare(x, y);

      this.redrawSquares();

      if (closestSquare && this.eraserActive) {
        this.squares.forEach((square) => {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "red";
          ctx.strokeRect(square.x - 10, square.y - 10, 20, 20);
        });

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "blue";
        ctx.strokeRect(closestSquare.x - 10, closestSquare.y - 10, 20, 20);
      } else {
        this.activeEnlarge(event);
      }
    },

    activeEnlarge(event) {
      const canvas = this.getCanvasElement();
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 100; // 확대될 사각형의 너비
      const zoomHeight = 100; // 확대될 사각형의 높이
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
      ctx.rect(x - zoomWidth / 2, y - zoomHeight / 2, zoomWidth, zoomHeight); // 확대될 영역에 사각형 그리기
      ctx.closePath();
      ctx.clip(); // 클리핑 경로 설정

      // 확대된 이미지 부분 그리기
      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x - zoomWidth / 2,
        y - zoomHeight / 2,
        zoomWidth,
        zoomHeight
      );

      ctx.restore(); // 드로잉 상태 복원 (클리핑 경로 제거)
    },
  },

  mounted() {
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
  background-color: gray;
}
</style>
