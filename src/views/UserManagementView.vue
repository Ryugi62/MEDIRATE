<template>
  <div class="user-management-container">
    <h1 class="title-container">
      <span>회원 관리</span>
      <button class="add-user-button" @click="toggleAddMode">
        회원 추가 폼
      </button>
    </h1>
    <form v-if="addMode" @submit.prevent="addUser">
      <div class="input-group">
        <input
          type="text"
          v-model="newUser.username"
          placeholder="회원 아이디를 입력하세요."
        />
        <span v-if="isUniqueUsername === false" class="error-message"
          >이미 사용 중인 아이디입니다.</span
        >
        <span v-else-if="isUniqueUsername" class="success-message"
          >사용 가능한 아이디입니다.</span
        >
        <span v-else class="info-message">아이디 중복 확인을 해주세요.</span>
        <button class="check-button" @click.prevent="checkUsername">
          중복 확인
        </button>
      </div>
      <input
        type="text"
        v-model="newUser.realname"
        placeholder="회원 이름을 입력하세요."
      />
      <select v-model="newUser.role">
        <option value="admin">관리자</option>
        <option value="user">유저</option>
      </select>
      <input
        type="password"
        v-model="newUser.password"
        placeholder="비밀번호를 입력하세요."
      />
      <input
        type="password"
        v-model="newUser.confirmPassword"
        placeholder="비밀번호를 다시 입력하세요."
      />
      <span v-if="isPasswordMatch" class="error-message"
        >비밀번호가 일치하지 않습니다.</span
      >
      <span v-else-if="isPasswordMatch === false" class="success-message"
        >비밀번호가 일치합니다.</span
      >
      <div class="button-container">
        <button type="submit">회원 추가</button>
        <button type="button" @click="cancelAddUser">취소</button>
      </div>
    </form>
    <div class="table-container">
      <table class="user-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>아이디</th>
            <th>이름</th>
            <th>권한</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(user, index) in userList" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.username }}</td>
            <td>
              <template v-if="!user.editMode">{{ user.realname }}</template>
              <template v-else>
                <input type="text" v-model="user.realname" />
                <input
                  type="password"
                  v-model.trim="user.password"
                  @keydown.=""
                  placeholder="변경할 비밀번호를 입력해주세요. "
                />
                <input
                  type="password"
                  v-model.trim="user.passwordMatch"
                  placeholder="변경할 비밀번호를 입력해주세요. "
                />
              </template>
            </td>
            <td>
              <template v-if="!user.editMode">{{ user.role }}</template>
              <template v-else>
                <select v-model="user.role">
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </template>
            </td>
            <td class="action-buttons">
              <template v-if="!user.editMode">
                <button class="edit-button" @click="editUser(index)">
                  수정
                </button>
                <button class="delete-button" @click="deleteUser(index)">
                  삭제
                </button>
              </template>
              <template v-else>
                <button class="save-button" @click="saveUser(index)">
                  저장
                </button>
                <button class="cancel-button" @click="cancelEdit(index)">
                  취소
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: "UserManagementView",
  data() {
    return {
      addMode: false,
      newUser: {
        username: "",
        realname: "",
        role: "user",
        password: "",
        confirmPassword: "",
      },
      userList: [],
      originalUserList: [],
      isUniqueUsername: null,
    };
  },
  mounted() {
    this.getUserList();
  },
  methods: {
    async getUserList() {
      try {
        const response = await this.$axios.get("/api/auth/user-list/", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        });
        this.originalUserList = response.data.map((user) => ({
          ...user,
          editMode: false,
          password: "",
          passwordMatch: "",
        }));
        this.userList = [...JSON.parse(JSON.stringify(this.originalUserList))];
      } catch (error) {
        console.error("Error fetching user information:", error);
      }
    },
    toggleAddMode() {
      this.addMode = !this.addMode;
      this.newUser = { username: "", realname: "", role: "user" };
    },
    addUser() {
      if (
        !this.newUser.username ||
        !this.newUser.realname ||
        !this.newUser.password ||
        !this.newUser.confirmPassword
      ) {
        alert("모든 필드를 채워주세요.");
        return;
      }

      if (!this.isUniqueUsername) {
        alert("아이디 중복 확인을 해주세요.");
        return;
      }

      if (this.isPasswordMatch) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
      }

      try {
        this.$axios
          .post("/api/auth/register", this.newUser, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then(() => {
            this.getUserList();
            this.toggleAddMode();
          });
      } catch (error) {
        console.error("Error adding user:", error);
      }
    },
    editUser(index) {
      this.userList[index].editMode = true;
    },
    saveUser(index) {
      const user = this.userList[index];
      try {
        if (user.password && user.password !== user.passwordMatch)
          throw new Error(
            alert("비밀번호가 비밀번호 확인과 일치하지 않습니다.")
          );

        if (user.password.length < 8)
          throw new Error(alert("비밀번호를 8자리 이상 입력해주세요."));

        this.$axios
          .put(
            `/api/auth/edit-user/${user.id}`,
            {
              userList: user,
            },
            {
              headers: {
                Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
              },
            }
          )
          .then(() => {
            user.editMode = false;
            alert("성공적으로 정보를 변경하였습니다.");
          });
      } catch (error) {
        // console.log(`hi ${error}`);
        console.error("Error editing user:", error);
      } finally {
        user.password = "";
        user.passwordMatch = "";
      }
    },
    cancelEdit(index) {
      this.userList[index].editMode = false;
      this.resetUserList();
    },
    deleteUser(index) {
      try {
        this.$axios
          .delete(`/api/auth/delete-user/${this.userList[index].id}`, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then(() => {
            this.userList.splice(index, 1);
          });
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    },
    cancelAddUser() {
      this.toggleAddMode();
    },
    resetUserList() {
      this.userList = [...JSON.parse(JSON.stringify(this.originalUserList))];
    },
    async checkUsername() {
      try {
        const response = await this.$axios.get(
          `/api/auth/check-user/${this.newUser.username}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        if (response.status === 200) {
          this.isUniqueUsername = true;
          alert("사용 가능한 아이디입니다.");
        }
      } catch (error) {
        this.isUniqueUsername = false;
        alert("이미 사용 중인 아이디입니다.");
        console.error("아이디 중복 확인 중 오류 발생:", error);
      }
    },
  },
  computed: {
    isPasswordMatch() {
      // 만약 둘 중 하나라도 비어있으면 null return
      if (!this.newUser.password || !this.newUser.confirmPassword) {
        return null;
      }

      return this.newUser.password !== this.newUser.confirmPassword;
    },
  },
};
</script>

<style scoped>
.user-management-container {
  height: calc(100vh - 71px);
  padding: 16px;
  background-color: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.title-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
}

h1 {
  font-size: 20px;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 2px solid #0056b3;
  margin: 0;
}

form {
  flex-shrink: 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.input-group,
.button-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

input[type="text"],
input[type="password"],
select {
  width: 100%;
  padding: 8px;
  margin: 6px 0;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: #f8f9fa;
  transition: all 0.3s ease;
  box-sizing: border-box;
  font-size: 13px;
}

input[type="text"]:focus,
input[type="password"]:focus,
select:focus {
  border-color: #0056b3;
  background-color: #e8f0fe;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.25);
}

.check-button,
button[type="submit"],
button[type="button"],
.edit-button,
.delete-button,
.save-button,
.cancel-button {
  width: 100%;
  padding: 8px 0;
  margin-top: 6px;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  color: white;
  background-color: #007bff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease-in-out;
  box-sizing: border-box;
}

.check-button:hover,
button[type="submit"]:hover,
button[type="button"]:hover,
.edit-button:hover,
.delete-button:hover,
.save-button:hover,
.cancel-button:hover {
  background-color: #0056b3;
}

.delete-button,
.cancel-button {
  background-color: #dc3545;
}
.delete-button:hover,
.cancel-button:hover {
  background-color: #c82333;
}
.save-button {
  background-color: #28a745;
}
.save-button:hover {
  background-color: #218838;
}

.button-container {
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.button-container button {
  flex: 1;
}

.table-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 12px;
  text-align: center;
  border-bottom: 1px solid #dee2e6;
  font-size: 13px;
}

thead {
  background-color: #0056b3;
  color: #ffffff;
  position: sticky;
  top: 0;
}

tr:nth-child(even) {
  background-color: #f8f9fa;
}

.action-buttons {
  gap: 6px;
  display: flex;
  justify-content: center;
}

.action-buttons button {
  width: auto;
  padding: 4px 10px;
  margin: 0;
}

.error-message {
  color: #dc3545;
  font-size: 12px;
}

.success-message {
  color: #28a745;
  font-size: 12px;
}

.info-message {
  color: #17a2b8;
  font-size: 12px;
}

.add-user-button {
  padding: 8px 16px;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  color: white;
  background-color: #007bff;
  transition: all 0.2s ease-in-out;
}

.add-user-button:hover {
  background-color: #0056b3;
}

.button-container > button[type="submit"] {
  background-color: #28a745;
}
.button-container > button[type="submit"]:hover {
  background-color: #218838;
}
.button-container > button[type="button"] {
  background-color: #dc3545;
}
.button-container > button[type="button"]:hover {
  background-color: #c82333;
}
</style>
