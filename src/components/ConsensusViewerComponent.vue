<!-- ConsensusViewerComponent.vue -->
<!-- Consensus 분석용 뷰어 컴포넌트 (읽기 전용) -->

<template>
  <div class="consensus-viewer">
    <div class="consensus-viewer__body">
      <canvas
        ref="canvas"
        @mousemove="handleCanvasMouseMove"
        @mouseleave="redrawCanvas"
      ></canvas>
    </div>
  </div>
</template>

<script>
export default {
  name: "ConsensusViewerComponent",

  props: {
    src: {
      type: String,
      required: true,
      default: "",
    },
    fpSquares: {
      type: Array,
      required: true,
      default: () => [],
    },
    evaluatorResponses: {
      type: Object,
      required: true,
      default: () => ({}),
    },
    evaluators: {
      type: Array,
      required: true,
      default: () => [],
    },
    threshold: {
      type: Number,
      default: 2,
    },
  },

  data() {
    return {
      backgroundImage: null,
      originalWidth: 0,
      originalHeight: 0,
      // 슬라이드 전환 시 race condition 방지
      currentLoadId: 0,
      isUnmounted: false,
    };
  },

  watch: {
    src: {
      immediate: true,
      handler() {
        this.loadBackgroundImage();
      },
    },
    fpSquares: {
      handler() {
        this.redrawCanvas();
      },
      deep: true,
    },
    evaluatorResponses: {
      handler() {
        this.redrawCanvas();
      },
      deep: true,
    },
  },

  mounted() {
    window.addEventListener("resize", this.resizeCanvas);
    this.$nextTick(() => {
      this.resizeCanvas();
    });
  },

  beforeUnmount() {
    this.isUnmounted = true;
    this.currentLoadId++;  // 진행 중인 로드 무효화
    window.removeEventListener("resize", this.resizeCanvas);
  },

  methods: {
    loadBackgroundImage() {
      const loadId = ++this.currentLoadId;

      if (!this.src) return;

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        // 로드 완료 시 현재 로드인지 확인 (stale 로드 방지)
        if (loadId !== this.currentLoadId || this.isUnmounted) {
          return;
        }
        this.backgroundImage = image;
        this.originalWidth = image.width;
        this.originalHeight = image.height;
        this.resizeCanvas();
      };
      image.onerror = () => {
        if (loadId !== this.currentLoadId || this.isUnmounted) return;
        console.error("Failed to load image:", this.src);
      };
      image.src = this.src;
    },

    resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      // 캔버스 크기 초기화 (강제 재계산)
      canvas.width = 0;
      canvas.height = 0;

      // 부모 컨테이너의 실제 렌더링 크기 측정 (ConsensusComponent 방식)
      const container = this.$el.querySelector(".consensus-viewer__body");
      if (!container) return;

      const rect = container.getBoundingClientRect();

      // 캔버스 크기 = 컨테이너 크기
      canvas.width = rect.width;
      canvas.height = rect.height;

      this.redrawCanvas();
    },

    redrawCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 배경 이미지 그리기
      if (this.backgroundImage) {
        const { x, y, scale } = this.calculateImagePosition(
          canvas.width,
          canvas.height
        );
        ctx.drawImage(
          this.backgroundImage,
          x,
          y,
          this.originalWidth * scale,
          this.originalHeight * scale
        );
      }

      // FP 사각형 그리기
      this.drawFpSquares();
    },

    calculateImagePosition(canvasWidth, canvasHeight) {
      if (!this.originalWidth || !this.originalHeight) {
        return { x: 0, y: 0, scale: 1 };
      }

      const scale = Math.min(
        canvasWidth / this.originalWidth,
        canvasHeight / this.originalHeight
      );

      // 확대경(우측 상단 300x300)과 겹치지 않도록 이미지를 왼쪽으로 100px 이동
      const imageOffset = 100;
      const x = (canvasWidth - this.originalWidth * scale) / 2 - imageOffset;
      const y = (canvasHeight - this.originalHeight * scale) / 2;

      return { x, y, scale };
    },

    drawFpSquares() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      this.fpSquares.forEach((fp) => {
        // 좌표 범위 체크 (이미지 영역 내로 제한)
        const clampedFpX = Math.max(0, Math.min(fp.x, this.originalWidth));
        const clampedFpY = Math.max(0, Math.min(fp.y, this.originalHeight));

        // 원본 좌표가 이미지 영역을 벗어나면 표시하지 않음
        if (fp.x !== clampedFpX || fp.y !== clampedFpY) {
          return;
        }

        const x = imgX + fp.x * scale;
        const y = imgY + fp.y * scale;

        // 응답 상태에 따른 색상 결정
        const responses = this.evaluatorResponses[fp.id] || {};
        const responseValues = Object.values(responses);
        const agreeCount = responseValues.filter(
          (r) => r.response === "agree"
        ).length;
        const disagreeCount = responseValues.filter(
          (r) => r.response === "disagree"
        ).length;
        const totalResponses = responseValues.length;

        let strokeColor;
        let fillColor;

        if (totalResponses === 0) {
          // 미응답
          strokeColor = "#FFA500";
          fillColor = "rgba(255, 165, 0, 0.2)";
        } else if (fp.is_gold_standard) {
          // 골드 스탠다드
          strokeColor = "#FFD700";
          fillColor = "rgba(255, 215, 0, 0.3)";
        } else if (agreeCount >= this.threshold) {
          // 마이토시스
          strokeColor = "#00FF00";
          fillColor = "rgba(0, 255, 0, 0.2)";
        } else if (disagreeCount >= this.threshold) {
          // 논 마이토시스
          strokeColor = "#FF0000";
          fillColor = "rgba(255, 0, 0, 0.2)";
        } else {
          // 판정 미확정
          strokeColor = "#FFA500";
          fillColor = "rgba(255, 165, 0, 0.2)";
        }

        // 사각형 그리기
        ctx.fillStyle = fillColor;
        ctx.fillRect(x - boxHalf, y - boxHalf, boxSize, boxSize);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(x - boxHalf, y - boxHalf, boxSize, boxSize);

        // 응답 개수 표시
        if (totalResponses > 0) {
          ctx.font = "bold 10px Arial";
          ctx.fillStyle = "#333";
          ctx.textAlign = "center";
          ctx.fillText(
            `${agreeCount}/${disagreeCount}`,
            x,
            y + boxHalf + 12
          );
        }
      });
    },

    handleCanvasMouseMove(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      this.redrawCanvas();

      // 확대경 표시
      this.activeEnlarge(event);

      // 마우스 위치에 가장 가까운 FP 하이라이트
      const closestFp = this.getClosestFp(x, y);
      if (closestFp) {
        this.highlightFp(closestFp, ctx);
      }
    },

    // 확대경 기능 (ConsensusComponent와 동일)
    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted || !this.backgroundImage) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );

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

      const sourceX = mouseXOnImage - sourceWidth / 2;
      const sourceY = mouseYOnImage - sourceHeight / 2;

      // 확대경 위치: 이미지 우측 끝에서 20px * scale 떨어진 곳
      const imageRightEdge = imgX + this.originalWidth * scale;
      const zoomGap = 20 * scale;
      const zoomX = imageRightEdge + zoomGap;

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

    getCanvasCoordinates({ clientX, clientY }) {
      const canvas = this.$refs.canvas;
      if (!canvas) return { x: 0, y: 0 };

      const { left, top, width, height } = canvas.getBoundingClientRect();
      return {
        x: (clientX - left) * (canvas.width / width),
        y: (clientY - top) * (canvas.height / height),
      };
    },

    getClosestFp(mouseX, mouseY) {
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );

      let closest = null;
      let minDistance = 50 * scale; // 호버 인식 범위 - scale 적용

      this.fpSquares.forEach((fp) => {
        const x = imgX + fp.x * scale;
        const y = imgY + fp.y * scale;
        const distance = Math.hypot(mouseX - x, mouseY - y);
        if (distance < minDistance) {
          minDistance = distance;
          closest = { ...fp, canvasX: x, canvasY: y };
        }
      });

      return closest;
    },

    highlightFp(fp, ctx) {
      const canvas = this.$refs.canvas;
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      ctx.strokeStyle = "#FFFF00";
      ctx.lineWidth = 3 * scale;
      ctx.strokeRect(
        fp.canvasX - boxHalf,
        fp.canvasY - boxHalf,
        boxSize,
        boxSize
      );

      // 평가자별 응답 툴팁 표시
      const responses = this.evaluatorResponses[fp.id] || {};
      const tooltipLines = [];

      this.evaluators.forEach((evaluator) => {
        const response = responses[evaluator.id];
        const status = response
          ? response.response === "agree"
            ? "마이토시스"
            : "논 마이토시스"
          : "미응답";
        tooltipLines.push(`${evaluator.realname}: ${status}`);
      });

      if (tooltipLines.length > 0) {
        const padding = 8;
        const lineHeight = 16;
        const maxWidth = Math.max(
          ...tooltipLines.map((line) => ctx.measureText(line).width)
        );
        const tooltipWidth = maxWidth + padding * 2;
        const tooltipHeight = tooltipLines.length * lineHeight + padding * 2;

        let tooltipX = fp.canvasX + boxHalf + 10;
        let tooltipY = fp.canvasY - tooltipHeight / 2;

        // 캔버스 경계 체크
        if (tooltipX + tooltipWidth > canvas.width) {
          tooltipX = fp.canvasX - boxHalf - tooltipWidth - 10;
        }
        if (tooltipY < 0) tooltipY = 0;
        if (tooltipY + tooltipHeight > canvas.height) {
          tooltipY = canvas.height - tooltipHeight;
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

        ctx.font = "12px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        tooltipLines.forEach((line, idx) => {
          ctx.fillText(
            line,
            tooltipX + padding,
            tooltipY + padding + (idx + 1) * lineHeight - 4
          );
        });
      }
    },
  },
};
</script>

<style scoped>
.consensus-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.consensus-viewer__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
  overflow: hidden;
}

canvas {
  border: 1px solid #ccc;
  background-color: white;
  cursor: crosshair;
  max-width: 100%;
  max-height: 100%;
}
</style>
