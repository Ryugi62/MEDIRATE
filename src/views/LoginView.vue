<template>
  <div class="login-container">
    <h1>로그인</h1>
    <form @submit.prevent="handleSubmit">
      <div class="form-group" v-for="field in formFields" :key="field.id">
        <div class="input-wrapper">
          <input
            :type="getFieldType(field)"
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
        <input type="checkbox" id="remember" v-model="rememberMe" />
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
          type: "password",
          model: "",
          icon: true,
          iconClass: "far fa-eye",
        },
      ],
      passwordFieldType: "password",
      rememberMe: false,
      loginError: "",
    };
  },

  mounted() {
    this.$store.dispatch("logoutUser");
    this.$store.commit("closeSlideBar");

    this.retrieveRememberedUsername();

    // URL 파라미터에서 username과 password 추출
    const queryParams = this.$route.query;
    if (queryParams.username && queryParams.password) {
      this.formFields.find((field) => field.id === "username").model =
        queryParams.username;
      this.formFields.find((field) => field.id === "password").model =
        queryParams.password;
      // 자동 로그인 시도
      this.login({
        username: queryParams.username,
        password: queryParams.password,
      });
    }
  },

  methods: {
    handleSubmit() {
      const credentials = this.extractCredentials();
      if (this.rememberMe) this.rememberUsername(credentials.username);
      else this.forgetUsername();

      this.login(credentials);
    },

    extractCredentials() {
      return this.formFields.reduce(
        (acc, field) => ({ ...acc, [field.id]: field.model }),
        {}
      );
    },

    login({ username, password }) {
      this.$axios
        .post("/api/auth/login", {
          username,
          password,
        })
        .then((result) => {
          const token = result.data.token;
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const payload = JSON.parse(atob(base64));
          const expires = payload.exp;

          this.$store.dispatch("loginUser", {
            username: result.data.username,
            realname: result.data.realname,
            token: result.data.token,
            expires,
            isAdministrator: result.data.isAdministrator,
          });

          // mutateion
          this.$store.commit("openSlideBar", true);
          this.$router.push({ name: "assignment" });
        })
        .catch((err) => {
          console.error(err);
        });
    },

    togglePasswordVisibility() {
      this.passwordFieldType =
        this.passwordFieldType === "password" ? "text" : "password";
      this.updateIconClass();
    },

    updateIconClass() {
      const passwordField = this.formFields.find(
        (field) => field.id === "password"
      );
      passwordField.iconClass =
        this.passwordFieldType === "text" ? "far fa-eye-slash" : "far fa-eye";
    },

    retrieveRememberedUsername() {
      const rememberedUsername = localStorage.getItem("rememberedUsername");
      if (rememberedUsername) {
        const usernameField = this.formFields.find(
          (field) => field.id === "username"
        );
        usernameField.model = rememberedUsername;
        this.rememberMe = true;
      }
    },

    rememberUsername(username) {
      localStorage.setItem("rememberedUsername", username);
    },

    forgetUsername() {
      localStorage.removeItem("rememberedUsername");
    },

    getFieldType(field) {
      return field.id === "password" ? this.passwordFieldType : field.type;
    },
  },
};
</script>

<style scoped>
.login-container {
  height: 100%;
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
