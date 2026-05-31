# 增加筛选器下拉列表限制 Skill

将 Metabase 中所有与字段筛选器下拉列表和仪表板下拉列表相关的限制从 1000 增加到 3000（前端 100→3000）。

复盖范围：
- 链式筛选（chain-filter）查询结果上限
- 字段搜索（field search）默认上限
- 卡片来源参数值（card-sourced parameter values）上限
- 仪表板参数调用链式筛选时的 limit
- 缓存字段唯一值（FieldValues）上限
- 搜索功能数据库查询和 API 响应上限
- 前端查询构建器筛选器值选择器搜索限制

---

## 需要修改的文件

### 1. `src/metabase/parameters/chain_filter.clj`

**变量**: `max-results`（约第 413 行）

chain-filter 核心查询的最大返回结果数，为所有 chain-filter 调用的兜底上限。

```clojure
;; 修改前
(def ^:private max-results 1000)

;; 修改后
(def ^:private max-results 3000)
```

---

### 2. `src/metabase/parameters/field.clj`

**变量**: `default-max-field-search-limit`（约第 38 行）

`search-values` 函数在未指定 limit 时的默认上限。

```clojure
;; 修改前
(def ^:private default-max-field-search-limit 1000)

;; 修改后
(def ^:private default-max-field-search-limit 3000)
```

---

### 3. `src/metabase/parameters/custom_values.clj`

**变量**: `*max-rows*`（约第 60-64 行）

当参数值来源为卡片（saved question）时的最大返回行数。注释中说明了与 chain-filter 保持一致。

```clojure
;; 修改前
(def ^:dynamic *max-rows*
  "Maximum number of rows returned when running a card.
  It's 1000 because it matches with the limit for chain-filter.
  Maybe we should lower it for the sake of displaying a parameter dropdown."
  1000)

;; 修改后
(def ^:dynamic *max-rows*
  "Maximum number of rows returned when running a card.
  It's 3000 because it matches with the limit for chain-filter.
  Maybe we should lower it for the sake of displaying a parameter dropdown."
  3000)
```

---

### 4. `src/metabase/parameters/dashboard.clj`

**变量**: `result-limit`（约第 18-20 行）

Dashboard API（`/api/dashboard/:id/params/:key/values` 和 `/search/:query`）调用 chain-filter 时传入的 limit。

```clojure
;; 修改前
(def ^:const result-limit
  "How many results to return when chain filtering"
  1000)

;; 修改后
(def ^:const result-limit
  "How many results to return when chain filtering"
  3000)
```

---

### 5. `src/metabase/warehouse_schema/models/field_values.clj`

**变量**: `*absolute-max-distinct-values-limit*`（约第 57-75 行）

缓存字段唯一值（FieldValues）的绝对上限，控制 List Widget 中显示的选项数量。

> 注意：原注释提到此值过高可能导致内存问题。3000 仍在合理范围内。

```clojure
;; 修改前
  (int 1000))

;; 修改后
  (int 3000))
```

---

### 6. `src/metabase/search/config.clj`

**变量**: `*db-max-results*` 和 `max-filtered-results`（约第 12-22 行）

控制搜索功能从数据库查询的原始结果数和 API 返回结果数。

```clojure
;; 修改前
(def ^:dynamic *db-max-results*
  "Number of raw results to fetch from the database. ..."
  1000)

(def ^:const max-filtered-results
  "Number of results to return in an API response"
  1000)

;; 修改后
(def ^:dynamic *db-max-results*
  "Number of raw results to fetch from the database. ..."
  3000)

(def ^:const max-filtered-results
  "Number of results to return in an API response"
  3000)
```

---

### 7. `src/metabase/dashboards_rest/api.clj`

**文档字符串**（约第 1282 行）

API 文档说明，与 `dashboard.clj` 中的实际限制保持一致。

```clojure
;; 修改前
  Currently limited to first 1000 results."

;; 修改后
  Currently limited to first 3000 results."
```

---

### 8. `frontend/src/metabase/querying/common/components/FieldValuePicker/SearchValuePicker/constants.ts`

**常量**: `SEARCH_LIMIT`（约第 2 行）

查询构建器筛选器值选择器中下拉列表的搜索限制，作为 `limit` 参数传给后端 API `GET /api/field/:id/search/:searchFieldId`。

```typescript
// 修改前
export const SEARCH_LIMIT = 100;

// 修改后
export const SEARCH_LIMIT = 3000;
```

> 注意：此文件路径在不同版本中可能不同。0.58 版本中路径为 `frontend/src/metabase/querying/filters/components/FilterValuePicker/SearchValuePicker/constants.ts`。请先搜索 `SEARCH_LIMIT` 定位当前版本的实际位置。

---

## 不需要修改的位置

| 文件 | 变量 | 原因 |
|------|------|------|
| `src/metabase/warehouse_schema_rest/api/field.clj` | `max-field-ids-for-table-id-lookup` (1000) | API 批量请求限制，与下拉列表无关 |
| `frontend/.../FieldValuesWidget/FieldValuesWidget.tsx` | `MAX_SEARCH_RESULTS = 100` | 不控制显示数量，只用于判断在客户端本地过滤还是调用 API 重新搜索的启发式逻辑。改为 3000 反而导致前端试图在浏览器本地过滤大量数据，影响性能 |

---

## 修改汇总

| # | 文件 | 变量 | 改动 |
|---|------|------|------|
| 1 | `src/metabase/parameters/chain_filter.clj` | `max-results` | 1000→3000 |
| 2 | `src/metabase/parameters/field.clj` | `default-max-field-search-limit` | 1000→3000 |
| 3 | `src/metabase/parameters/custom_values.clj` | `*max-rows*` | 1000→3000 |
| 4 | `src/metabase/parameters/dashboard.clj` | `result-limit` | 1000→3000 |
| 5 | `src/metabase/warehouse_schema/models/field_values.clj` | `*absolute-max-distinct-values-limit*` | 1000→3000 |
| 6 | `src/metabase/search/config.clj` | `*db-max-results*` | 1000→3000 |
| 7 | `src/metabase/search/config.clj` | `max-filtered-results` | 1000→3000 |
| 8 | `src/metabase/dashboards_rest/api.clj` | 文档字符串 | 1000→3000 |
| 9 | `frontend/.../SearchValuePicker/constants.ts` | `SEARCH_LIMIT` | 100→3000 |

---

## 验证方法

运行后端测试：
```bash
./bin/test-agent :only '[metabase.parameters.chain-filter-test]'
./bin/test-agent :only '[metabase.parameters.dashboard-test]'
./bin/test-agent :only '[metabase.warehouse-schema.models.field-values-test]'
./bin/test-agent :only '[metabase.search.config-test]'
```

前端类型检查（如环境已安装依赖）：
```bash
cd frontend && bun run type-check-pure
```
