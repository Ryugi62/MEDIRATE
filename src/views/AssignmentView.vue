<template>
  <!-- 과제 평가 제목 -->
  <h1 class="header-title">과제 평가</h1>

  <!-- 과제 목록 테이블 -->
  <div class="assignments-table-container">
    <table>
      <thead>
        <!-- 테이블 헤더 -->
        <tr>
          <!-- 각 열 정렬 기능 -->
          <!-- 클릭기능이 있다는걸 class로 표시 -->
          <th @click="sort('id')" class="sortable">
            <i :class="sortIcon('id')"></i> ID
          </th>
          <th>제목</th>
          <th @click="sort('creationDate')" class="sortable">
            <i :class="sortIcon('creationDate')"></i> 생성
          </th>
          <th @click="sort('dueDate')" class="sortable">
            <i :class="sortIcon('dueDate')"></i> 종료
          </th>
          <th @click="sort('status')" class="sortable">
            <i :class="sortIcon('status')"></i> 상태
          </th>
          <th>현황</th>
        </tr>
      </thead>
      <tbody>
        <!-- 각 과제 항목 -->
        <tr
          v-for="assignment in visibleAssignments"
          :key="assignment.id"
          @click="redirect(assignment.id)"
        >
          <td class="assignment-id">{{ assignment.id }}</td>
          <td class="assignment-title">{{ assignment.title }}</td>
          <td class="assignment-creation-date">
            {{ assignment.creationDate }}
          </td>
          <td class="assignment-due-date">{{ assignment.dueDate }}</td>
          <td class="assignment-status">{{ assignment.status }}</td>
          <td class="assignment-progress">
            <strong>{{ assignment.completed }}</strong> / {{ assignment.total }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 페이지네이션 -->
  <nav class="pagination-nav" aria-label="Pagination">
    <ul class="pagination">
      <li>
        <i
          class="fa-solid fa-angles-left pagination__button"
          @click="changePage(1)"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angle-left pagination__button"
          @click="changePage(current - 1)"
        ></i>
      </li>
      <li
        v-for="page in visiblePages"
        :key="page"
        :class="{ 'pagination__item--active': current === page }"
        class="pagination__item"
      >
        <a @click.prevent="changePage(page)" class="pagination__link">{{
          page
        }}</a>
      </li>
      <li>
        <i
          class="fa-solid fa-chevron-right pagination__button"
          @click="changePage(current + 1)"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(total)"
        ></i>
      </li>
    </ul>
  </nav>
</template>

<script>
export default {
  name: "AssignmentEvaluationView",
  data() {
    return {
      assignments: [
        {
          id: 1,
          title: "질병평가001",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "완료",
          total: 300,
          completed: 1,
        },
        {
          id: 2,
          title: "질병평가002",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "완료",
          total: 300,
          completed: 2,
        },
        {
          id: 3,
          title: "질병평가003",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "완료",
          total: 300,
          completed: 3,
        },
        {
          id: 4,
          title: "질병평가004",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "완료",
          total: 300,
          completed: 4,
        },
        {
          id: 5,
          title: "질병평가005",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "완료",
          total: 300,
          completed: 5,
        },
        {
          id: 6,
          title: "질병평가006",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "완료",
          total: 300,
          completed: 6,
        },
        {
          id: 7,
          title: "질병평가007",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 7,
        },
        {
          id: 8,
          title: "질병평가008",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 8,
        },
        {
          id: 9,
          title: "질병평가009",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 9,
        },
        {
          id: 10,
          title: "질병평가010",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 10,
        },
        {
          id: 11,
          title: "질병평가011",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 11,
        },
        {
          id: 12,
          title: "질병평가012",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 12,
        },
        {
          id: 13,
          title: "질병평가013",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 13,
        },
        {
          id: 14,
          title: "질병평가014",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 14,
        },
        {
          id: 15,
          title: "질병평가015",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 15,
        },
        {
          id: 16,
          title: "질병평가016",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 16,
        },
        {
          id: 17,
          title: "질병평가017",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 17,
        },
        {
          id: 18,
          title: "질병평가018",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 18,
        },
        {
          id: 19,
          title: "질병평가019",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 19,
        },
        {
          id: 20,
          title: "질병평가001",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 1,
        },
        {
          id: 21,
          title: "질병평가002",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 2,
        },
        {
          id: 22,
          title: "질병평가003",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 3,
        },
        {
          id: 23,
          title: "질병평가004",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 4,
        },
        {
          id: 24,
          title: "질병평가005",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 5,
        },
        {
          id: 25,
          title: "질병평가006",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 6,
        },
        {
          id: 26,
          title: "질병평가007",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 7,
        },
        {
          id: 27,
          title: "질병평가008",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 8,
        },
        {
          id: 28,
          title: "질병평가009",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 9,
        },
        {
          id: 29,
          title: "질병평가010",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 10,
        },
        {
          id: 30,
          title: "질병평가011",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 11,
        },
        {
          id: 31,
          title: "질병평가012",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 12,
        },
        {
          id: 32,
          title: "질병평가013",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 13,
        },
        {
          id: 33,
          title: "질병평가014",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 14,
        },
        {
          id: 34,
          title: "질병평가015",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 15,
        },
        {
          id: 35,
          title: "질병평가016",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 16,
        },
        {
          id: 36,
          title: "질병평가017",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 17,
        },
        {
          id: 37,
          title: "질병평가018",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 18,
        },
        {
          id: 38,
          title: "질병평가019",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 19,
        },
        {
          id: 39,
          title: "질병평가001",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 1,
        },
        {
          id: 40,
          title: "질병평가002",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 2,
        },
        {
          id: 41,
          title: "질병평가003",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 3,
        },
        {
          id: 42,
          title: "질병평가004",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 4,
        },
        {
          id: 43,
          title: "질병평가005",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 5,
        },
        {
          id: 44,
          title: "질병평가006",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 6,
        },
        {
          id: 45,
          title: "질병평가007",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 7,
        },
        {
          id: 46,
          title: "질병평가008",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 8,
        },
        {
          id: 47,
          title: "질병평가009",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 9,
        },
        {
          id: 48,
          title: "질병평가010",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 10,
        },
        {
          id: 49,
          title: "질병평가011",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 11,
        },
        {
          id: 50,
          title: "질병평가012",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 12,
        },
        {
          id: 51,
          title: "질병평가013",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 13,
        },
        {
          id: 52,
          title: "질병평가014",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 14,
        },
        {
          id: 53,
          title: "질병평가015",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 15,
        },
        {
          id: 54,
          title: "질병평가016",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 16,
        },
        {
          id: 55,
          title: "질병평가017",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 17,
        },
        {
          id: 56,
          title: "질병평가018",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 18,
        },
        {
          id: 57,
          title: "질병평가019",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 19,
        },
        {
          id: 58,
          title: "질병평가001",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 1,
        },
        {
          id: 59,
          title: "질병평가002",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 2,
        },
        {
          id: 60,
          title: "질병평가003",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 3,
        },
        {
          id: 61,
          title: "질병평가004",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 4,
        },
        {
          id: 62,
          title: "질병평가005",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 5,
        },
        {
          id: 63,
          title: "질병평가006",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 6,
        },
        {
          id: 64,
          title: "질병평가007",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 7,
        },
        {
          id: 65,
          title: "질병평가008",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 8,
        },
        {
          id: 66,
          title: "질병평가009",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 9,
        },
        {
          id: 67,
          title: "질병평가010",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 10,
        },
        {
          id: 68,
          title: "질병평가011",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 11,
        },
        {
          id: 69,
          title: "질병평가012",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 12,
        },
        {
          id: 70,
          title: "질병평가013",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 13,
        },
        {
          id: 71,
          title: "질병평가014",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 14,
        },
        {
          id: 72,
          title: "질병평가015",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 15,
        },
        {
          id: 73,
          title: "질병평가016",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 16,
        },
        {
          id: 74,
          title: "질병평가017",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 17,
        },
        {
          id: 75,
          title: "질병평가018",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 18,
        },
        {
          id: 76,
          title: "질병평가019",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 19,
        },
        {
          id: 77,
          title: "질병평가001",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 1,
        },
        {
          id: 78,
          title: "질병평가002",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 2,
        },
        {
          id: 79,
          title: "질병평가003",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 3,
        },
        {
          id: 80,
          title: "질병평가004",
          creationDate: "2024-01-01",
          dueDate: "2024-02-02",
          status: "진행중",
          total: 300,
          completed: 4,
        },
      ],
      current: 1,
      perPage: 14,
      sortKey: "id",
      sortOrder: "asc",
    };
  },
  computed: {
    // 정렬된 과제 목록 반환
    sortedAssignments() {
      return [...this.assignments].sort((a, b) => {
        const multiplier = this.sortOrder === "asc" ? 1 : -1;
        return a[this.sortKey] < b[this.sortKey]
          ? -1 * multiplier
          : a[this.sortKey] > b[this.sortKey]
          ? 1 * multiplier
          : 0;
      });
    },
    // 현재 페이지에 표시되는 과제 목록 반환
    visibleAssignments() {
      const start = (this.current - 1) * this.perPage;
      const end = this.current * this.perPage;
      return this.sortedAssignments.slice(start, end);
    },
    // 총 페이지 수 계산
    total() {
      return Math.ceil(this.assignments.length / this.perPage);
    },
    // 표시되는 페이지 수 계산
    visiblePages() {
      const range = 2;
      let start = Math.max(this.current - range, 1);
      let end = Math.min(start + range * 2, this.total);
      if (this.current + range > this.total) {
        start = Math.max(this.total - range * 2, 1);
        end = this.total;
      }
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    },
  },
  methods: {
    // 다른 페이지로 리다이렉트
    redirect(id) {
      this.$router.push({ name: "assignmentDetail", params: { id } });
    },
    // 페이지 변경
    changePage(pageNumber) {
      this.current = Math.max(1, Math.min(pageNumber, this.total));
    },
    // 특정 키로 과제 목록 정렬
    sort(key) {
      this.sortOrder =
        this.sortKey === key && this.sortOrder === "asc" ? "desc" : "asc";
      this.sortKey = key;
    },
    // 정렬 아이콘 클래스 반환
    sortIcon(key) {
      return `fa-solid fa-arrow-${
        this.sortOrder === "asc" && this.sortKey === key ? "down" : "up"
      }`;
    },
  },
};
</script>

<style scoped>
.header-title {
  margin: 0;
  padding: 14px 24px;
  font-size: 24px;
  font-weight: 500;
  border-bottom: 1px solid var(--light-gray);
}

.assignments-table-container {
  min-width: 950px;
  min-height: 676px;
}

.assignments-table-container table {
  padding-right: 46px;
  width: 100%;
  border-collapse: collapse;
}

table thead tr {
  border-bottom: 1px solid var(--light-gray);
}

th {
  padding: 12px 24px;
  text-align: center;
  font-weight: bold;
  border-bottom: 1px solid var(--light-gray);
  cursor: pointer;
}

th:last-child,
td:last-child {
  padding-right: 46px;
}

.sortable:hover {
  color: var(--blue-hover);
}
.sortable:active {
  color: var(--blue-active);
}

td {
  padding: 12px 24px;
  text-align: center;
}

tbody > tr:hover {
  background-color: #f5f5f5;
  cursor: pointer;
}

.assignment-id {
  width: 54px;
}

.assignment-title {
  text-align: left;
}

.assignment-creation-date,
.assignment-due-date,
.assignment-status,
.assignment-progress {
  width: 95px;
}

.assignment-progress strong {
  font-size: 16px;
  color: var(--blue);
}

.pagination-nav {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  position: relative;
}

.pagination {
  display: flex;
  list-style: none;
  padding: 0;
  align-items: center;
}

.pagination__item {
  display: inline;
}

.pagination__button,
.pagination__link {
  display: inline-block;
  margin: 0 5px;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 50%;
  border: 1px solid var(--white);
}

.pagination__link:hover {
  color: var(--gray);
  border: 1px solid var(--gray);
}

.pagination__item--active .pagination__link {
  color: var(--blue);
  border: 1px solid var(--blue);
}
</style>
