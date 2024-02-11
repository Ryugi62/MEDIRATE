<template>
  <h1 class="title">대시보드</h1>
</template>

<script>
export default {
  name: "DashboardDetailView",

  data() {
    return {
      item: null,
    };
  },

  methods: {
    goToDetail(id) {
      this.$router.push(`/dashboard/${id}`);
    },
  },

  created() {},
};
</script>

<style scoped></style>
