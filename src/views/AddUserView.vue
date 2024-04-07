<template>
  <div class="container">
    <form @submit.prevent="submitForm">
      <div class="input-group">
        <label for="user_id">User ID:</label>
        <input type="text" id="user_id" v-model="user_id" />
        <button class="check-btn" type="button" @click="checkDuplicate">
          중복확인
        </button>
        <div class="status-message">
          <span v-if="isDuplicate" class="error">User ID already exists</span>
          <span v-else-if="isAvailable" class="success"
            >User ID is available</span
          >
        </div>
      </div>

      <div class="input-group">
        <label for="user_name">User Name:</label>
        <input type="text" id="user_name" v-model="user_name" />
      </div>

      <div class="input-group">
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" />
      </div>

      <div class="input-group">
        <label for="role">Role:</label>
        <select id="role" v-model="role">
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      <button type="submit" class="submit-btn">Submit</button>
    </form>
  </div>
</template>

<script>
export default {
  name: "AddUserView",

  data() {
    return {
      user_id: "",
      user_name: "",
      password: "",
      role: "user",
      isDuplicate: null,
      isAvailable: null,
    };
  },

  methods: {
    submitForm() {
      if (!this.user_id || !this.user_name || !this.password) {
        alert("모든 필드를 입력해주세요.");
        return;
      }

      if (this.isDuplicate) {
        alert("이미 존재하는 아이디입니다. 다른 아이디를 입력해주세요.");
        return;
      }

      if (this.isDuplicate === null) {
        alert("아이디 중복확인을 해주세요.");
        return;
      }

      this.$axios
        .post("/api/auth/register", {
          username: this.user_id,
          realname: this.user_name,
          password: this.password,
          role: this.role,
        })
        .then(() => {
          this.$router.push("/");
        })
        .catch((error) => {
          alert("유저 추가에 실패했습니다. 다시 시도해주세요.");

          console.log(error);
        });
    },

    checkDuplicate() {
      if (!this.user_id) {
        alert("User ID를 입력해주세요.");
        return;
      }

      this.$axios
        // /api/auth/:username
        .get(`/api/auth/${this.user_id}`)
        .then(() => {
          this.isDuplicate = false;
          this.isAvailable = true;
        })
        .catch((error) => {
          this.isDuplicate = true;
          this.isAvailable = false;

          console.log(error);
        });
    },
  },
};
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f8f8f7;
  padding: 20px;
  border-radius: 10px;
  font-family: "Arial", "Helvetica", sans-serif;
  color: #1d1d1f;
}

.input-group {
  margin-bottom: 20px;
  width: 100%;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

input[type="text"],
input[type="password"],
select {
  width: calc(100% - 24px);
  padding: 12px;
  border-radius: 8px;
  border: 2px solid #c7c7cc;
  background-color: #fff;
  margin-bottom: 12px;
}

button {
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
}

.check-btn {
  background-color: #30d158;
  color: #fff;
}

.check-btn:hover {
  background-color: #34c759;
}

.status-message span {
  font-size: 12px;
}

.error {
  color: #ff3b30;
}

.success {
  color: #34c759;
}
</style>
