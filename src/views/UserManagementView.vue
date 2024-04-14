<template>
  <div>
    <h1>User management</h1>

    {{ userList }}
  </div>
</template>

<script>
export default {
  name: "User managementView",

  data() {
    return {
      userList: [],
    };
  },

  mounted() {
    this.getUserList();
  },

  methods: {
    getUserList() {
      this.$axios
        .post("/api/assignments/user-list")
        .then((response) => {
          this.userList = response.data;
        })
        .catch((error) => {
          console.error("유저 정보를 가져오는 중 오류 발생:", error);
        });
    },
  },
};
</script>

<style scoped></style>
