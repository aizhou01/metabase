# 水印功能 Skill

为已登录用户在所有视图和导出文件中添加水印（姓名 + 日期时间）。
水印格式：姓在前名在后（`last_name + first_name`），日期格式 `yyyy-MM-dd HH:mm`。

## 覆盖范围

1. **屏幕显示**：问题视图、看板视图
2. **PDF 导出**：看板 PDF 下载
3. **PNG 导出**：图表/可视化图片下载
4. **Excel 导出**：XLSX 下载（背景图片水印）
5. **导出格式限制**：下载下拉菜单只保留 XLSX

---

## 需要新建的文件

### `frontend/src/metabase/visualizations/components/Visualization/Watermark/UserWatermark.tsx`

用户水印 React 组件。使用 SVG `<pattern>` 平铺水印文字，只在有登录用户时显示。

```tsx
import { useSelector } from "metabase/lib/redux";
import { getUser } from "metabase/selectors/user";

import S from "./UserWatermark.module.css";

function formatDateTime(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

export const UserWatermark = () => {
  const user = useSelector(getUser);

  if (!user) {
    return null;
  }

  const watermarkText = `${user.last_name}${user.first_name} - ${formatDateTime()}`;

  return (
    <div className={S.Root} data-testid="user-watermark">
      <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="user-watermark-text"
            x="0"
            y="0"
            height="220"
            width="220"
            patternUnits="userSpaceOnUse"
          >
            <text
              x="0"
              y="0"
              fontSize="16"
              fontWeight="600"
              transform="translate(15, 210) rotate(-45)"
              textAnchor="start"
              className={S.text}
            >
              {watermarkText}
            </text>
          </pattern>
        </defs>
        <rect
          opacity=".15"
          height="100%"
          width="100%"
          fill="url(#user-watermark-text)"
        />
      </svg>
    </div>
  );
};
```

### `frontend/src/metabase/visualizations/components/Visualization/Watermark/UserWatermark.module.css`

水印样式：绝对定位覆盖整个父容器，不拦截鼠标事件。

```css
.Root {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 1;
}

.text {
  fill: var(--mb-color-text-secondary);
}
```

---

## 需要修改的文件

### 1. `frontend/src/metabase/visualizations/components/Visualization/Watermark/index.ts`

在末尾添加导出：

```ts
export * from "./UserWatermark";
```

---

### 2. `frontend/src/metabase/visualizations/components/Visualization/Visualization.tsx`

三处改动：

**a) 文件头部添加 import：**

```tsx
import { getUser } from "metabase/selectors/user";
```

修改 Watermark 导入，增加 `UserWatermark`：

```tsx
import { UserWatermark, Watermark } from "./Watermark";
```

**b) StateProps 和 mapStateToProps 添加 currentUser：**

```tsx
type StateProps = {
  hasDevWatermark: boolean;
  currentUser: ReturnType<typeof getUser>;
  // ... 其他已有字段 ...
};

const mapStateToProps = (state: State): StateProps => ({
  hasDevWatermark: getTokenFeature(state, "development_mode"),
  currentUser: getUser(state),
  // ... 其他已有映射 ...
});
```

**c) render 解构和渲染添加 currentUser：**

在 render 方法的解构中（约 655 行）添加 `currentUser`：

```tsx
const {
  // ... 已有字段 ...
  currentUser,
  // ... 已有字段 ...
} = this.props;
```

找到图表容器 div（约 910 行），修改 style：

```tsx
style={{
  position:
    hasDevWatermark || currentUser
      ? "relative"
      : undefined,
}}
```

找到 Watermark 渲染处（约 1004 行），在后面添加：

```tsx
{hasDevWatermark && <Watermark card={series[0].card} />}
{currentUser && <UserWatermark />}
```

---

### 3. `frontend/src/metabase/dashboard/components/Dashboard/Dashboard.tsx`

添加 import：

```tsx
import { UserWatermark } from "metabase/visualizations/components/Visualization/Watermark";
```

找到 `</Flex>` 闭合标签（`DashboardSidebars` 后面），在其前面添加：

```tsx
<UserWatermark />
```

---

### 4. `frontend/src/metabase/lib/urls/misc.ts`

只保留 XLSX 导出格式，移除 CSV 和 JSON：

```ts
export const exportFormats: TableExportFormat[] = ["xlsx"];
```

---

### 5. `frontend/src/metabase/redux/downloads.ts`

添加 import：

```ts
import { getUser } from "metabase/selectors/user";
```

**`downloadToImage` thunk 中**（约 160 行），获取用户名并传入 `saveChartImage`：

```ts
const state = getState();
const isWhitelabeled = getTokenFeature(state, "whitelabel");
const includeBranding = !isWhitelabeled;
const fileName = getChartFileName(question, includeBranding);
const user = getUser(state);
const userName = user ? `${user.last_name ?? ""}${user.first_name ?? ""}` : undefined;
// ... chartSelector ...

await saveChartImage({
  selector: chartSelector,
  fileName,
  includeBranding,
  userName,
});
```

**`downloadDashboardToPdf` thunk 中**（约 193 行），同样处理：

```ts
const state = getState();
const isWhitelabeled = getTokenFeature(state, "whitelabel");
const includeBranding = !isWhitelabeled;
const cardNodeSelector = `#${DASHBOARD_PDF_EXPORT_ROOT_ID}`;
const fileName = getDashboardPdfFileName(dashboard, includeBranding);
const user = getUser(state);
const userName = user ? `${user.last_name ?? ""}${user.first_name ?? ""}` : undefined;

await saveDashboardPdf({
  fileName,
  selector: cardNodeSelector,
  dashboardName: dashboard.name,
  includeBranding,
  userName,
});
```

---

### 6. `frontend/src/metabase/visualizations/lib/save-chart-image.ts`

`Opts` 接口添加 `userName` 字段：

```ts
interface Opts {
  selector: string;
  fileName: string;
  includeBranding: boolean;
  userName?: string;
}
```

函数解构添加 `userName`：

```ts
export const saveChartImage = async ({
  selector,
  fileName,
  includeBranding,
  userName,
}: Opts) => {
```

在 `onclone` 回调中，branding 代码块之后添加水印逻辑：

```ts
if (userName) {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const dateTime = `${y}-${mo}-${d} ${h}:${min}`;
  const watermarkText = `${userName} - ${dateTime}`;

  const watermark = document.createElement("div");
  watermark.style.cssText =
    "position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden;";

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const defs = document.createElementNS(svgNs, "defs");
  const pattern = document.createElementNS(svgNs, "pattern");
  pattern.setAttribute("id", "chart-watermark");
  pattern.setAttribute("x", "0");
  pattern.setAttribute("y", "0");
  pattern.setAttribute("height", "220");
  pattern.setAttribute("width", "220");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");

  const text = document.createElementNS(svgNs, "text");
  text.setAttribute("x", "0");
  text.setAttribute("y", "0");
  text.setAttribute("font-size", "16");
  text.setAttribute("font-weight", "600");
  text.setAttribute("fill", "currentColor");
  text.setAttribute("opacity", "0.15");
  text.setAttribute("transform", "translate(15, 210) rotate(-45)");
  text.textContent = watermarkText;

  pattern.appendChild(text);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const rect = document.createElementNS(svgNs, "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "url(#chart-watermark)");
  svg.appendChild(rect);

  watermark.appendChild(svg);
  node.appendChild(watermark);
}
```

---

### 7. `frontend/src/metabase/visualizations/lib/save-dashboard-pdf.ts`

在 `HEADER_MARGIN_BOTTOM` 之前添加 `createWatermarkElement` 函数：

```ts
const createWatermarkElement = (userName: string) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const dateTime = `${y}-${m}-${d} ${h}:${min}`;
  const watermarkText = `${userName} - ${dateTime}`;

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const defs = document.createElementNS(svgNs, "defs");
  const pattern = document.createElementNS(svgNs, "pattern");
  pattern.setAttribute("id", "pdf-watermark");
  pattern.setAttribute("x", "0");
  pattern.setAttribute("y", "0");
  pattern.setAttribute("height", "220");
  pattern.setAttribute("width", "220");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");

  const text = document.createElementNS(svgNs, "text");
  text.setAttribute("x", "0");
  text.setAttribute("y", "0");
  text.setAttribute("font-size", "16");
  text.setAttribute("font-weight", "600");
  text.setAttribute("fill", "currentColor");
  text.setAttribute("opacity", "0.15");
  text.setAttribute("transform", "translate(15, 210) rotate(-45)");
  text.textContent = watermarkText;

  pattern.appendChild(text);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const rect = document.createElementNS(svgNs, "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "url(#pdf-watermark)");
  svg.appendChild(rect);

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;";
  wrapper.appendChild(svg);

  return wrapper;
};
```

`SavePdfProps` 接口添加 `userName`：

```ts
interface SavePdfProps {
  fileName: string;
  selector: string;
  dashboardName: string;
  includeBranding: boolean;
  userName?: string;
}
```

`saveDashboardPdf` 解构添加 `userName`：

```ts
export const saveDashboardPdf = async ({
  fileName,
  selector,
  dashboardName,
  includeBranding,
  userName,
}: SavePdfProps) => {
```

在 `onclone` 回调中，branding 代码块之后添加：

```ts
if (userName) {
  const watermark = createWatermarkElement(userName);
  node.appendChild(watermark);
}
```

---

### 8. `src/metabase/query_processor/streaming/xlsx.clj`

**a) ns 声明添加 require：**

```clojure
[metabase.api.common :as api]
```

**b) ns 声明添加 import：**

```clojure
(java.awt Color Font Graphics2D RenderingHints)
(java.awt.image BufferedImage)
(java.io ByteArrayInputStream ByteArrayOutputStream OutputStream)
(javax.imageio ImageIO)
(org.apache.poi.openxml4j.opc TargetMode)
(org.apache.poi.xssf.usermodel XSSFRelation XSSFWorkbook)
```

**c) 在 `setup-header-row!` 后面添加水印图片生成函数：**

```clojure
(def ^:private watermark-tile-width  220)
(def ^:private watermark-tile-height 220)

(defn- generate-watermark-image
  "生成带对角水印文字的 BufferedImage，用于 Excel 工作表背景平铺。"
  ^BufferedImage [^String text]
  (let [img (BufferedImage. watermark-tile-width watermark-tile-height BufferedImage/TYPE_INT_ARGB)
        g   (.createGraphics img)]
    (.setRenderingHint g RenderingHints/KEY_ANTIALIASING RenderingHints/VALUE_ANTIALIAS_ON)
    (.setRenderingHint g RenderingHints/KEY_TEXT_ANTIALIASING RenderingHints/VALUE_TEXT_ANTIALIAS_ON)
    (.setFont g (Font. "SansSerif" Font/PLAIN 24))
    (.setColor g (Color. 0x94 0x9a 0xab 77))  ;; #949aab 透明度 ~30%
    (let [fm          (.getFontMetrics g)
          text-width  (.stringWidth fm text)
          cx          (/ watermark-tile-width 2.0)
          cy          (/ watermark-tile-height 2.0)
          orig-transform (.getTransform g)]
      (.rotate g (Math/toRadians -45.0) cx cy)
      (.drawString g text
                   (- cx (/ text-width 2.0))
                   cy)
      (.setTransform g orig-transform))
    (.dispose g)
    img))
```

**d) `defmethod streaming-results-writer` 的 let 绑定中添加用户信息 volatiles：**

```clojure
(let [workbook             (SXSSFWorkbook.)
      workbook-sheet       (volatile! nil)
      styles               (volatile! nil)
      pivot-data           (volatile! nil)
      pivot-grouping-index (volatile! nil)
      user-common-name     (volatile! nil)
      user-email           (volatile! nil)]
```

**e) `begin!` 方法开头添加用户信息捕获（在 QP 线程接管之前）：**

```clojure
;; 在 handler 线程中捕获用户信息，防止 QP 线程池丢失上下文
(when api/*current-user-id*
  (when-let [user @api/*current-user*]
    (vreset! user-common-name (str (:last_name user) (:first_name user)))
    (vreset! user-email (:email user))))
```

**f) 替换 `finish!` 结尾的 `(try ...)` 块为水印注入逻辑：**

```clojure
;; 有用户：SXSSF → buffer → XSSFWorkbook → 注入背景图片水印 → 写出
;; 无用户：直接写到输出流（原始快速路径）
(if-let [cn @user-common-name]
  (let [tmp-file (java.io.File/createTempFile "mb-xlsx-" ".tmp")]
    (try
      (with-open [fos (java.io.FileOutputStream. tmp-file)]
        (spreadsheet/save-workbook-into-stream! fos workbook))
      (.dispose ^SXSSFWorkbook workbook)
      (with-open [xssf-wb (XSSFWorkbook. tmp-file)]
        (let [export-time (t/format "yyyy-MM-dd HH:mm" (t/zoned-date-time))
              wm-text     (str cn " - " export-time)
              wm-img      (generate-watermark-image wm-text)
              img-baos    (ByteArrayOutputStream.)]
          (ImageIO/write wm-img "png" img-baos)
          (let [img-bytes (.toByteArray img-baos)]
            (.addPicture xssf-wb img-bytes Workbook/PICTURE_TYPE_PNG)
            (when-let [pic-part (last (.getAllPictures xssf-wb))]
              (let [ppn      (.getPartName (.getPackagePart pic-part))
                    rel-type (.getRelation XSSFRelation/IMAGES)]
                (dotimes [i (.getNumberOfSheets xssf-wb)]
                  (let [^XSSFSheet sheet (.getSheetAt xssf-wb i)
                        pr (.addRelationship (.getPackagePart sheet) ppn
                                             TargetMode/INTERNAL rel-type nil)]
                    (.setId (.addNewPicture (.getCTWorksheet sheet)) (.getId pr))))))))
        (.write xssf-wb os))
      (finally
        (.delete tmp-file))))
  ;; 无用户 — 原始保存路径
  (try
    (spreadsheet/save-workbook-into-stream! os workbook)
    (finally
      (.dispose ^SXSSFWorkbook workbook)
      (.close os))))
```

---

## 水印参数配置

| 参数 | 屏幕 / PDF / PNG | Excel 背景图 |
|------|------------------|-------------|
| 字号 | 16px | 24px |
| Tile 尺寸 | 220 × 220 | 220 × 220 |
| 颜色 | `--mb-color-text-secondary` (#949aab) | #949aab alpha 77/255 (30%) |
| 透明度 | 0.15 | 30% |
| 字体粗细 | 600 | PLAIN |
| 旋转角度 | -45° | -45° |
| 日期格式 | `yyyy-MM-dd HH:mm` | `yyyy-MM-dd HH:mm` |
| 姓名格式 | 姓 + 名（`last_name` + `first_name`） | 姓 + 名（`last_name` + `first_name`） |
| 水印内容 | `姓名 - 日期 时间` | `姓名 - 日期 时间` |

---

## 验证方法

运行后端测试：
```bash
./bin/test-agent :only '[metabase.query-processor.streaming.xlsx-test]'
```

前端验证步骤：
1. 登录后打开一个问题 → 确认水印文字显示
2. 打开看板 → 确认水印文字显示
3. 导出看板为 PDF → 确认水印
4. 下载图表为 PNG → 确认水印
5. 下载查询结果为 XLSX → 确认背景水印
