<template>
  <div class="login-container">
    <h1>Login</h1>
    <form @submit.prevent="onSubmit">
      <div class="form-group">
        <label for="username">Username</label>
        <input
          type="text"
          id="username"
          v-model="loginData.username"
          required
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          v-model="loginData.password"
          required
        />
      </div>

      <button type="submit">Login</button>
    </form>
    <p v-if="loginError" class="error-message">{{ loginError }}</p>
  </div>
</template>

<script>
export default {
  name: "LoginView",
  data() {
    return {
      loginData: {
        username: "",
        password: "",
      },
      loginError: "", // 로그인 오류 메시지
    };
  },

  methods: {
    onSubmit() {
      // 여기에서 로그인 처리를 시뮬레이션합니다.
      const { username, password } = this.loginData;

      // 관리자 계정인지 확인합니다.
      const isAdministrator = username === "admin" && password === "password";

      // 간단한 로그인 시뮬레이션 (실제 서버 요청 대신 사용)
      if (
        (username === "user" && password === "password") ||
        (username === "admin" && password === "password")
      ) {
        // action 로그인
        this.$store.dispatch("loginUser", {
          username,
          password,
          isAdministrator,
        });

        // 로그인 후 홈 페이지로 이동
        this.$router.push({ name: "home" });
      } else {
        // 로그인 실패 시 오류 메시지 표시
        this.loginError = "Invalid username or password. Please try again.";
      }
    },
  },
};
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  padding: 10px 20px;
  background-color: #2980b9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  /* #2980b9보다 어두워져야됨 */
  background-color: #1f6fb2;
}

button:active {
  background-color: #1a5f9d;
}
</style>
