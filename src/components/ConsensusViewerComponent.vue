<!-- ConsensusViewerComponent.vue -->
<!-- Consensus 분석용 뷰어 컴포넌트 (읽기 전용) -->

<template>
  <div class="consensus-viewer">
    <div class="consensus-viewer__body">
      <div class="canvas-container">
        <canvas
          ref="canvas"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
        ></canvas>
      </div>
      <ZoomLens
        :image="backgroundImage"
        :mouseX="zoomMouseX"
        :mouseY="zoomMouseY"
        :isActive="isZoomActive"
        :width="zoomSize"
        :height="zoomSize"
        :zoomLevel="2.0"
      />
    </div>
  </div>
</template>

<script>
import ZoomLens from "./ZoomLens.vue";

export default {
  name: "ConsensusViewerComponent",
  components: {
    ZoomLens,
  },

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
    nipaBoxes: {
      type: Object,
      default: () => ({ match_2: [], match_3: [] }),
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
      // 확대경 관련
      zoomMouseX: 0,
      zoomMouseY: 0,
      isZoomActive: false,
      canvasHeight: 280,
    };
  },

  computed: {
    zoomSize() {
      const size = Math.floor(this.canvasHeight * 0.4);
      return Math.max(200, Math.min(350, size));
    },
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
    nipaBoxes: {
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

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      // 이미지가 로드되지 않았으면 리턴
      if (!this.originalWidth || !this.originalHeight) {
        return;
      }

      await this.$nextTick();

      // 부모 body에서 크기 측정
      const body = this.$el?.querySelector(".consensus-viewer__body");
      if (!body) return;

      const bodyRect = body.getBoundingClientRect();

      // ZoomLens 너비 + gap (10px)을 뺀 가용 너비
      const zoomLensWidth = this.zoomSize;
      const gap = 10;
      const availableWidth = bodyRect.width - zoomLensWidth - gap;
      const availableHeight = bodyRect.height;

      if (availableWidth <= 0 || availableHeight <= 0) return;

      // 이미지 비율 유지하면서 가용 공간에 맞춤
      const scaleX = availableWidth / this.originalWidth;
      const scaleY = availableHeight / this.originalHeight;
      const scale = Math.min(scaleX, scaleY);

      const canvasWidth = Math.floor(this.originalWidth * scale);
      const canvasHeight = Math.floor(this.originalHeight * scale);

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      this.canvasHeight = canvasHeight;

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

      // NIPA 박스 그리기 (비활성화)
      // this.drawNipaBoxes();
    },

    calculateImagePosition(canvasWidth, canvasHeight) {
      if (!this.originalWidth || !this.originalHeight) {
        return { x: 0, y: 0, scale: 1 };
      }

      // contain 방식: 이미지가 캔버스에 완전히 들어가도록 스케일 계산
      const scaleX = canvasWidth / this.originalWidth;
      const scaleY = canvasHeight / this.originalHeight;
      const scale = Math.min(scaleX, scaleY);

      return { x: 0, y: 0, scale };
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
        // 좌표를 이미지 영역 내로 제한 (클램핑)
        // 좌표가 영역을 벗어나도 가장 가까운 위치에 박스를 표시
        const clampedFpX = Math.max(0, Math.min(fp.x, this.originalWidth - 25));
        const clampedFpY = Math.max(0, Math.min(fp.y, this.originalHeight - 25));

        // ConsensusComponent와 동일하게 +12.5 오프셋 적용 (박스 중심 맞춤)
        const x = imgX + (clampedFpX + 12.5) * scale;
        const y = imgY + (clampedFpY + 12.5) * scale;

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
          strokeColor = "#2196F3";
          fillColor = "rgba(33, 150, 243, 0.2)";
        } else if (fp.is_gold_standard) {
          // 골드 스탠다드
          strokeColor = "#FFD700";
          fillColor = "rgba(255, 215, 0, 0.3)";
        } else if (agreeCount >= this.threshold) {
          // 마이토시스
          strokeColor = "#00C853";
          fillColor = "rgba(0, 200, 83, 0.4)";
        } else if (disagreeCount >= this.threshold) {
          // 논 마이토시스
          strokeColor = "#FF0000";
          fillColor = "rgba(255, 0, 0, 0.3)";
        } else {
          // 판정 미확정
          strokeColor = "#2196F3";
          fillColor = "rgba(33, 150, 243, 0.2)";
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

    // NIPA 박스 그리기
    drawNipaBoxes() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );

      // 2인 일치 박스 (마젠타)
      if (this.nipaBoxes.match_2 && this.nipaBoxes.match_2.length > 0) {
        ctx.strokeStyle = "#FF00FF";
        ctx.lineWidth = 2 * scale;
        this.nipaBoxes.match_2.forEach((box) => {
          const [x, y, w, h] = box;
          ctx.strokeRect(
            imgX + x * scale,
            imgY + y * scale,
            w * scale,
            h * scale
          );
        });
      }

      // 3인 일치 박스 (보라)
      if (this.nipaBoxes.match_3 && this.nipaBoxes.match_3.length > 0) {
        ctx.strokeStyle = "#8B00FF";
        ctx.lineWidth = 2 * scale;
        this.nipaBoxes.match_3.forEach((box) => {
          const [x, y, w, h] = box;
          ctx.strokeRect(
            imgX + x * scale,
            imgY + y * scale,
            w * scale,
            h * scale
          );
        });
      }
    },

    handleCanvasMouseMove(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      this.redrawCanvas();

      // ZoomLens 컴포넌트용 마우스 좌표 계산
      if (this.backgroundImage) {
        const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
          canvas.width,
          canvas.height
        );
        // 이미지 상의 원본 좌표로 변환
        this.zoomMouseX = (x - imgX) / scale;
        this.zoomMouseY = (y - imgY) / scale;
        this.isZoomActive = true;
      }

      // 마우스 위치에 가장 가까운 FP 하이라이트
      const closestFp = this.getClosestFp(x, y);
      if (closestFp) {
        this.highlightFp(closestFp, ctx);
      }
    },

    handleCanvasMouseLeave() {
      this.isZoomActive = false;
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
        const x = imgX + (fp.x + 12.5) * scale;
        const y = imgY + (fp.y + 12.5) * scale;
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
  gap: 10px;
  align-items: flex-start;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.canvas-container {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  overflow: hidden;
}

.zoom-lens {
  flex-shrink: 0;
}

canvas {
  border: 1px solid #ccc;
  background-color: white;
  cursor: crosshair;
}
</style>
