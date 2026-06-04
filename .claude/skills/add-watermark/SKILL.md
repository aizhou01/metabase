# 水印功能 Skill

为已登录用户在所有视图和导出文件中添加水印（姓名 + 日期时间）。
水印格式：姓在前名在后（`last_name + first_name`），日期格式 `yyyy-MM-dd HH:mm`。

## 覆盖范围

1. **屏幕显示**：问题视图、看板视图
2. **PDF 导出**：看板 PDF 下载
3. **PNG 导出**：图表/可视化图片下载
4. **导出格式限制**：下载下拉菜单只保留 XLSX

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

## 水印参数配置

| 参数 | 屏幕 / PDF / PNG |
|------|------------------|
| 字号 | 16px |
| Tile 尺寸 | 220 × 220 |
| 颜色 | `--mb-color-text-secondary` (#949aab) |
| 透明度 | 0.15 |
| 字体粗细 | 600 |
| 旋转角度 | -45° |
| 日期格式 | `yyyy-MM-dd HH:mm` |
| 姓名格式 | 姓 + 名（`last_name` + `first_name`） |
| 水印内容 | `姓名 - 日期 时间` |
| Excel 导出 | 无水印（使用官方原始导出） |

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
