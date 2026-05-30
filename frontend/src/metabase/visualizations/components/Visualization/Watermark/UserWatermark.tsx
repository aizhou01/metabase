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
  return `${y}/${m}/${d} ${h}:${min}`;
}

export const UserWatermark = () => {
  const user = useSelector(getUser);

  if (!user) {
    return null;
  }

  const watermarkText = `${user.common_name} - ${formatDateTime()}`;

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
