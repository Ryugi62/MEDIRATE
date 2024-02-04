<template>
  <div class="login-container">
    <h1>로그인</h1>
    <form @submit.prevent="submitForm">
      <div class="form-group" v-for="field in formFields" :key="field.id">
        <div class="input-wrapper">
          <input
            :type="field.id === 'password' ? passwordFieldType : field.type"
            :id="field.id"
            v-model="field.model"
            required
            :placeholder="field.label"
          />
          <i
            v-if="field.icon"
            :class="field.iconClass"
            @click="togglePasswordVisibility"
          ></i>
        </div>
      </div>
      <div class="form-group">
        <input type="checkbox" id="remember" v-model="rememberUsername" />
        <label for="remember">아이디를 기억할까요?</label>
      </div>
      <button type="submit">Login</button>
    </form>
  </div>
</template>

<script>
export default {
  name: "LoginView",
  data() {
    return {
      formFields: [
        {
          id: "username",
          label: "아이디",
          type: "text",
          model: "",
          icon: false,
        },
        {
          id: "password",
          label: "비밀번호",
          type: "password", // 이 필드는 'password' 타입으로 시작
          model: "",
          icon: true,
          iconClass: "far fa-eye", // 초기 아이콘 클래스는 'far fa-eye'
        },
      ],
      passwordFieldType: "password", // 비밀번호 필드 타입 초기값을 'password'로 설정
      rememberMe: false,
      loginError: "",
    };
  },

  mounted() {
    this.loadUsername();
  },
  methods: {
    submitForm() {
      const { username, password } = this.formFields.reduce(
        (acc, field) => ({ ...acc, [field.id]: field.model }),
        {}
      );

      if (this.rememberMe) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }

      const isAdministrator = username === "admin" && password === "password";
      if (this.isValidLogin(username, password)) {
        this.$store.dispatch("loginUser", {
          username,
          password,
          isAdministrator,
        });
        this.$router.push({ name: "home" });
      } else {
        this.loginError = "Invalid username or password. Please try again.";
      }
    },

    isValidLogin(username, password) {
      return (
        (username === "user" && password === "password") ||
        (username === "admin" && password === "password")
      );
    },
    togglePasswordVisibility() {
      this.passwordFieldType =
        this.passwordFieldType === "password" ? "text" : "password";
      this.formFields.find((field) => field.id === "password").iconClass =
        this.passwordFieldType === "password"
          ? "far fa-eye-slash"
          : "far fa-eye"; // 아이콘 클래스 동적 변경
    },
    loadUsername() {
      const rememberedUsername = localStorage.getItem("rememberedUsername");
      if (rememberedUsername) {
        const usernameField = this.formFields.find(
          (field) => field.id === "username"
        );
        usernameField.model = rememberedUsername;
        this.rememberMe = true;
      }
    },
  },
};
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

h1 {
  margin-bottom: 48px;
}

.form-group {
  display: flex;
  margin-bottom: 16px;
}

.input-wrapper {
  display: flex;
  align-items: center;
  padding: 8px;
  border: 2px solid var(--light-gray);
  border-radius: 4px;
  width: 358px;
  height: 35px;
  transition: border-color 0.3s; /* 부드러운 색상 전환을 위한 트랜지션 추가 */
}

.input-wrapper:focus-within {
  border: 2px solid var(--blue); /* 여기에 추가 */
}

.input-wrapper input {
  width: 100%;
  padding: 8px 0;
  font-size: 16px;
  border: none;
  outline: none;
}

.far {
  padding: 8px;
  color: var(--light-gray);
}

/* 커스텀 체크박스 스타일 */
input[type="checkbox"] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid var(--light-gray);
  border-radius: 4px;
  outline: none;
  background-color: transparent;
}

input[type="checkbox"]:checked {
  background-color: var(--blue);
  border-color: var(--blue);
}

input[type="checkbox"]:checked:after {
  content: "";
  position: absolute;
  left: 5px;
  top: 1px;
  width: 3px;
  height: 8px;
  border: solid var(--white);
  border-width: 0 3px 3px 0;
  transform: rotate(45deg);
}

input[type="checkbox"]:checked {
  background-color: var(--blue);
  border: 2px solid var(--blue);
  color: var(--white);
}

button {
  width: 100%;
  font-size: 16px;
  height: 53px;
}
</style>
