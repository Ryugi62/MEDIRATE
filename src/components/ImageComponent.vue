<template>
  <div
    class="image-wrapper"
    ref="imageWrapper"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    @wheel="handleWheel"
  >
    <img :src="src" :alt="alt" :style="imageStyle" ref="image" class="image" />
  </div>
</template>

<script>
export default {
  name: "ImageComponent",

  props: {
    src: {
      type: String,
      default: "http://placekitten.com/200/300",
    },
    alt: {
      type: String,
      default: "",
    },
    maxScale: {
      type: Number,
      default: 50,
    },
    minScale: {
      type: Number,
      default: 0.8,
    },
  },

  data() {
    return {
      scale: 1,
      isDragging: false,
      startX: 0,
      startY: 0,
      translateX: 0,
      translateY: 0,
    };
  },

  computed: {
    imageStyle() {
      return {
        transform: `translate(-50%, -50%) translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`,
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
      };
    },
  },

  methods: {
    handleWheel(event) {
      event.preventDefault();
      const { deltaY } = event;
      const direction = deltaY > 0 ? -1 : 1;
      const factor = 0.1;
      let newScale = this.scale + direction * factor;

      newScale = Math.max(this.minScale, Math.min(newScale, this.maxScale));

      this.scale = newScale;
    },

    handleMouseDown(event) {
      event.preventDefault();

      this.isDragging = true;
      this.startX = event.clientX - this.translateX;
      this.startY = event.clientY - this.translateY;
    },

    handleMouseMove(event) {
      if (!this.isDragging) return;

      let newX = event.clientX - this.startX;
      let newY = event.clientY - this.startY;

      // .image-wrapper의 크기를 가져옵니다.
      const wrapperWidth = this.$refs.imageWrapper.offsetWidth;
      const wrapperHeight = this.$refs.imageWrapper.offsetHeight;

      // .image의 스케일을 고려한 실제 크기를 계산합니다.
      const scaledWidth = this.$refs.image.offsetWidth * this.scale;
      const scaledHeight = this.$refs.image.offsetHeight * this.scale;

      // .image가 .image-wrapper의 절반 크기를 넘지 않도록 제한합니다.
      const maxX = (wrapperWidth - scaledWidth) / 2;
      const maxY = (wrapperHeight - scaledHeight) / 2;
      const minX = maxX < 0 ? maxX : 0;
      const minY = maxY < 0 ? maxY : 0;

      // 계산된 범위 내에서 newX와 newY를 제한합니다.
      newX = Math.max(minX, Math.min(newX, -minX));
      newY = Math.max(minY, Math.min(newY, -minY));

      // 이동 범위를 업데이트합니다.
      this.translateX = newX;
      this.translateY = newY;
    },

    handleMouseUp() {
      this.isDragging = false;
    },

    handleMouseLeave() {
      this.isDragging = false;
    },

    resetImage() {
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
    },
  },

  watch: {
    src() {
      this.resetImage();
    },
  },
};
</script>

<style scoped>
.image-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative; /* 이미지의 부모를 상대 위치로 설정 */
  cursor: grab;
}

.image-wrapper:active {
  cursor: grabbing;
}

.image {
  width: 100%; /* 이미지가 컨테이너를 넘지 않도록 함 */
  height: 100%; /* 이미지가 컨테이너를 넘지 않도록 함 */
  object-fit: contain;
  transition: transform 0.2s ease-out;
  position: absolute; /* 이미지를 절대 위치로 설정 */
  top: 50%; /* 상단에서 50% 위치에 배치 */
  left: 50%; /* 좌측에서 50% 위치에 배치 */
  transform: translate(-50%, -50%) scale(1); /* 중앙 정렬 및 초기 스케일 설정 */
}
</style>
